module.exports = {
        globDirectory: "posawesome/www",
        globPatterns: ["**/*.{js,css,html,png,svg,json}"],
        swSrc: "posawesome/www/sw-source.js",
        swDest: "posawesome/www/sw.js",
        additionalManifestEntries: [
                { url: "/app/posapp", revision: null },
                {
                        url: "/assets/posawesome/js/posawesome.bundle.js",
                        revision: null,
                },
                { url: "/assets/posawesome/js/offline/index.js", revision: null },
                {
                        url: "/assets/posawesome/js/posapp/workers/itemWorker.js",
                        revision: null,
                },
                { url: "/assets/posawesome/js/libs/dexie.min.js", revision: null },
        ],
};
