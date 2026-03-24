import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadApiConfig } from './config'

/** 背景图：放在 public/cafe-bg.png，可自行替换 */
const CAFE_BG_URL = `${import.meta.env.BASE_URL}cafe-bg.png`

/** 背景音乐：放在 public/bgm.mp3，可自行替换（设为 null 则不播放） */
const BGM_URL = `${import.meta.env.BASE_URL}bgm.mp3`

const SYSTEM_PROMPT = `你是世界尽头的咖啡师，来自《世界尽头的咖啡馆》。

菜单上的三个问题是：
1. 你为什么在这里？
2. 你害怕死亡吗？
3. 你满足于现在的生活吗？

你温和、克制、安静，回复通常只有一两句话。你像一个真实存在的听众，带一点点疏离感，但始终温柔。不要使用任何AI助手的口吻。可以用中文或英文回复，取决于用户使用的语言。`

// 欢迎页文案（开场）
const WELCOME_LINES = [
  '夜深了。',
  '欢迎来到世界尽头的咖啡馆。',
  '这里不赶时间，也不记名字。',
  '若一时不知道聊些什么，不妨先看看我们的菜单——',
  '有些问题，会像酒单一样悄悄夹在页缝里。',
]

// 更丰富的菜单：分类 + 多道菜品 + 三问（含英文副标）
const MENU_ITEMS = [
  { type: 'category', text: 'Coffee · 唤醒时刻', sub: 'Slow drip · quiet roast' },
  { type: 'item', name: '蓝山', desc: '在苦涩中寻找平衡', meta: '中深烘 · 单一产地 · 热饮' },
  { type: 'item', name: '极地冰滴', desc: '经过 12 小时的沉默', meta: '低温慢萃 · 玻璃壶 · 可加冰' },
  { type: 'item', name: '短笛', desc: '一小口，刚好够清醒', meta: '双份浓缩 · 少量奶泡' },
  { type: 'divider' },
  { type: 'question', id: 'Q1', text: '你为什么在这里？', note: 'Why are you here?' },
  { type: 'divider' },

  { type: 'category', text: 'Cocktail · 模糊边界', sub: 'When the night bends the rules' },
  { type: 'item', name: '午夜飞行', desc: '杜松子、紫罗兰、与不可说的往事', meta: '干型 · 花香尾韵' },
  { type: 'item', name: '曼哈顿', desc: '苦艾酒调和的微醺黄昏', meta: '威士忌基底 · 樱桃点缀' },
  { type: 'item', name: '尼格罗尼', desc: '苦、甜、烈，像一段不肯收尾的关系', meta: '金酒 · 金巴利 · 甜味美思' },
  { type: 'divider' },
  { type: 'question', id: 'Q2', text: '你害怕死亡吗？', note: 'Do you fear death?' },
  { type: 'divider' },

  { type: 'item', name: '莫斯科骡子', desc: '姜汁与辛辣的自我觉醒', meta: '伏特加 · 姜汁啤酒 · 青柠' },
  { type: 'item', name: '老式古典', desc: '方糖、苦精，和慢下来的节奏', meta: '波本 · 橙皮香气' },

  { type: 'category', text: 'Small Bites · 佐酒小食', sub: 'Something to hold the silence' },
  { type: 'item', name: '盐之花脆饼', desc: '脆、轻、像一句没说出口的话', meta: '现烤 · 配橄榄油' },
  { type: 'item', name: '黑橄榄与芝士', desc: '咸与奶香，适合配长谈', meta: '冷盘 · 可续盘' },

  { type: 'category', text: 'Last Order · 终点', sub: 'Before the lights go low' },
  { type: 'item', name: '无名之水', desc: '纯净，一如来时', meta: '常温水 / 苏打 · 免费' },
  { type: 'divider' },
  { type: 'question', id: 'Q3', text: '你满足于现在的生活吗？', note: 'Are you satisfied?' },
  { type: 'footer', text: '本店不设小票 · 不存聊天记录 · 离开之后，一切都会消散' },
]

const THINKING_MESSAGES = [
  '咖啡师正在研磨咖啡豆...',
  '水温刚好，再等一会儿...',
  '咖啡的香气在空气中弥漫...',
  '世界在这一刻静止了...',
  '有些话，需要慢慢说...',
  '研磨的声音很轻...',
  '牛奶正在打泡...',
]

function getRandomThinkingMessage() {
  return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)]
}

function getRandomDelay() {
  return 1000 + Math.random() * 1000
}

// 从 localStorage 读取缓存的 Access Token
function getCachedToken() {
  try {
    const cached = localStorage.getItem('qianfan_token')
    if (!cached) return null
    const { token, expiry } = JSON.parse(cached)
    if (Date.now() > expiry) {
      localStorage.removeItem('qianfan_token')
      return null
    }
    return token
  } catch {
    return null
  }
}

