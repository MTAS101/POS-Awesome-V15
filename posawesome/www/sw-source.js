import { precacheAndRoute } from "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-precaching.prod.js";
import { registerRoute, setDefaultHandler } from "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-routing.prod.js";
import { NetworkFirst, StaleWhileRevalidate } from "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-strategies.prod.js";

precacheAndRoute(self.__WB_MANIFEST);

// Cache application pages
registerRoute(({ request }) => request.mode === "navigate", new NetworkFirst({ cacheName: "pages-cache" }));

// Cache JS and CSS
registerRoute(
	({ request }) => request.destination === "script" || request.destination === "style",
	new StaleWhileRevalidate({ cacheName: "assets-cache" }),
);

// Fallback to offline page when navigation fails
setDefaultHandler(async ({ event }) => {
	try {
		return await fetch(event.request);
	} catch (err) {
		const cache = await caches.open("pages-cache");
		return await cache.match("/offline.html");
	}
});
