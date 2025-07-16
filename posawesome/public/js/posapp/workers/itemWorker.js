// Support both classic and module workers. When running as a classic worker the
// global `importScripts` function is available. Module workers don't expose it,
// so in that case use dynamic `import()` to load Dexie. Using an absolute path
// ensures the script resolves correctly regardless of the worker's location.
let DexieCtorPromise;
if (typeof importScripts === "function") {
    importScripts("/assets/posawesome/js/libs/dexie.min.js");
    DexieCtorPromise = Promise.resolve(self.Dexie);
} else {
    DexieCtorPromise = import("/assets/posawesome/js/libs/dexie.min.js").then(
        (m) => m.default || m.Dexie,
    );
}

let db;
async function getDb() {
    if (!db) {
        const DexieCtor = await DexieCtorPromise;
        db = new DexieCtor("posawesome_offline");
        db.version(1).stores({ keyval: "&key" });
    }
    return db;
}

async function persist(key, value) {
        const database = await getDb();
        try {
                await database.table("keyval").put({ key, value });
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
                                const database = await getDb();
                                const stored = await database.table("keyval").get("price_list_cache");
                                if (stored && stored.value) cache = stored.value;
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
        } else if (data.type === "parse_and_cache_customers") {
                try {
                        const parsed = JSON.parse(data.json);
                        const customersRaw = parsed.message || parsed;
                        let customers;
                        try {
                                if (typeof structuredClone === "function") {
                                        customers = structuredClone(customersRaw);
                                } else {
                                        customers = JSON.parse(JSON.stringify(customersRaw));
                                }
                        } catch (e) {
                                console.error("Failed to clone customers", e);
                                self.postMessage({ type: "error", error: e.message });
                                return;
                        }
                        await persist("customer_storage", customers);
                        self.postMessage({ type: "customers_parsed", customers });
                } catch (err) {
                        console.log(err);
                        self.postMessage({ type: "error", error: err.message });
                }
        } else if (data.type === "persist") {
                await persist(data.key, data.value);
                self.postMessage({ type: "persisted", key: data.key });
        }
};
