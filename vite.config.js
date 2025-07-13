import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/assets/posawesome/",        // every file served from here
  plugins: [vue()],
  build: {
    outDir: "posawesome/public",      // write directly under public
    assetsDir: ".",                  // keep css/worker in same dir
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
