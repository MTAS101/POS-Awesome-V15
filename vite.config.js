import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import fs from "fs";

export default defineConfig({
       server: {
               port: 8080,
               proxy: getProxyOptions(),
       },
       plugins: [vue()],
       build: {
               target: "esnext",
               lib: {
                       entry: path.resolve(__dirname, "posawesome/public/js/posawesome.bundle.js"),
                       name: "PosAwesome",
                       fileName: "posawesome",
               },
               outDir: "posawesome/public/dist/js",
               emptyOutDir: true,
               sourcemap: true,
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
                       "@": path.resolve(__dirname, "posawesome/public/js"),
               },
       },
});

function getProxyOptions() {
       const config = getCommonSiteConfig();
       const webserver_port = config ? config.webserver_port : 8000;
       if (!config) {
               console.log("No common_site_config.json found, using default port 8000");
       }
       return {
               "^/(app|login|api|assets|files|private)": {
                       target: `http://127.0.0.1:${webserver_port}`,
                       ws: true,
                       router: function (req) {
                               const site_name = req.headers.host.split(":")[0];
                               console.log(`Proxying ${req.url} to ${site_name}:${webserver_port}`);
                               return `http://${site_name}:${webserver_port}`;
                       },
               },
       };
}

function getCommonSiteConfig() {
       let currentDir = path.resolve(".");
       while (currentDir !== "/") {
               if (
                       fs.existsSync(path.join(currentDir, "sites")) &&
                       fs.existsSync(path.join(currentDir, "apps"))
               ) {
                       let configPath = path.join(currentDir, "sites", "common_site_config.json");
                       if (fs.existsSync(configPath)) {
                               return JSON.parse(fs.readFileSync(configPath));
                       }
                       return null;
               }
               currentDir = path.resolve(currentDir, "..");
       }
       return null;
}
