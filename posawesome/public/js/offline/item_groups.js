import { useOfflineStore } from "@/stores/offlineStore";

export function saveItemGroups(groups) {
        try {
                let clean;
                try {
                        clean =
                                typeof structuredClone === "function"
                                        ? structuredClone(groups)
                                        : JSON.parse(JSON.stringify(groups));
                } catch (e) {
                        console.error("Failed to serialize item groups", e);
                        clean = [];
                }
                const store = useOfflineStore();
                store.setState("item_groups_cache", clean);
        } catch (e) {
                console.error("Failed to cache item groups", e);
        }
}

export function getCachedItemGroups() {
        try {
                const store = useOfflineStore();
                return store.item_groups_cache || [];
        } catch (e) {
                console.error("Failed to get cached item groups", e);
                return [];
        }
}

export function clearItemGroups() {
        try {
                const store = useOfflineStore();
                store.setState("item_groups_cache", []);
        } catch (e) {
                console.error("Failed to clear item groups cache", e);
        }
}
