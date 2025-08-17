import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import frappeVueStyle from "../frappe-vue-style";

export default defineConfig({
  plugins: [frappeVueStyle(), vue()],
  build: {
    target: "esnext",
    lib: {
      entry: resolve(__dirname, "src/posawesome.bundle.js"),
      name: "PosAwesome",
      fileName: "posawesome",
    },
    outDir: "../posawesome/public/dist/js",
    emptyOutDir: true,
    rollupOptions: {
      external: ["socket.io-client"],
      output: [
        {
          format: "es",
          entryFileNames: "posawesome.js",
        },
        {
          format: "umd",
          name: "PosAwesome",
          entryFileNames: "posawesome.umd.js",
          globals: {
            "socket.io-client": "io",
          },
        },
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    process: '{"env":{}}',
  },
});
