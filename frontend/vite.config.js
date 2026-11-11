import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Bỏ header Origin khi chuyển tiếp: trình duyệt chỉ gọi cùng địa chỉ với giao diện,
// nên mở bằng điện thoại trong mạng LAN cũng không bị chặn CORS.
const noOrigin = (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin'))

const proxy = {
  '/api': { target: 'http://localhost:3000', changeOrigin: true, configure: noOrigin },
  '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
  '/ai': { target: 'http://localhost:3001', changeOrigin: true, rewrite: (p) => p.replace(/^\/ai/, ''), configure: noOrigin },
  '/nv5': { target: 'http://localhost:3005', changeOrigin: true, rewrite: (p) => p.replace(/^\/nv5/, ''), configure: noOrigin }
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, proxy },
  preview: { port: 4173, host: true, proxy }
})
