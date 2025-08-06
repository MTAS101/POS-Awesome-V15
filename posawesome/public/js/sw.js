if (!self.define) {
	try {
		importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");
	} catch (e) {
		importScripts("/assets/posawesome/js/libs/workbox-sw.js");
	}
}

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

workbox.core.clientsClaim();

const SW_REVISION = "1";

async function precacheAssets() {
	const assets = [
		{ url: "/manifest.json", revision: SW_REVISION },
		{ url: "/offline.html", revision: SW_REVISION },
	];
	try {
		const manifest = await fetch("/assets/posawesome/dist/js/manifest.json").then((res) => res.json());
		Object.values(manifest).forEach((item) => {
			assets.push({
				url: `/assets/posawesome/dist/js/${item.file}`,
				revision: SW_REVISION,
			});
		});
	} catch (e) {
		console.error("Failed to load manifest", e);
	}
	workbox.precaching.precacheAndRoute(assets);
}

self.addEventListener("install", (event) => {
	event.waitUntil(precacheAssets());
});

workbox.routing.registerRoute(
	({ url }) => url.pathname.startsWith("/api/"),
	new workbox.strategies.NetworkFirst({ cacheName: "api-cache", networkTimeoutSeconds: 3 }),
);

workbox.routing.registerRoute(
	({ request }) => ["script", "style", "document"].includes(request.destination),
	new workbox.strategies.StaleWhileRevalidate(),
);
