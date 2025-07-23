try {
	importScripts("/assets/posawesome/js/libs/dexie.min.js?v=1");
} catch (e) {
	// fallback to ESM
}

const DexieLib =
	typeof Dexie === "undefined"
		? await import("/assets/posawesome/js/libs/dexie.min.js?v=1")
		: { default: Dexie };
const db = new DexieLib.default("posawesome_offline");
db.version(1).stores({ keyval: "&key" });

async function persist(key, value) {
	try {
		if (!db.isOpen()) {
			await db.open();
		}
		await db.table("keyval").put({ key, value });
		await db.close();
	} catch (e) {
		console.error("Worker persist failed", e);
	}

	if (typeof localStorage !== "undefined" && key !== "price_list_cache") {
		try {
			localStorage.setItem(`posa_${key}`, JSON.stringify(value));
		} catch (err) {
			console.error("Worker localStorage failed", err);
		}
	}
}

self.onmessage = async (event) => {
	// Logging every message can flood the console and increase memory usage
	// when the worker is used for frequent persistence operations. Remove
	// the noisy log to keep the console clean.
	const data = event.data || {};
	if (data.type === "parse_and_cache") {
		try {
			const parsed = JSON.parse(data.json);
			const itemsRaw = parsed.message || parsed;
			let items;
			try {
				if (typeof structuredClone === "function") {
					items = structuredClone(itemsRaw);
				} else {
					// Fallback for older browsers
					items = JSON.parse(JSON.stringify(itemsRaw));
				}
			} catch (e) {
				console.error("Failed to clone items", e);
				self.postMessage({ type: "error", error: e.message });
				return;
			}
			let cache = {};
			try {
				if (!db.isOpen()) {
					await db.open();
				}
				const stored = await db.table("keyval").get("price_list_cache");
				if (stored && stored.value) cache = stored.value;
				await db.close();
			} catch (e) {
				console.error("Failed to read cache in worker", e);
			}
			cache[data.priceList] = { items, timestamp: Date.now() };
			await persist("price_list_cache", cache);
			self.postMessage({ type: "parsed", items });
		} catch (err) {
			console.log(err);
			self.postMessage({ type: "error", error: err.message });
		}
	} else if (data.type === "persist") {
		await persist(data.key, data.value);
		self.postMessage({ type: "persisted", key: data.key });
	}
};
