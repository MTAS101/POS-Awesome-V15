// Main entry point - re-exports all functions for backward compatibility

// Core exports
export { db, initPromise, persist, addToPersistQueue, checkDbHealth } from "./core.js";

// Cache exports
export {
	memory,
	memoryInitPromise,
	getItemsStorage,
	setItemsStorage,
	getCustomerStorage,
	setCustomerStorage,
	getSalesPersonsStorage,
	setSalesPersonsStorage,
	getOpeningStorage,
	setOpeningStorage,
	clearOpeningStorage,
        getOpeningDialogStorage,
        setOpeningDialogStorage,
        getClosingStorage,
        setClosingStorage,
        clearClosingStorage,
        getTaxTemplate,
        setTaxTemplate,
        setLastSyncTotals,
	getLastSyncTotals,
	getTaxInclusiveSetting,
	setTaxInclusiveSetting,
	isManualOffline,
	setManualOffline,
	toggleManualOffline,
	queueHealthCheck,
	purgeOldQueueEntries,
	MAX_QUEUE_ITEMS,
        resetOfflineState,
        clearAllCache,
        getCacheUsageEstimate,
        isCacheReady,
} from "./cache.js";

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
} from "./items.js";

// Customers exports
export {
	saveCustomerBalance,
	getCachedCustomerBalance,
	clearCustomerBalanceCache,
	clearExpiredCustomerBalances,
} from "./customers.js";

// Coupons exports
export {
        saveGiftCoupons,
        getCachedGiftCoupons,
        clearGiftCouponCache,
} from "./coupons.js";

// Translations exports
export {
       saveTranslations,
       getCachedTranslations,
       clearTranslationCache,
} from "./translations.js";
