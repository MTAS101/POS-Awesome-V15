import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/assets/posawesome/",
  plugins: [vue()],
  build: {
    outDir: "posawesome/public",
    assetsDir: ".",
    cssCodeSplit: true,
    rollupOptions: {
      input: "posawesome/public/posawesome.bundle.js",
      output: {
        entryFileNames: "posawesome.bundle.js",
        assetFileNames: "posawesome.css",
        chunkFileNames: "[name]-[hash].js"
      }
    }
  }
});
