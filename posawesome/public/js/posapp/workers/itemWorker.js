let db;
let DexieLib;

async function ensureDb() {
        if (!DexieLib) {
                try {
                        importScripts("/assets/posawesome/js/libs/dexie.min.js?v=1");
                        DexieLib = { default: Dexie };
                } catch (e) {
                        // Fallback to dynamic import when importScripts fails
                        DexieLib = await import("/assets/posawesome/js/libs/dexie.min.js?v=1");
                }
        }

        if (!db) {
                db = new DexieLib.default("posawesome_offline");
                db.version(2).stores({
                        keyval: "&key",
                        queue: "&key",
                        cache: "&key",
                });
        }

        if (!db.isOpen()) {
                try {
                        await db.open();
                } catch (err) {
                        console.error("Failed to open IndexedDB in worker", err);
                }
        }
}

// Initialize DB when the worker starts
(async () => {
        await ensureDb();
})();

const KEY_TABLE_MAP = {
	offline_invoices: "queue",
	offline_customers: "queue",
	offline_payments: "queue",
	price_list_cache: "cache",
	item_details_cache: "cache",
	items_storage: "cache",
	customer_storage: "cache",
};

function tableForKey(key) {
	return KEY_TABLE_MAP[key] || "keyval";
}

async function persist(key, value) {
        try {
                await ensureDb();
                const table = tableForKey(key);
                await db.table(table).put({ key, value });
        } catch (e) {
                if (e && e.name === "DatabaseClosedError") {
                        try {
                                await ensureDb();
                                const table = tableForKey(key);
                                await db.table(table).put({ key, value });
                                return;
                        } catch (err) {
                                console.error("Worker persist retry failed", err);
                        }
                }

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
			const trimmed = items.map((it) => ({
				item_code: it.item_code,
				item_name: it.item_name,
				description: it.description,
				stock_uom: it.stock_uom,
				image: it.image,
				item_group: it.item_group,
				rate: it.rate,
				price_list_rate: it.price_list_rate,
				currency: it.currency,
				item_barcode: it.item_barcode,
				item_uoms: it.item_uoms,
				actual_qty: it.actual_qty,
				has_batch_no: it.has_batch_no,
				has_serial_no: it.has_serial_no,
				has_variants: !!it.has_variants,
			}));
			let cache = {};
			try {
				if (!db.isOpen()) {
					await db.open();
				}
				const stored = await db.table(tableForKey("price_list_cache")).get("price_list_cache");
				if (stored && stored.value) cache = stored.value;
			} catch (e) {
				console.error("Failed to read cache in worker", e);
			}
			cache[data.priceList] = { items: trimmed, timestamp: Date.now() };
			await persist("price_list_cache", cache);
			self.postMessage({ type: "parsed", items: trimmed });
		} catch (err) {
			console.log(err);
			self.postMessage({ type: "error", error: err.message });
		}
	} else if (data.type === "persist") {
		await persist(data.key, data.value);
		self.postMessage({ type: "persisted", key: data.key });
	}
};
