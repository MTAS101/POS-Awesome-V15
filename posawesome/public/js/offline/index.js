// Main entry point - re-exports all functions for backward compatibility

// Core exports
export {
	db,
	initPromise,
	persist,
	addToPersistQueue,
	checkDbHealth,
	initPersistWorker,
	terminatePersistWorker,
} from "./core.js";

// Offline store exports
export { useOfflineStore, MAX_QUEUE_ITEMS } from "../stores/offlineStore.js";
export const memoryInitPromise = () => useOfflineStore().init();
export const resetOfflineState = () => useOfflineStore().resetOfflineState();
export const reduceCacheUsage = () => useOfflineStore().reduceCacheUsage();
export const setLastSyncTotals = (totals) => useOfflineStore().setLastSyncTotals(totals);
export const getLastSyncTotals = () => useOfflineStore().getLastSyncTotals();
export const getTaxInclusiveSetting = () => useOfflineStore().tax_inclusive;
export const setTaxInclusiveSetting = (val) => useOfflineStore().setState("tax_inclusive", !!val);
export const isManualOffline = () => useOfflineStore().isManualOffline();
export const setManualOffline = (state) => useOfflineStore().setManualOffline(state);
export const toggleManualOffline = () => useOfflineStore().toggleManualOffline();
export const queueHealthCheck = (limit) => useOfflineStore().queueHealthCheck(limit);
export const purgeOldQueueEntries = (limit) => useOfflineStore().purgeOldQueueEntries(limit);
export const isCacheReady = () => useOfflineStore().cache_ready;
export const getTaxTemplate = (name) => useOfflineStore().tax_template_cache?.[name] || null;
export const setTaxTemplate = (name, doc) => {
        const store = useOfflineStore();
        const cache = store.tax_template_cache || {};
        cache[name] = doc;
        store.setState("tax_template_cache", cache);
};

// Stock exports
export {
	initializeStockCache,
	isStockCacheReady,
	setStockCacheReady,
	validateStockForOfflineInvoice,
	updateLocalStock,
	getLocalStock,
	updateLocalStockCache,
	clearLocalStockCache,
	getLocalStockCache,
	setLocalStockCache,
	fetchItemStockQuantities,
	updateLocalStockWithActualQuantities,
} from "./stock.js";

// Sync exports
export {
	isOffline,
	saveOfflineInvoice,
	getOfflineInvoices,
	clearOfflineInvoices,
	deleteOfflineInvoice,
	getPendingOfflineInvoiceCount,
	saveOfflinePayment,
	getOfflinePayments,
	clearOfflinePayments,
	deleteOfflinePayment,
	getPendingOfflinePaymentCount,
	saveOfflineCustomer,
	updateOfflineInvoicesCustomer,
	getOfflineCustomers,
	clearOfflineCustomers,
	syncOfflineInvoices,
	syncOfflineCustomers,
	syncOfflinePayments,
} from "./sync.js";

// Items exports
export {
        saveItemUOMs,
        getItemUOMs,
        saveOffers,
        getCachedOffers,
        savePriceListItems,
        getCachedPriceListItems,
        clearPriceListCache,
        saveItemDetailsCache,
        getCachedItemDetails,
        saveItemsBulk as saveItems,
        getAllStoredItems,
        searchStoredItems,
        clearStoredItems,
} from "./items.js";

export { saveItemGroups, getCachedItemGroups, clearItemGroups } from "./item_groups.js";

// Customers exports
export {
	saveCustomerBalance,
	getCachedCustomerBalance,
	clearCustomerBalanceCache,
	clearExpiredCustomerBalances,
} from "./customers.js";

// Coupons exports
export { saveCoupons, getCachedCoupons, clearCoupons } from "./coupons.js";

// Translation cache exports
export { getTranslationsCache, saveTranslationsCache } from "./translations.js";

// Legacy convenience wrappers mapped to the Pinia store
export const getCustomerStorage = () => useOfflineStore().getCustomerStorage();
export const setCustomerStorage = (customers) => useOfflineStore().setCustomerStorage(customers);
export const getItemsLastSync = () => useOfflineStore().getItemsLastSync();
export const setItemsLastSync = (ts) => useOfflineStore().setItemsLastSync(ts);
export const getCustomersLastSync = () => useOfflineStore().getCustomersLastSync();
export const setCustomersLastSync = (ts) => useOfflineStore().setCustomersLastSync(ts);
export const getSalesPersonsStorage = () => useOfflineStore().getSalesPersonsStorage();
export const setSalesPersonsStorage = (data) => useOfflineStore().setSalesPersonsStorage(data);
export const getOpeningStorage = () => useOfflineStore().getOpeningStorage();
export const setOpeningStorage = (data) => useOfflineStore().setOpeningStorage(data);
export const clearOpeningStorage = () => useOfflineStore().clearOpeningStorage();
export const getOpeningDialogStorage = () => useOfflineStore().getOpeningDialogStorage();
export const setOpeningDialogStorage = (data) => useOfflineStore().setOpeningDialogStorage(data);
export const forceClearAllCache = () => useOfflineStore().forceClearAllCache();
export const getCacheUsageEstimate = () => useOfflineStore().getCacheUsageEstimate();
