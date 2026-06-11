import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  plugins: [react()],
  publicDir: false,
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
