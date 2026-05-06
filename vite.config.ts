import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/ks': {
        target: 'https://test1.tepc.cn/jetopcms',
        changeOrigin: true,
        secure: false,
        headers: {
          'host': 'localhost',
        },
      },
      '/editor': {
        target: 'https://test1.tepc.cn/jetopcms',
        changeOrigin: true,
        secure: false,
        headers: {
          'host': 'localhost',
        },
      },
    },
  },
})
