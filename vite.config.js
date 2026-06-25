import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0', // 监听所有网卡，暴露局域网IP
    port: 5173,       // 可选：自定义端口
    open: true        // 可选：自动打开浏览器
  }
})
