import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import frappeVueStyle from './frappe-vue-style.vite.js';

export default defineConfig({
        plugins: [frappeVueStyle(), vue()],
       build: {
               outDir: 'posawesome/public/js',
               cssCodeSplit: true,
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
                        "@": resolve(__dirname, "posawesome/public/js"),
                },
        },
});
