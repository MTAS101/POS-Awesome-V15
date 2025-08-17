import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import frappeVueStyle from "./frappe-vue-style";

export default defineConfig({
        plugins: [frappeVueStyle(), vue()],
	build: {
		target: "esnext",
		lib: {
			entry: resolve(__dirname, "posawesome/public/js/posawesome.bundle.js"),
			name: "PosAwesome",
			fileName: "posawesome",
		},
		outDir: "posawesome/public/dist/js",
		emptyOutDir: true,
		rollupOptions: {
			external: ["socket.io-client"],
			output: {
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
        define: {
                "process.env.NODE_ENV": '"production"',
                process: '{"env":{}}',
        },
});
