import { useOfflineStore } from "@/stores/offlineStore";

export function saveCoupons(customer, coupons) {
        try {
                const store = useOfflineStore();
                const cache = store.coupons_cache || {};
                const clean =
                        typeof structuredClone === "function"
                                ? structuredClone(coupons)
                                : JSON.parse(JSON.stringify(coupons));
                cache[customer] = clean;
                store.setState("coupons_cache", cache);
        } catch (e) {
                console.error("Failed to cache coupons", e);
        }
}

export function getCachedCoupons(customer) {
        try {
                const store = useOfflineStore();
                const cache = store.coupons_cache || {};
                return cache[customer] || [];
        } catch (e) {
                console.error("Failed to get cached coupons", e);
                return [];
        }
}

export function clearCoupons(customer) {
        try {
                const store = useOfflineStore();
                const cache = store.coupons_cache || {};
                if (customer) {
                        delete cache[customer];
                } else {
                        for (const key in cache) {
                                delete cache[key];
                        }
                }
                store.setState("coupons_cache", cache);
        } catch (e) {
                console.error("Failed to clear coupons cache", e);
        }
}
