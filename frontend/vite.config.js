import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' //

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // This replaces the need for npx init
  ],
})