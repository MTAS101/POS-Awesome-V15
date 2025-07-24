const { execSync } = require("child_process");

console.log("Installing dependencies...");
execSync("yarn install", { stdio: "inherit" });

console.log("Building the application with Vite...");
execSync("npx vite build", { stdio: "inherit" });
