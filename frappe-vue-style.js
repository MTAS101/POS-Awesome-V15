module.exports = function frappeVueStyle() {
        return {
                name: "frappe-vue-style",
                setup(build) {
                        build.onLoad({ filter: /\.vue$/ }, async (args) => {
                                const fs = require("fs");
                                const contents = await fs.promises.readFile(args.path, "utf8");
                                const styleMatch = contents.match(/<style[^>]*>([\s\S]*?)<\/style>/);
                                if (styleMatch) {
                                        const stylePath = args.path + ".css";
                                        await fs.promises.writeFile(stylePath, styleMatch[1]);
                                        return { contents, loader: "vue" };
                                }
                                return { contents, loader: "vue" };
                        });

                        build.onEnd((result) => {
                                if (!result.metafile || !result.metafile.outputs) return;
                                const files = Object.keys(result.metafile.outputs);
                                for (const file of files) {
                                        if (file.endsWith(".vue.css")) {
                                                try {
                                                        require("fs").unlinkSync(file);
                                                } catch (e) {
                                                        // ignore
                                                }
                                        }
                                }
                        });
                },
        };
};
