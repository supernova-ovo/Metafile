import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
  ],
  server: {
    proxy: {
      '/ks': {
        target: 'https://test1.tepc.cn/jetopcms',
        changeOrigin: true,
        secure: false,
      },
      '/editor': {
        target: 'https://test1.tepc.cn/jetopcms',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
