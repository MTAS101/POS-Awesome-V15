import { execSync } from "child_process";
import { readdirSync, copyFileSync, existsSync, statSync } from "fs";
import { resolve, join } from "path";

// Configuration
const CONFIG = {
    distDir: "posawesome/public/dist/js",
    finalDir: "posawesome/public/js",
    bundlePrefix: "posawesome.bundle.",
    bundleSuffix: ".umd.cjs",
    targetBundle: "posawesome.bundle.js",
    commands: {
        install: "yarn install",
        build: "yarn build"
    }
};

// Utility functions
const log = (message, type = "info") => {
    const timestamp = new Date().toISOString();
    const prefix = type === "error" ? "ERROR" : type === "success" ? "SUCCESS" : "INFO";
    console.log(`[${prefix}] [${timestamp}] ${message}`);
};

const executeCommand = (command, description) => {
    try {
        log(`Starting: ${description}`);
        execSync(command, { stdio: "inherit" });
        log(`Completed: ${description}`, "success");
    } catch (error) {
        log(`Failed: ${description} - ${error.message}`, "error");
        throw error;
    }
};

const findBundleFile = (directory) => {
    if (!existsSync(directory)) {
        throw new Error(`Directory does not exist: ${directory}`);
    }

    const files = readdirSync(directory);
    const bundleFile = files.find(file =>
        file.startsWith(CONFIG.bundlePrefix) &&
        file.endsWith(CONFIG.bundleSuffix)
    );

    if (!bundleFile) {
        throw new Error(`No bundle file found in ${directory}. Available files: ${files.join(", ")}`);
    }

    return bundleFile;
};

const copyBundleFile = (sourceFile, targetFile) => {
    try {
        // Check if source file exists and is readable
        if (!existsSync(sourceFile)) {
            throw new Error(`Source file does not exist: ${sourceFile}`);
        }

        const sourceStats = statSync(sourceFile);
        if (sourceStats.size === 0) {
            throw new Error(`Source file is empty: ${sourceFile}`);
        }

        // Copy the file
        copyFileSync(sourceFile, targetFile);

        // Verify the copy was successful
        const targetStats = statSync(targetFile);
        if (targetStats.size !== sourceStats.size) {
            throw new Error(`File copy verification failed. Source: ${sourceStats.size} bytes, Target: ${targetStats.size} bytes`);
        }

        log(`Successfully copied ${sourceFile} to ${targetFile} (${sourceStats.size} bytes)`, "success");
    } catch (error) {
        log(`Failed to copy bundle file: ${error.message}`, "error");
        throw error;
    }
};

const cleanupOldFiles = (directory) => {
    try {
        const files = readdirSync(directory);
        const oldBundleFiles = files.filter(file =>
            file.startsWith(CONFIG.bundlePrefix) &&
            file.endsWith(CONFIG.bundleSuffix) &&
            file !== CONFIG.targetBundle
        );

        if (oldBundleFiles.length > 0) {
            log(`Found ${oldBundleFiles.length} old bundle files, cleaning up...`);
            // Note: In a production environment, you might want to archive instead of delete
        }
    } catch (error) {
        log(`Warning: Could not cleanup old files: ${error.message}`);
    }
};

// Main build process
const main = async () => {
    const startTime = Date.now();

    try {
        log("Starting PosAwesome build process");

        // Step 1: Install dependencies
        executeCommand(CONFIG.commands.install, "Installing dependencies");

        // Step 2: Build with Vite
        executeCommand(CONFIG.commands.build, "Building application with Vite");

        // Step 3: Process built files
        log("Processing built files...");
        const distDir = resolve(CONFIG.distDir);

        // Find the bundle file
        const bundleFile = findBundleFile(distDir);
        log(`Found bundle file: ${bundleFile}`);

        // Copy to expected name
        const sourcePath = resolve(distDir, bundleFile);
        const targetPath = resolve(CONFIG.finalDir, CONFIG.targetBundle);
        copyBundleFile(sourcePath, targetPath);

        // Cleanup old files (optional)
        cleanupOldFiles(distDir);

        const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
        log(`Build completed successfully in ${buildTime}s`, "success");

    } catch (error) {
        const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
        log(`Build failed after ${buildTime}s: ${error.message}`, "error");
        process.exit(1);
    }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`, "error");
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled rejection at ${promise}: ${reason}`, "error");
    process.exit(1);
});

// Run the build
main();
