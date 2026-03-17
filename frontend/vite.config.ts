import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const frontendPort = parseInt(process.env.VITE_PORT || '5173')
const backendPort = parseInt(process.env.VITE_API_PORT || '4000')

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        configure: (proxy) => {
          let warned = false
          proxy.on('error', (_err, _req, res) => {
            if (!warned) {
              console.warn('[proxy] 백엔드 서버 연결 안 됨 — 백엔드가 실행 중인지 확인하세요')
              warned = true
              setTimeout(() => { warned = false }, 30000)
            }
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Backend unavailable' }))
            }
          })
        },
      },
    },
  },
})
