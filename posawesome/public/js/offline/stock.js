import { memory } from "./cache.js";
import { persist, db, checkDbHealth } from "./core.js";

// Modify initializeStockCache function to set the flag
export async function initializeStockCache(items, pos_profile) {
        try {
                const itemCodes = Array.isArray(items) ? items.map((it) => it.item_code) : [];
                await checkDbHealth();
                if (!db.isOpen()) await db.open();
                const existing = await db.table("items").where("item_code").anyOf(itemCodes).toArray();
                const existingMap = new Map(existing.map((it) => [it.item_code, it.actual_qty]));
                const missingItems = items.filter((it) => existingMap.get(it.item_code) === undefined);

                if (missingItems.length === 0) {
                        if (!memory.stock_cache_ready) {
                                memory.stock_cache_ready = true;
                                persist("stock_cache_ready", memory.stock_cache_ready);
                        }
                        console.debug("Stock cache already initialized");
                        console.info("Stock cache initialized with", existing.length, "items");
                        return true;
                }

                console.info("Initializing stock cache for", missingItems.length, "new items");

                const updatedItems = await fetchItemStockQuantities(missingItems, pos_profile);

                if (updatedItems && updatedItems.length > 0) {
                        await Promise.all(
                                updatedItems.map((item) =>
                                        db
                                                .table("items")
                                                .where("item_code")
                                                .equals(item.item_code)
                                                .modify((it) => {
                                                        it.actual_qty = item.actual_qty;
                                                        it.last_updated = new Date().toISOString();
                                                }),
                                ),
                        );

                        memory.stock_cache_ready = true;
                        persist("stock_cache_ready", memory.stock_cache_ready);
                        console.info(
                                "Stock cache initialized with",
                                existing.length + updatedItems.length,
                                "items",
                        );
                        return true;
                }
                return false;
        } catch (error) {
                console.error("Failed to initialize stock cache:", error);
                return false;
        }
}

// Add getter and setter for stock_cache_ready flag
export function isStockCacheReady() {
	return memory.stock_cache_ready || false;
}

export function setStockCacheReady(ready) {
	memory.stock_cache_ready = ready;
	persist("stock_cache_ready", memory.stock_cache_ready);
}

// Add new validation function
export async function validateStockForOfflineInvoice(items) {
        const allowNegativeStock = memory.pos_opening_storage?.stock_settings?.allow_negative_stock;
        if (allowNegativeStock) {
                return { isValid: true, invalidItems: [], errorMessage: "" };
        }

        const itemCodes = items.map((item) => item.item_code);
        await checkDbHealth();
        if (!db.isOpen()) await db.open();
        const stored = await db.table("items").where("item_code").anyOf(itemCodes).toArray();
        const stockMap = new Map(stored.map((it) => [it.item_code, it.actual_qty || 0]));

        const invalidItems = [];

        items.forEach((item) => {
                const requestedQty = Math.abs(item.qty || 0);
                const currentStock = stockMap.get(item.item_code) || 0;

                if (currentStock - requestedQty < 0) {
                        invalidItems.push({
                                item_code: item.item_code,
                                item_name: item.item_name || item.item_code,
                                requested_qty: requestedQty,
                                available_qty: currentStock,
                        });
                }
        });

        // Create clean error message
        let errorMessage = "";
        if (invalidItems.length === 1) {
                const item = invalidItems[0];
                errorMessage = `Not enough stock for ${item.item_name}. You need ${item.requested_qty} but only ${item.available_qty} available.`;
        } else if (invalidItems.length > 1) {
                errorMessage =
                        "Insufficient stock for multiple items:\n" +
                        invalidItems
                                .map((item) => `• ${item.item_name}: Need ${item.requested_qty}, Have ${item.available_qty}`)
                                .join("\n");
        }

        return {
                isValid: invalidItems.length === 0,
                invalidItems: invalidItems,
                errorMessage: errorMessage,
        };
}

