import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'

// 頁尾右下角的版本號：讀 package.json 的 version
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  base: './',
  plugins: [vue()],
  server: { port: 8081, open: true },
})
