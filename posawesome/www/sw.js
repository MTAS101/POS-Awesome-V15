try {
	importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");
} catch (err) {
	importScripts("/workbox-sw.js");
}

const CACHE_NAME = "posawesome-cache-v1";
const CACHE_VERSION = "1.0.0";
const PRECACHE_RESOURCES = [
        { url: "/app/posapp", revision: CACHE_VERSION },
        { url: "/assets/posawesome/js/posawesome.bundle.js", revision: CACHE_VERSION },
        { url: "/assets/posawesome/js/offline/index.js", revision: CACHE_VERSION },
        { url: "/assets/posawesome/js/posapp/workers/itemWorker.js", revision: CACHE_VERSION },
        { url: "/assets/posawesome/js/libs/dexie.min.js", revision: CACHE_VERSION },
        { url: "/manifest.json", revision: CACHE_VERSION },
        { url: "/offline.html", revision: CACHE_VERSION },
];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

workbox.precaching.precacheAndRoute(PRECACHE_RESOURCES);

const cachePlugin = new workbox.expiration.ExpirationPlugin({
	maxEntries: 1000,
});

workbox.routing.registerRoute(
        ({ request }) => request.mode === "navigate",
        new workbox.strategies.NetworkFirst({
                cacheName: CACHE_NAME,
                plugins: [cachePlugin],
        }),
);

// Use network-first strategy for API calls to ensure fresh data when online
workbox.routing.registerRoute(
        ({ url }) => url.pathname.startsWith("/api/"),
        new workbox.strategies.NetworkFirst({
                cacheName: CACHE_NAME,
                plugins: [cachePlugin],
        })
);

workbox.routing.registerRoute(
        ({ url, request }) =>
                request.mode !== "navigate" &&
                !url.pathname.startsWith("/api/") &&
                (url.protocol === "http:" || url.protocol === "https:") &&
                !url.href.includes("socket.io"),
        new workbox.strategies.CacheFirst({
                cacheName: CACHE_NAME,
                plugins: [cachePlugin],
	}),
);

workbox.routing.setCatchHandler(async ({ event }) => {
	if (event.request.destination === "document") {
		return (await caches.match("/app/posapp")) || (await caches.match("/offline.html"));
	}
	return Response.error();
});
