import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

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
        'posawesome.bundle': resolve(__dirname, 'posawesome/public/js/posawesome.bundle.js'),
        offline: resolve(__dirname, 'posawesome/public/js/offline/index.js')
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