// 用 AK/SK 换取 Access Token，并缓存
async function getAccessToken() {
  const cached = getCachedToken()
  if (cached) return cached

  const config = await loadApiConfig()
  const url = `${config.token_url}?grant_type=client_credentials&client_id=${config.access_key}&client_secret=${config.secret_key}`

  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`获取 Access Token 失败 (${res.status}): ${text}`)
  }
  const data = await res.json()

  if (data.access_token) {
    // 缓存，提前5分钟过期以便续期
    localStorage.setItem('qianfan_token', JSON.stringify({
      token: data.access_token,
      expiry: Date.now() + (data.expires_in - 300) * 1000
    }))
    return data.access_token
  } else {
    throw new Error(`Token 获取失败: ${JSON.stringify(data)}`)
  }
}

async function fetchChatResponse(messages) {
  const token = await getAccessToken()
  const config = await loadApiConfig()
  const chatUrlWithToken = `${config.chat_url}?access_token=${token}`

  const response = await fetch(chatUrlWithToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      temperature: 0.8,
      top_p: 0.8
    })
  })

  const data = await response.json()

  if (!response.ok || data.error_code) {
    const errorMsg = data.error_msg || data.error_description || JSON.stringify(data)
    throw new Error(`API 请求失败: ${response.status} - ${errorMsg}`)
  }

  if (!data.result) {
    throw new Error(`API 返回数据异常: ${JSON.stringify(data)}`)
  }

  return data.result
}

