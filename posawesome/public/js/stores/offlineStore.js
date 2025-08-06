import { defineStore } from "pinia";
import { db, persist, checkDbHealth, tableForKey } from "../offline/core.js";

export const CACHE_VERSION = 1;
export const MAX_QUEUE_ITEMS = 1000;

export const useOfflineStore = defineStore("offline", {
        state: () => ({
                offline_invoices: [],
                offline_customers: [],
                offline_payments: [],
                pos_last_sync_totals: { pending: 0, synced: 0, drafted: 0 },
                uom_cache: {},
                offers_cache: [],
                customer_balance_cache: {},
                local_stock_cache: {},
                stock_cache_ready: false,
                customer_storage: [],
                pos_opening_storage: null,
                opening_dialog_storage: null,
                sales_persons_storage: [],
                item_details_cache: {},
                tax_template_cache: {},
                translation_cache: {},
                coupons_cache: {},
                item_groups_cache: [],
                items_last_sync: null,
                customers_last_sync: null,
                cache_version: CACHE_VERSION,
                cache_ready: false,
                tax_inclusive: false,
                manual_offline: false,
        }),
        actions: {
                async init() {
                        try {
                                await checkDbHealth();
                                for (const key of Object.keys(this.$state)) {
                                        const stored = await db.table(tableForKey(key)).get(key);
                                        if (stored && stored.value !== undefined) {
                                                this.$state[key] = stored.value;
                                                continue;
                                        }
                                        if (typeof localStorage !== "undefined") {
                                                const ls = localStorage.getItem(`posa_${key}`);
                                                if (ls) {
                                                        try {
                                                                this.$state[key] = JSON.parse(ls);
                                                        } catch (err) {
                                                                console.error("Failed to parse localStorage for", key, err);
                                                        }
                                                }
                                        }
                                }
                                this.cache_ready = true;
                                persist("cache_ready", true);
                        } catch (e) {
                                console.error("Failed to initialize offline store", e);
                        }
                },
                setState(key, value) {
                        this.$state[key] = value;
                        persist(key, value);
                },
                resetOfflineState() {
                        this.offline_invoices = [];
                        this.offline_customers = [];
                        this.offline_payments = [];
                        this.pos_last_sync_totals = { pending: 0, synced: 0, drafted: 0 };
                        persist("offline_invoices", this.offline_invoices);
                        persist("offline_customers", this.offline_customers);
                        persist("offline_payments", this.offline_payments);
                        persist("pos_last_sync_totals", this.pos_last_sync_totals);
                },
                async reduceCacheUsage() {
                        try {
                                const { clearPriceListCache } = await import("../offline/items.js");
                                await clearPriceListCache();
                        } catch (e) {
                                console.error("Failed to clear price list cache", e);
                        }
                        this.item_details_cache = {};
                        this.uom_cache = {};
                        this.offers_cache = [];
                        this.customer_balance_cache = {};
                        this.local_stock_cache = {};
                        this.stock_cache_ready = false;
                        this.coupons_cache = {};
                        this.item_groups_cache = [];
                        persist("item_details_cache", this.item_details_cache);
                        persist("uom_cache", this.uom_cache);
                        persist("offers_cache", this.offers_cache);
                        persist("customer_balance_cache", this.customer_balance_cache);
                        persist("local_stock_cache", this.local_stock_cache);
                        persist("stock_cache_ready", this.stock_cache_ready);
                        persist("coupons_cache", this.coupons_cache);
                        persist("item_groups_cache", this.item_groups_cache);
                },
                setLastSyncTotals(totals) {
                        this.pos_last_sync_totals = totals;
                        persist("pos_last_sync_totals", this.pos_last_sync_totals);
                },
                getLastSyncTotals() {
                        return this.pos_last_sync_totals;
                },
                setManualOffline(state) {
                        this.manual_offline = !!state;
                        persist("manual_offline", this.manual_offline);
                },
                toggleManualOffline() {
                        this.setManualOffline(!this.manual_offline);
                },
                isManualOffline() {
                        return this.manual_offline || false;
                },
                queueHealthCheck(limit = MAX_QUEUE_ITEMS) {
                        const inv = (this.offline_invoices || []).length > limit;
                        const cus = (this.offline_customers || []).length > limit;
                        const pay = (this.offline_payments || []).length > limit;
                        return inv || cus || pay;
                },
                purgeOldQueueEntries(limit = MAX_QUEUE_ITEMS) {
                        if (Array.isArray(this.offline_invoices) && this.offline_invoices.length > limit) {
                                this.offline_invoices.splice(0, this.offline_invoices.length - limit);
                                persist("offline_invoices", this.offline_invoices);
                        }
                        if (Array.isArray(this.offline_customers) && this.offline_customers.length > limit) {
                                this.offline_customers.splice(0, this.offline_customers.length - limit);
                                persist("offline_customers", this.offline_customers);
                        }
                        if (Array.isArray(this.offline_payments) && this.offline_payments.length > limit) {
                                this.offline_payments.splice(0, this.offline_payments.length - limit);
                                persist("offline_payments", this.offline_payments);
                        }
                },
                getTranslationsCache(lang) {
                        const cache = this.translation_cache || {};
                        return cache[lang] || null;
                },
                saveTranslationsCache(lang, data) {
                        const cache = this.translation_cache || {};
                        cache[lang] = data;
                        this.translation_cache = cache;
                        persist("translation_cache", this.translation_cache);
                },
        },
        persist: true,
});

