import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf-8'),
) as { version: string }

export default defineConfig({
  main: {
    build: { outDir: 'out/main', rollupOptions: { external: ['ws'] } },
  },
  preload: {
    build: { outDir: 'out/preload' },
  },
  renderer: {
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: { outDir: 'out/renderer' },
  },
})
