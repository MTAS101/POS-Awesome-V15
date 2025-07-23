import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, setDefaultHandler } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

precacheAndRoute([{"revision":"d882d32fc586c1c56dfb0ff4c9ca9ff9","url":"manifest.json"},{"revision":"0b2f8fe6908c2bc1aa82bc5593f15bd1","url":"offline.html"},{"revision":"b93b0f3bad1848ad38b2aa6cab11265e","url":"sw-old.js"}]);

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
