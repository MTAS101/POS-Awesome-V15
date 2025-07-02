import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'esnext',
    lib: {
      entry: resolve(__dirname, 'src/posawesome.bundle.js'),
      name: 'PosAwesome',
      fileName: () => 'posawesome.js',
      formats: ['umd']
    },
    outDir: '../posawesome/public/dist/js',
    emptyOutDir: true,
    rollupOptions: {
      external: ['socket.io-client'],
      output: {
        entryFileNames: 'posawesome.js',
        globals: {
          'socket.io-client': 'io'
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
