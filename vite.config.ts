import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // メインプロセス
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist/electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        // Preloadスクリプト
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist/electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
        onstart(args) {
          args.reload()
        },
      },
    ]),
  ],
  base: './',
  build: {
    outDir: 'dist/renderer',
  },
})
