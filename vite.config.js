import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'

export default defineConfig({
    plugins: [
        vue(),
        createSvgIconsPlugin({
            // Specify the icon folder to be cached
            iconDirs: [resolve(__dirname, 'posawesome/public/icons/mdi')],
            // Specify symbolId format
            symbolId: 'mdi-[name]',
            // Generate corresponding components
            svgoOptions: {
                plugins: [
                    {
                        name: 'removeAttrs',
                        params: { attrs: ['class', 'data-name', 'fill', 'stroke'] }
                    }
                ]
            }
        })
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'posawesome/public/js/posawesome.bundle.js'),
            name: 'PosAwesome',
            fileName: 'posawesome'
        },
        outDir: 'posawesome/public/dist/js',
        emptyOutDir: true,
        rollupOptions: {
            external: ['socket.io-client'],
            output: {
                globals: {
                    'socket.io-client': 'io'
                }
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'posawesome/public/js')
        }
    }
})