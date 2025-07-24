import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import frappeui from "frappe-ui/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import fs from "fs";

const manifest = JSON.parse(
       fs.readFileSync(path.resolve(__dirname, "posawesome/www/manifest.json"), "utf-8")
);

export default defineConfig({
        root: path.resolve(__dirname, "posawesome/frontend"),
       server: {
               proxy: getProxyOptions(),
               fs: {
                       allow: [
                               path.resolve(__dirname, "posawesome/public"),
                               path.resolve(__dirname, "posawesome/frontend")
                       ]
               }
       },
        plugins: [
                vue(),
               frappeui({
                       buildConfig: {
                               outDir: path.resolve(__dirname, "posawesome/public/frontend"),
                               indexHtmlPath: path.resolve(__dirname, "posawesome/www/index.html"),
                       },
                       frappeProxy: false,
                       lucideIcons: true,
                       frappeTypes: true,
                       jinjaBootData: true,
               }),
               VitePWA({
                       registerType: "autoUpdate",
                       strategies: "generateSW",
                       filename: "sw.js",
                       injectRegister: null,
                       devOptions: {
                               enabled: true,
                       },
                       manifest,
               }),
        ],
        resolve: {
               alias: {
                       "@": path.resolve(__dirname, "posawesome/frontend/src"),
                       "@public": path.resolve(__dirname, "posawesome/public/js"),
               },
       },
        build: {
                outDir: path.resolve(__dirname, "posawesome/public/frontend"),
                emptyOutDir: true,
                target: "es2015",
                commonjsOptions: {
                        include: [/tailwind.config.js/, /node_modules/],
                },
                sourcemap: true,
               rollupOptions: {
                        output: {
                                manualChunks: {
                                        "frappe-ui": ["frappe-ui"],
                                },
                        },
                },
        },
        optimizeDeps: {
                include: [
                        "frappe-ui > feather-icons",
                        "showdown",
                        "tailwind.config.js",
                        "engine.io-client",
                ],
        },
})

function getProxyOptions() {
        const config = getCommonSiteConfig()
        const webserver_port = config ? config.webserver_port : 8000
        if (!config) {
                console.log("No common_site_config.json found, using default port 8000")
        }
        return {
                "^/(app|login|api|assets|files|private)": {
                        target: `http://127.0.0.1:${webserver_port}`,
                        ws: true,
                        router: function (req) {
                                const site_name = req.headers.host.split(":")[0]
                                console.log(`Proxying ${req.url} to ${site_name}:${webserver_port}`)
                                return `http://${site_name}:${webserver_port}`
                        },
                },
        }
}

function getCommonSiteConfig() {
        let currentDir = path.resolve(".")
        // traverse up till we find frappe-bench with sites directory
        while (currentDir !== "/") {
                if (
                        fs.existsSync(path.join(currentDir, "sites")) &&
                        fs.existsSync(path.join(currentDir, "apps"))
                ) {
                        let configPath = path.join(currentDir, "sites", "common_site_config.json")
                        if (fs.existsSync(configPath)) {
                                return JSON.parse(fs.readFileSync(configPath))
                        }
                        return null
                }
                currentDir = path.resolve(currentDir, "..")
        }
        return null
}
