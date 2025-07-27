import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
	plugins: [vue()],
	server: {
		port: 3000,
		host: true,
		open: false,
	},
	build: {
		target: "esnext",
		lib: {
			entry: resolve(__dirname, "posawesome/public/js/posawesome.bundle.js"),
			name: "PosAwesome",
			fileName: "posawesome.bundle",
			formats: ['umd'],
		},
		outDir: "posawesome/public/dist/js",
		emptyOutDir: true,
		rollupOptions: {
			external: ["socket.io-client"],
			output: {
				globals: {
					"socket.io-client": "io",
				},
				assetFileNames: (assetInfo) => {
					if (assetInfo.name.endsWith('.css')) {
						return 'posawesome.css';
					}
					return assetInfo.name;
				},
			},
		},
		cssCodeSplit: false,
		sourcemap: true,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "posawesome/public/js"),
		},
	},
	css: {
		devSourcemap: true,
	},
});
