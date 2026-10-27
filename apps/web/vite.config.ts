/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const apiTarget = process.env.INSPIRATIO_API_URL ?? 'http://localhost:4319'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: Number(process.env.INSPIRATIO_WEB_PORT ?? 5319),
    strictPort: true,
    proxy: { '/api': apiTarget, '/media': apiTarget },
  },
  test: {
    name: 'web',
    include: ['src/**/__test__/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/__test__/setup.ts'],
    css: false,
  },
})
