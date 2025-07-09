import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/joinilo/',         // ← 이미 추가함!
  build: {
    outDir: 'docs',          // ← 이거만 더 추가!
  },
})