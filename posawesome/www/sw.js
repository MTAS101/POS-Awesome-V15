importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js");

const { precaching, routing, strategies } = workbox;
const { precacheAndRoute } = precaching;
const { registerRoute, setCatchHandler } = routing;
const { NetworkFirst, StaleWhileRevalidate } = strategies;

precacheAndRoute([{"revision":"d882d32fc586c1c56dfb0ff4c9ca9ff9","url":"manifest.json"},{"revision":"de35420b35ebe9d252e43e4802b2287b","url":"offline.html"},{"revision":"b93b0f3bad1848ad38b2aa6cab11265e","url":"sw-old.js"},{"revision":null,"url":"/app/posapp"},{"revision":null,"url":"/assets/posawesome/js/posawesome.bundle.js"},{"revision":null,"url":"/assets/posawesome/js/offline/index.js"},{"revision":null,"url":"/assets/posawesome/js/posapp/workers/itemWorker.js"},{"revision":null,"url":"/assets/posawesome/js/libs/dexie.min.js"}]);

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
               const cached = await caches.match(event.request, { ignoreSearch: true });
               return (
                       cached ||
                       (await caches.match("/app/posapp")) ||
                       (await caches.match("/offline.html")) ||
                       Response.error()
               );
       }
       return Response.error();
});

// Activate new service worker immediately and take control of open clients
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
