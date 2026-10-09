import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 127.0.0.1, not localhost: Node resolves localhost to ::1 first and uvicorn binds IPv4.
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
