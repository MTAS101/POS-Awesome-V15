const fs = require("fs");

try {
       fs.rmSync("./posawesome/dist", { recursive: true, force: true });
} catch {
       /* ignore */
}

console.log("⚠️ esbuild skipped: using Vite build system.");
process.exit(0);
