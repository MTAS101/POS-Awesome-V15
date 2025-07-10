import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
    root: __dirname,
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.js',
            injectRegister: null,
            injectManifest: {
                injectionPoint: null
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    build: {
        // Output compiled assets to the Frappe app's public directory
        outDir: '../posawesome/public/frontend',
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            output: {
                // Keep a stable filename so hooks.py and the service worker
                // can reference the built file consistently
                entryFileNames: 'main.js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
            }
        }
    },
    server: {
        port: 8080,
        proxy: {
            '^/(app|login|api|assets|files|private)': {
                target: 'http://127.0.0.1:8000',
                ws: true
            }
        }
    }
});
