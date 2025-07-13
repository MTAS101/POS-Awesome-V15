import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/assets/posawesome/js/',
  plugins: [vue()],
  build: {
    outDir: 'posawesome/public/js',
    assetsDir: '.',
    cssCodeSplit: true,
    emptyOutDir: false,
    rollupOptions: {
      input: {
        'posawesome.bundle': fileURLToPath(
          new URL('./posawesome/public/js/posawesome.bundle.js', import.meta.url)
        ),
        offline: fileURLToPath(
          new URL('./posawesome/public/js/offline/index.js', import.meta.url)
        )
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: 'posawesome.css',
        chunkFileNames: '[name]-[hash].js'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'posawesome/public/js')
    }
  }
});
