import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import frappeVueStyle from './frappe-vue-style.vite.js';

export default defineConfig({
  plugins: [frappeVueStyle(), vue()],
  base: '/assets/posawesome/js/',
  build: {
    outDir: 'posawesome/public/js',
    assetsDir: '.',
    cssCodeSplit: true,
    emptyOutDir: false,
    rollupOptions: {
      input: 'posawesome/public/js/posawesome.bundle.js',
      output: {
        entryFileNames: 'posawesome.bundle.js',
        assetFileNames: 'posawesome.css'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'posawesome/public/js'),
    },
  },
});
