import { useOfflineStore } from "../stores/offlineStore";

// Customer balance caching functions
export function saveCustomerBalance(customer, balance) {
        try {
                const store = useOfflineStore();
                const cache = store.customer_balance_cache;
                cache[customer] = {
                        balance: balance,
                        timestamp: Date.now(),
                };
                store.setState("customer_balance_cache", cache);
        } catch (e) {
                console.error("Failed to cache customer balance", e);
        }
}

export function getCachedCustomerBalance(customer) {
        try {
                const store = useOfflineStore();
                const cache = store.customer_balance_cache || {};
                const cachedData = cache[customer];
                if (cachedData) {
                        const isValid = Date.now() - cachedData.timestamp < 24 * 60 * 60 * 1000;
                        return isValid ? cachedData.balance : null;
                }
                return null;
        } catch (e) {
                console.error("Failed to get cached customer balance", e);
                return null;
        }
}

export function clearCustomerBalanceCache() {
        try {
                const store = useOfflineStore();
                store.setState("customer_balance_cache", {});
        } catch (e) {
                console.error("Failed to clear customer balance cache", e);
        }
}

export function clearExpiredCustomerBalances() {
        try {
                const store = useOfflineStore();
                const cache = store.customer_balance_cache || {};
                const now = Date.now();
                const validCache = {};

                Object.keys(cache).forEach((customer) => {
                        const cachedData = cache[customer];
                        if (cachedData && now - cachedData.timestamp < 24 * 60 * 60 * 1000) {
                                validCache[customer] = cachedData;
                        }
                });

                store.setState("customer_balance_cache", validCache);
        } catch (e) {
                console.error("Failed to clear expired customer balances", e);
        }
}
