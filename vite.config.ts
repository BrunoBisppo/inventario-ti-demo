import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' faz o site funcionar em qualquer endereço (GitHub Pages, pasta, servidor interno)
// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
})
