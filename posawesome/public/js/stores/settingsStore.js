import { defineStore } from "pinia";

export const useSettingsStore = defineStore("settings", {
    state: () => ({
        cacheUsage: 0,
        cacheUsageLoading: false,
        cacheUsageDetails: { total: 0, indexedDB: 0, localStorage: 0 },
        cacheReady: false,
        posaTaxInclusive: false,
    }),
    actions: {
        async refreshCacheUsage() {
            this.cacheUsageLoading = true;
            try {
                const { getCacheUsageEstimate } = await import("../offline/index.js");
                const usage = await getCacheUsageEstimate();
                this.cacheUsage = usage.percentage || 0;
                this.cacheUsageDetails = {
                    total: usage.total || 0,
                    indexedDB: usage.indexedDB || 0,
                    localStorage: usage.localStorage || 0,
                };
            } catch (e) {
                console.error("Failed to refresh cache usage", e);
            } finally {
                this.cacheUsageLoading = false;
            }
        },
        setCacheReady(val) {
            this.cacheReady = !!val;
        },
        async refreshTaxInclusiveSetting(posProfile) {
            if (!posProfile || !posProfile.name || !navigator.onLine) {
                return;
            }
            try {
                const r = await frappe.call({
                    method: "posawesome.posawesome.api.utilities.get_pos_profile_tax_inclusive",
                    args: { pos_profile: posProfile.name },
                });
                if (r.message !== undefined) {
                    const val = r.message;
                    this.posaTaxInclusive = val;
                    try {
                        const offline = await import("../offline/index.js");
                        if (offline && offline.setTaxInclusiveSetting) {
                            offline.setTaxInclusiveSetting(val);
                        }
                    } catch (err) {
                        // ignore
                    }
                }
            } catch (e) {
                console.warn("Failed to refresh tax inclusive setting", e);
            }
        },
    },
    persist: {
        paths: ["cacheUsage", "cacheUsageDetails", "cacheReady", "posaTaxInclusive"],
    },
});

