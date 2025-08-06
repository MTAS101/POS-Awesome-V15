import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
	plugins: [vue()],
	build: {
		target: "esnext",
		outDir: "posawesome/public/dist/js",
		emptyOutDir: true,
		manifest: true,
		rollupOptions: {
			input: {
				posawesome: resolve(__dirname, "posawesome/public/js/posawesome.bundle.js"),
				offline: resolve(__dirname, "posawesome/public/js/offline/index.js"),
			},
			external: ["socket.io-client"],
			output: {
				manualChunks: {
					vuetify: ["vuetify"],
				},
				globals: {
					"socket.io-client": "io",
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
