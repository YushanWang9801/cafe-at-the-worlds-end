/**
 * 配置加载器 - 从 secure-config.json 读取并 AES 解密
 * 加密脚本使用 aes-256-cbc，密钥是 'your-super-secret-key' 的 SHA256
 */

let cachedConfig = null

async function decrypt(encryptedData, ivBase64) {
  const secretKey = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('your-super-secret-key')
  )
  
  const key = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  )
  
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0))
  const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    key,
    encryptedBytes
  )
  
  return new TextDecoder().decode(decrypted)
}

export async function loadApiConfig() {
  if (cachedConfig) return cachedConfig

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}secure-config.json`)
    const { iv, data } = await response.json()
    
    const decrypted = await decrypt(data, iv)
    const config = JSON.parse(decrypted)
    
    cachedConfig = {
      access_key: config.access_key,
      secret_key: config.secret_key,
      model_name: config.model_name || 'ernie-speed-128k',
      token_url: config.token_url || '/baidu-api/oauth/2.0/token',
      chat_url: config.chat_url || '/baidu-api/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-speed-128k'
    }
    
    return cachedConfig
  } catch (error) {
    console.error('加载配置失败:', error)
    throw error
  }
}
