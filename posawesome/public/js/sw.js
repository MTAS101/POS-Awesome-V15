try {
	importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");
} catch (err) {
	importScripts("/assets/posawesome/js/workbox-sw.js");
}

const CACHE_NAME = "posawesome-cache-v1";
const PRECACHE_RESOURCES = [
	"/assets/posawesome/js/posawesome.bundle.js",
	"/assets/posawesome/js/offline/index.js",
	"/manifest.json",
	"/offline.html",
];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

workbox.precaching.precacheAndRoute(PRECACHE_RESOURCES);

const cachePlugin = new workbox.expiration.ExpirationPlugin({
	maxEntries: 1000,
});

workbox.routing.registerRoute(
	({ url, request }) =>
		request.mode !== "navigate" &&
		(url.protocol === "http:" || url.protocol === "https:") &&
		!url.href.includes("socket.io"),
	new workbox.strategies.CacheFirst({
		cacheName: CACHE_NAME,
		plugins: [cachePlugin],
	}),
);

workbox.routing.setCatchHandler(async ({ event }) => {
	if (event.request.destination === "document") {
		return await caches.match("/offline.html");
	}
	return Response.error();
});