// Local stock management functions
export async function updateLocalStock(items) {
        try {
                await checkDbHealth();
                if (!db.isOpen()) await db.open();
                for (const item of items) {
                        const soldQty = Math.abs(item.qty || 0);
                        await db
                                .table("items")
                                .where("item_code")
                                .equals(item.item_code)
                                .modify((it) => {
                                        it.actual_qty = Math.max(0, (it.actual_qty || 0) - soldQty);
                                        it.last_updated = new Date().toISOString();
                                });
                }
        } catch (e) {
                console.error("Failed to update local stock", e);
        }
}

export async function getLocalStock(itemCode) {
        try {
                await checkDbHealth();
                if (!db.isOpen()) await db.open();
                const it = await db.table("items").get(itemCode);
                return it?.actual_qty ?? null;
        } catch (e) {
                return null;
        }
}

// Update the local stock cache with latest quantities
export async function updateLocalStockCache(items) {
        try {
                await checkDbHealth();
                if (!db.isOpen()) await db.open();
                await Promise.all(
                        items.map((item) =>
                                db
                                        .table("items")
                                        .where("item_code")
                                        .equals(item.item_code)
                                        .modify((it) => {
                                                it.actual_qty = item.actual_qty;
                                                it.last_updated = new Date().toISOString();
                                        }),
                        ),
                );
        } catch (e) {
                console.error("Failed to refresh local stock cache", e);
        }
}

export async function clearLocalStockCache() {
        await checkDbHealth();
        if (!db.isOpen()) await db.open();
        await db
                .table("items")
                .toCollection()
                .modify((it) => {
                        delete it.actual_qty;
                        delete it.last_updated;
                });
}

// Add this new function to fetch stock quantities
export async function fetchItemStockQuantities(items, pos_profile, chunkSize = 100) {
	const allItems = [];
	try {
		for (let i = 0; i < items.length; i += chunkSize) {
			const chunk = items.slice(i, i + chunkSize);
			const response = await new Promise((resolve, reject) => {
				frappe.call({
					method: "posawesome.posawesome.api.posapp.get_items_details",
					args: {
						pos_profile: JSON.stringify(pos_profile),
						items_data: JSON.stringify(chunk),
					},
					freeze: false,
					callback: function (r) {
						if (r.message) {
							resolve(r.message);
						} else {
							reject(new Error("No response from server"));
						}
					},
					error: function (err) {
						reject(err);
					},
				});
			});
			if (response) {
				allItems.push(...response);
			}
		}
		return allItems;
	} catch (error) {
		console.error("Failed to fetch item stock quantities:", error);
		return null;
	}
}

// New function to update local stock with actual quantities
export async function updateLocalStockWithActualQuantities(invoiceItems, serverItems) {
        try {
                await checkDbHealth();
                if (!db.isOpen()) await db.open();
                for (const invoiceItem of invoiceItems) {
                        const serverItem = serverItems.find((it) => it.item_code === invoiceItem.item_code);
                        if (serverItem && serverItem.actual_qty !== undefined) {
                                const soldQty = Math.abs(invoiceItem.qty || 0);
                                await db
                                        .table("items")
                                        .where("item_code")
                                        .equals(invoiceItem.item_code)
                                        .modify((it) => {
                                                it.actual_qty = Math.max(0, serverItem.actual_qty - soldQty);
                                                it.last_updated = new Date().toISOString();
                                        });
                        }
                }
        } catch (e) {
                console.error("Failed to update local stock with actual quantities", e);
        }
}

export async function getLocalStockCache() {
        await checkDbHealth();
        if (!db.isOpen()) await db.open();
        const items = await db.table("items").where("actual_qty").notEqual(undefined).toArray();
        const cache = {};
        items.forEach((it) => {
                cache[it.item_code] = { actual_qty: it.actual_qty, last_updated: it.last_updated };
        });
        return cache;
}

export async function setLocalStockCache(cache) {
        await checkDbHealth();
        if (!db.isOpen()) await db.open();
        const entries = Object.entries(cache || {});
        await Promise.all(
                entries.map(([code, data]) =>
                        db
                                .table("items")
                                .where("item_code")
                                .equals(code)
                                .modify((it) => {
                                        it.actual_qty = data.actual_qty;
                                        it.last_updated = data.last_updated;
                                }),
                ),
        );
}
