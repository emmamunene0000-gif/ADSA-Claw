import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/webhook': 'http://localhost:3001',
      '/terminal': 'http://localhost:3001',
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist'
  }
})
