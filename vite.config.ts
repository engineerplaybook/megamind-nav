import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'public',
    emptyOutDir: false,
    lib: {
      entry: './src/main.tsx',
      name: 'CommonNav',
      fileName: () => 'common-nav.js',
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        assetFileNames: 'common-nav.css',
      },
    },
  },
})
