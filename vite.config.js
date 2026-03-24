import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/cafe-at-the-worlds-end/',
  plugins: [react()],
  server: {
    proxy: {
      // 当你请求 /baidu-api 时，Vite 会自动转发到百度服务器
      '/baidu-api': {
        target: 'https://aip.baidubce.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/baidu-api/, '')
      }
    }
  }
})