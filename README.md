# 世界尽头的咖啡馆

一个极简主义的 AI 对话单页应用。

## 功能特性

- 全屏深色渐变背景，营造安静、书卷气的氛围
- 衬线体字体，带来温和的阅读体验
- Framer Motion 动画：新消息浮现、旧消息淡出
- 1-2 秒随机延迟 + 咖啡师思考提示语
- 阅后即焚：新消息覆盖旧消息，无历史记录
- 毛玻璃效果药丸形输入框
- 安全配置：API 密钥通过 AES-256-CBC 加密存储

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置千帆 API（加密方式）

使用加密脚本生成安全的配置文件：

```javascript
// encryptConfig.js
import crypto from 'crypto';
import fs from 'fs';

const rawConfig = {
  access_key: '你的Access Key',
  secret_key: '你的Secret Key',
  model_name: 'ernie-speed-128k',
  token_url: '/baidu-api/oauth/2.0/token',
  chat_url: '/baidu-api/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-speed-128k'
};

const SECRET_KEY = crypto
  .createHash('sha256')
  .update('your-super-secret-key')  // 修改为你自己的密钥
  .digest();

const iv = crypto.randomBytes(16);

function encrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

const output = {
  iv: iv.toString('base64'),
  data: encrypt(JSON.stringify(rawConfig))
};

fs.writeFileSync('./public/secure-config.json', JSON.stringify(output, null, 2));
console.log('✅ secure-config.json 已生成');
```

修改加密脚本中的密钥后运行：

```bash
node encryptConfig.js
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 构建生产版本

```bash
npm run build
npm run preview
```

## 部署到 GitHub Pages

### 1. 创建 GitHub 仓库

在 GitHub 上创建新仓库（如 `cafe-at-the-end-of-the-world`）。

### 2. 修改 Vite 配置

编辑 `vite.config.js`，添加 base 配置：

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/cafe-at-the-end-of-the-world/',  // 修改为你的仓库名
  plugins: [react()],
  server: {
    proxy: {
      '/baidu-api': {
        target: 'https://aip.baidubce.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/baidu-api/, '')
      }
    }
  }
})
```

### 3. 推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/cafe-at-the-end-of-the-world.git
git push -u origin main
```

### 4. 配置 GitHub Pages

1. 进入仓库 **Settings** → **Pages**
2. Source 选择 **Deploy from a branch**
3. Branch 选择 **main** 和 **/ (root)**
4. 点击 **Save**

### 5. 等待部署

几分钟后访问 `https://你的用户名.github.io/cafe-at-the-end-of-the-world/`

## 项目结构

```
├── public/
│   ├── cafe-bg.png       # 背景图
│   ├── bgm.mp3           # 背景音乐（可选）
│   └── secure-config.json # 加密的 API 配置
├── src/
│   ├── main.jsx          # React 入口
│   ├── index.css         # 全局样式
│   ├── App.jsx           # 主应用组件
│   └── config.js         # 配置加载器
├── package.json          # 依赖配置
├── vite.config.js        # Vite 配置
├── tailwind.config.js    # Tailwind 配置
└── postcss.config.js     # PostCSS 配置
```

## 技术栈

- React 18
- Tailwind CSS 3
- Framer Motion 11
- Vite 5
- 百度千帆 API
- Web Crypto API（AES-256-CBC 加密）