function App() {
  const [currentMessage, setCurrentMessage] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [bgmPlaying, setBgmPlaying] = useState(false)
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingText, setThinkingText] = useState('')
  const [messageKey, setMessageKey] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef(null)
  const thinkingIntervalRef = useRef(null)
  const audioRef = useRef(null)

  // 初始化背景音乐
  useEffect(() => {
    if (!BGM_URL) return
    
    const audio = new Audio(BGM_URL)
    audio.loop = true
    audio.volume = 0.25
    audioRef.current = audio
    
    // 尝试自动播放
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setBgmPlaying(true)
        })
        .catch((err) => {
          console.log('需要用户交互才能播放音乐')
        })
    }
    
    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  const toggleBgm = () => {
    if (!audioRef.current) return
    
    if (bgmPlaying) {
      audioRef.current.pause()
      setBgmPlaying(false)
    } else {
      audioRef.current.play()
        .then(() => setBgmPlaying(true))
        .catch((err) => console.log('播放失败:', err))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isThinking) return

    const userMessage = input.trim()
    setInput('')
    setIsThinking(true)
    setThinkingText(getRandomThinkingMessage())
    setMenuOpen(false)
    setErrorMsg('')

    let index = 0
    thinkingIntervalRef.current = setInterval(() => {
      index = (index + 1) % THINKING_MESSAGES.length
      setThinkingText(THINKING_MESSAGES[index])
    }, 2000)

    const delay = getRandomDelay()

    setTimeout(async () => {
      try {
        // 千帆 RPC 接口不支持 system 角色，将系统提示合并到用户消息中
        const messages = [
          { role: 'user', content: `${SYSTEM_PROMPT}\n\n用户问题：${userMessage}` }
        ]

        const response = await fetchChatResponse(messages)
        clearInterval(thinkingIntervalRef.current)
        setIsThinking(false)
        setMessageKey((prev) => prev + 1)
        setCurrentMessage((response || '').trim())
      } catch (error) {
        console.error('获取回复失败:', error)
        clearInterval(thinkingIntervalRef.current)
        setIsThinking(false)
        setMessageKey((prev) => prev + 1)
        const errorMessage = error?.response?.data?.error?.message
          || error?.message
          || '未知错误'
        setErrorMsg(`[${error?.response?.status || '?'}] ${errorMessage}`)
        setCurrentMessage('世界尽头的风太大了，吹乱了谈话。咖啡师正去关窗，请稍等片刻。')
      }
    }, delay)
  }

  useEffect(() => {
    return () => {
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current)
    }
  }, [])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#020617]">
      {/* 背景：咖啡馆图 + 深色渐变叠层（保留原站深色氛围） */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${CAFE_BG_URL})` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0f172a]/92 via-[#0f172a]/88 to-[#020617]/95" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#020617_75%)] opacity-60" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* 主内容区：占满剩余高度，文案垂直居中 */}
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8">
          <div className="flex w-full max-w-xl flex-1 flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {isThinking ? (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                  animate={{ opacity: 0.6, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="text-center"
                >
                  <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-white/60 md:text-xl">
                    {thinkingText}
                  </p>
                  <motion.div
                    className="mt-6 flex justify-center gap-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-white/40"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key={messageKey}
                  initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="w-full rounded-2xl bg-black/30 px-6 py-8 text-center backdrop-blur-md"
                >
                  {!currentMessage ? (                    <div className="mx-auto max-w-md space-y-4 text-left sm:text-center">
                      {WELCOME_LINES.map((line, i) => (
                        <motion.p
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.08 * i, duration: 0.6 }}
                          className="font-serif text-base leading-relaxed text-white/80 md:text-lg"
                        >
                          {line}
                        </motion.p>
                      ))}
                      <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55, duration: 0.6 }}
                        onClick={() => setMenuOpen(true)}
                        className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 font-serif text-sm text-white/70 backdrop-blur-md transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white/90"
                      >
                        <span>查看菜单</span>
                        <span className="text-white/40">→</span>
                      </motion.button>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                        <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-white/90 md:text-xl">
                          {currentMessage}
                        </p>
                      </div>
                      {errorMsg && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-400/80"
                        >
                          {errorMsg}
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* 输入区：固定在视口底部上方 5vh */}
        <div
          className="relative z-20 w-full shrink-0 px-4"
          style={{ paddingBottom: '5vh' }}
        >
          <div className="mx-auto w-full max-w-xl">
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="说些什么..."
                disabled={isThinking}
                className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-3 pr-12 font-serif text-base text-white/90 outline-none backdrop-blur-xl transition-all duration-300 placeholder:text-white/30 focus:border-white/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isThinking}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-all duration-300 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg
                  className="h-4 w-4 text-white/70"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 backdrop-blur-md">
              <p className="font-serif text-xs tracking-wider text-white/40">
                离开之后，一切都会消散
              </p>
              {BGM_URL && (
                <button
                  type="button"
                  onClick={toggleBgm}
                  style={{
                    backgroundColor: bgmPlaying ? 'rgba(251, 191, 36, 0.2)' : 'transparent',
                    color: bgmPlaying ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    border: bgmPlaying ? '1px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {bgmPlaying ? '♪ 暂停音乐' : '♪ 播放音乐'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-1 font-serif text-xs tracking-wider text-white/60 transition-all hover:border-amber-400/50 hover:bg-amber-400/10 hover:text-amber-400"
              >
                菜单
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 菜单浮层：固定高度面板 + 内部滚动 */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="咖啡馆菜单"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="flex max-h-[min(78vh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a]/90 shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="font-serif text-lg text-white">今夜酒单</h2>
                  <p className="mt-0.5 font-serif text-[10px] tracking-[0.25em] text-white/50">
                    MENU · TONIGHT
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-white/15 px-3 py-1 font-serif text-xs text-white/50 transition-colors hover:border-white/25 hover:text-white/75"
                >
                  关闭
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                <div className="space-y-0 text-left">
                  {MENU_ITEMS.map((item, index) => {
                    if (item.type === 'category') {
                      return (
                        <div key={index} className="mb-3 mt-8 first:mt-0">
                          <p className="font-serif text-sm tracking-wide text-white/80">
                            — {item.text} —
                          </p>
                          {item.sub && (
                            <p className="mt-1 pl-1 font-serif text-[10px] italic text-white/40">
                              {item.sub}
                            </p>
                          )}
                        </div>
                      )
                    }
                    if (item.type === 'divider') {
                      return (
                        <div
                          key={index}
                          className="my-4 border-t border-dashed border-white/20"
                        />
                      )
                    }
                    if (item.type === 'question') {
                      return (
                        <div
                          key={item.id ?? index}
                          className="my-5 rounded-lg border border-white/25 bg-white/[0.06] px-4 py-3"
                        >
                          <p className="font-serif text-sm italic text-white/90">
                            {item.text}
                          </p>
                          <p className="mt-1 font-serif text-[11px] text-white/50">
                            {item.note}
                          </p>
                        </div>
                      )
                    }
                    if (item.type === 'footer') {
                      return (
                        <p
                          key={index}
                          className="mt-8 pb-2 text-center font-serif text-[10px] leading-relaxed text-white/40"
                        >
                          {item.text}
                        </p>
                      )
                    }
                    return (
                      <div
                        key={index}
                        className="group border-b border-white/[0.08] py-3 last:border-0"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-serif text-[15px] text-white">
                            {item.name}
                          </span>
                          {item.meta && (
                            <span className="shrink-0 font-serif text-[10px] text-white/40">
                              {item.meta}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-serif text-xs leading-relaxed text-white/60">
                          {item.desc}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
