import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import frappeVueStyle from './frappe-vue-style.vite.js';

export default defineConfig({
        plugins: [frappeVueStyle(), vue()],
       build: {
               target: "esnext",
               outDir: "posawesome/public/js",
               cssCodeSplit: true,
               lib: {
                       entry: resolve(__dirname, "posawesome/public/js/posawesome.bundle.js"),
                       name: "PosAwesome",
                       fileName: () => "posawesome.bundle.js",
                       formats: ["es", "umd"],
               },
               emptyOutDir: true,
               rollupOptions: {
                        external: ["socket.io-client", "dexie"],
                        output: {
                                assetFileNames: () => "posawesome.css",
                                globals: {
                                        "socket.io-client": "io",
                                        dexie: "Dexie",
                                },
                        },
                },
       },
	resolve: {
		alias: {
			"@": resolve(__dirname, "posawesome/public/js"),
		},
	},
});
