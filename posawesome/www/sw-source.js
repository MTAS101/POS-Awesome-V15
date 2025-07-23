importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js");

const { precaching, routing, strategies } = workbox;
const { precacheAndRoute } = precaching;
const { registerRoute, setCatchHandler } = routing;
const { NetworkFirst, StaleWhileRevalidate } = strategies;

precacheAndRoute(self.__WB_MANIFEST);

// Cache application pages
registerRoute(({ request }) => request.mode === "navigate", new NetworkFirst({ cacheName: "pages-cache" }));

// Cache JS and CSS
registerRoute(
	({ request }) => request.destination === "script" || request.destination === "style",
	new StaleWhileRevalidate({ cacheName: "assets-cache" }),
);

// Fallback to offline page when navigation fails
setCatchHandler(async ({ event }) => {
	if (event.request.mode === "navigate") {
		return (await caches.match("/offline.html")) || Response.error();
	}
	return Response.error();
});
