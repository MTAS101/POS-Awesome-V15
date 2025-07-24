import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { resolve } from "path";

export default defineConfig({
       plugins: [vue(), vuetify({ autoImport: true })],
       define: {
               "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
               "process.env": {},
       },
        build: {
                target: "esnext",
               lib: {
                        entry: resolve(__dirname, "posawesome/public/js/posawesome.bundle.js"),
                        name: "PosAwesome",
                        fileName: () => "posawesome.bundle.js",
                        formats: ["es"],
                },
                outDir: "posawesome/public/dist/js",
                emptyOutDir: true,
               rollupOptions: {
                        external: ["socket.io-client"],
                        output: {
                                inlineDynamicImports: true,
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
