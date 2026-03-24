const QIANFAN_CONFIG = {
    "access_key": "c109GnPmw5PmhbbPCRebCjKT",
    "secret_key": "UsCG6V5o70nf1711D0SrqzPPXzZXxYME",
    "model_name": "ernie-speed-128k",
    "token_url": "https://aip.baidubce.com/oauth/2.0/token",
    // 注意：RPC 接口的 URL 必须拼上具体的模型名称
    "chat_url": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-speed-128k"
};

async function getAccessToken() {
    const url = `${QIANFAN_CONFIG.token_url}?grant_type=client_credentials&client_id=${QIANFAN_CONFIG.access_key}&client_secret=${QIANFAN_CONFIG.secret_key}`;
    
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();
    
    if (data.access_token) {
        return data.access_token;
    } else {
        throw new Error(`Token 获取失败: ${JSON.stringify(data)}`);
    }
}

async function chatTest() {
    console.log('--- 正在通过 AK/SK 唤醒咖啡师 ---');
    
    try {
        // 1. 获取 Token
        const token = await getAccessToken();
        console.log('✅ Token 验证通过');

        // 2. 发起对话请求 (URL 必须携带 access_token 参数)
        const chatUrlWithToken = `${QIANFAN_CONFIG.chat_url}?access_token=${token}`;
        
        const payload = {
            messages: [
                { role: "user", content: "你满足于现在的生活吗？" }
            ],
            temperature: 0.9,
            top_p: 0.8
        };

        const start = Date.now();
        const response = await fetch(chatUrlWithToken, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        // 3. 结果处理 (注意：RPC 返回的结果在 .result 字段，而不是 .choices)
        if (result.result) {
            console.log(`⏱️ 响应时间: ${Date.now() - start}ms`);
            console.log('☕ 咖啡师回复:', result.result);
        } else {
            console.error('❌ API 业务报错:', JSON.stringify(result, null, 2));
        }
        
    } catch (error) {
        console.error('⚠️ 系统错误:', error.message);
    }
}

chatTest();