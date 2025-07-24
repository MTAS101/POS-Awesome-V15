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
               target: "es2015",
               manifest: true,
               outDir: "posawesome/public/dist",
               emptyOutDir: true,
               cssCodeSplit: true,
               rollupOptions: {
                       input: resolve(__dirname, "posawesome/public/js/posawesome.bundle.js"),
                       external: ["socket.io-client"],
                       output: {
                               format: "iife",
                               inlineDynamicImports: true,
                               entryFileNames: "js/[name].[hash].js",
                               assetFileNames: ({name}) => {
                                       if (name && name.endsWith(".css")) {
                                               return "css/[name].[hash][extname]";
                                       }
                                       return "assets/[name].[hash][extname]";
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
