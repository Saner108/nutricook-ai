import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/nutricook-ai/",
  plugins: [react()],
})
