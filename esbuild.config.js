const esbuild = require("esbuild");
const vuePlugin = require("unplugin-vue/esbuild");

esbuild
        .build({
                entryPoints: ["posawesome/public/js/posawesome.bundle.js"],
                bundle: true,
                outdir: "posawesome/public/dist/js",
                format: "esm",
                target: "esnext",
                plugins: [vuePlugin()],
                metafile: true,
        })
	.then((result) => {
		console.log("Build outputs:", Object.keys(result.metafile.outputs));
	})
	.catch(() => process.exit(1));
