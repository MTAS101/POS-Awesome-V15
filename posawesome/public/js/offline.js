import Dexie from 'dexie';

// --- Dexie initialization ---------------------------------------------------
const db = new Dexie('posawesome_offline');
db.version(1).stores({ keyval: '&key' });

const memory = {
  offline_invoices: [],
  pos_last_sync_totals: { pending: 0, synced: 0, drafted: 0 },
  uom_cache: {},
  offers_cache: [],
  customer_balance_cache: {},
  local_stock_cache: {},
  items_storage: [],
  customer_storage: [],
  pos_opening_storage: null,
  opening_dialog_storage: null,
  sales_persons_storage: []
};

async function init() {
  try {
    await db.open();
    for (const key of Object.keys(memory)) {
      const stored = await db.table('keyval').get(key);
      if (stored && stored.value !== undefined) {
        memory[key] = stored.value;
      }
    }
  } catch (e) {
    console.error('Failed to initialize offline DB', e);
  }
}
init();

function persist(key) {
  db.table('keyval')
    .put({ key, value: memory[key] })
    .catch(e => console.error(`Failed to persist ${key}`, e));
}

export function saveOfflineInvoice(entry) {
  const key = 'offline_invoices';
  const entries = memory.offline_invoices;
  entries.push(entry);
  memory.offline_invoices = entries;
  persist(key);

  // Update local stock quantities
  if (entry.invoice && entry.invoice.items) {
    updateLocalStock(entry.invoice.items);
  }
}

export function isOffline() {
  if (typeof window !== 'undefined' && typeof window.serverOnline === 'boolean') {
    return !navigator.onLine || !window.serverOnline;
  }
  return !navigator.onLine;
}

export function getOfflineInvoices() {
  return memory.offline_invoices;
}

export function clearOfflineInvoices() {
  memory.offline_invoices = [];
  persist('offline_invoices');
}

export function getPendingOfflineInvoiceCount() {
  return memory.offline_invoices.length;
}

export function setLastSyncTotals(totals) {
  memory.pos_last_sync_totals = totals;
  persist('pos_last_sync_totals');
}

export function getLastSyncTotals() {
  return memory.pos_last_sync_totals;
}

// Add sync function to clear local cache when invoices are successfully synced
export async function syncOfflineInvoices() {
  const invoices = getOfflineInvoices();
  if (!invoices.length) {
    // No invoices to sync; keep previously stored totals
    return getLastSyncTotals();
  }
  if (isOffline()) {
    // When offline just return the pending count without attempting a sync
    return { pending: invoices.length, synced: 0, drafted: 0 };
  }

  const failures = [];
  let synced = 0;
  let drafted = 0;

  for (const inv of invoices) {
    try {
      await frappe.call({
        method: 'posawesome.posawesome.api.posapp.submit_invoice',
        args: {
          invoice: inv.invoice,
          data: inv.data,
        },
      });
      synced++;
    } catch (error) {
      console.error('Failed to submit invoice, saving as draft', error);
      try {
        await frappe.call({
          method: 'posawesome.posawesome.api.posapp.update_invoice',
          args: { data: inv.invoice }
        });
        drafted += 1;
      } catch (draftErr) {
        console.error('Failed to save invoice as draft', draftErr);
        failures.push(inv);
      }
    }
  }

  // Clear offline invoices and local stock cache after successful sync
  if (synced > 0) {
    clearOfflineInvoices();
    clearLocalStockCache(); // Clear local stock cache to get fresh data from server
  }

  const pendingLeft = failures.length;

  if (pendingLeft) {
    memory.offline_invoices = failures;
    persist('offline_invoices');
  } else {
    clearOfflineInvoices();
  }

  const totals = { pending: pendingLeft, synced, drafted };
  setLastSyncTotals(totals);
  return totals;
}
export function saveItemUOMs(itemCode, uoms) {
  try {
    const cache = memory.uom_cache;
    cache[itemCode] = uoms;
    memory.uom_cache = cache;
    persist('uom_cache');
  } catch (e) {
    console.error('Failed to cache UOMs', e);
  }
}

export function getItemUOMs(itemCode) {
  try {
    const cache = memory.uom_cache || {};
    return cache[itemCode] || [];
  } catch (e) {
    return [];
  }
}

export function saveOffers(offers) {
  try {
    memory.offers_cache = offers;
    persist('offers_cache');
  } catch (e) {
    console.error('Failed to cache offers', e);
  }
}

export function getCachedOffers() {
  try {
    return memory.offers_cache || [];
  } catch (e) {
    return [];
  }
}

// Customer balance caching functions
export function saveCustomerBalance(customer, balance) {
  try {
    const cache = memory.customer_balance_cache;
    cache[customer] = {
      balance: balance,
      timestamp: Date.now()
    };
    memory.customer_balance_cache = cache;
    persist('customer_balance_cache');
  } catch (e) {
    console.error('Failed to cache customer balance', e);
  }
}

export function getCachedCustomerBalance(customer) {
  try {
    const cache = memory.customer_balance_cache || {};
    const cachedData = cache[customer];
    if (cachedData) {
      const isValid = (Date.now() - cachedData.timestamp) < (24 * 60 * 60 * 1000);
      return isValid ? cachedData.balance : null;
    }
    return null;
  } catch (e) {
    console.error('Failed to get cached customer balance', e);
    return null;
  }
}

export function clearCustomerBalanceCache() {
  try {
    memory.customer_balance_cache = {};
    persist('customer_balance_cache');
  } catch (e) {
    console.error('Failed to clear customer balance cache', e);
  }
}

export function clearExpiredCustomerBalances() {
  try {
    const cache = memory.customer_balance_cache || {};
    const now = Date.now();
    const validCache = {};

    Object.keys(cache).forEach(customer => {
      const cachedData = cache[customer];
      if (cachedData && (now - cachedData.timestamp) < (24 * 60 * 60 * 1000)) {
        validCache[customer] = cachedData;
      }
    });

    memory.customer_balance_cache = validCache;
    persist('customer_balance_cache');
  } catch (e) {
    console.error('Failed to clear expired customer balances', e);
  }
}

// Local stock management functions
export function updateLocalStock(items) {
  try {
    const stockCache = memory.local_stock_cache || {};

    items.forEach(item => {
      const key = item.item_code;

      // Only update if the item already exists in cache
      // Don't create new entries without knowing the actual stock
      if (stockCache[key]) {
        // Reduce quantity by sold amount
        const soldQty = Math.abs(item.qty || 0);
        stockCache[key].actual_qty = Math.max(0, stockCache[key].actual_qty - soldQty);
        stockCache[key].last_updated = new Date().toISOString();
      }
      // If item doesn't exist in cache, we don't create it
      // because we don't know the actual stock quantity
    });

    memory.local_stock_cache = stockCache;
    persist('local_stock_cache');
  } catch (e) {
    console.error('Failed to update local stock', e);
  }
}

export function getLocalStock(itemCode) {
  try {
    const stockCache = memory.local_stock_cache || {};
    return stockCache[itemCode]?.actual_qty || null;
  } catch (e) {
    return null;
  }
}

export function clearLocalStockCache() {
  memory.local_stock_cache = {};
  persist('local_stock_cache');
}

// Add this new function to fetch stock quantities
export async function fetchItemStockQuantities(items, pos_profile) {
  try {
    const response = await new Promise((resolve, reject) => {
      frappe.call({
        method: "posawesome.posawesome.api.posapp.get_items_details",
        args: {
          pos_profile: pos_profile,
          items_data: items,
        },
        callback: function (r) {
          if (r.message) {
            resolve(r.message);
          } else {
            reject(new Error('No response from server'));
          }
        },
        error: function (err) {
          reject(err);
        }
      });
    });
    return response;
  } catch (error) {
    console.error('Failed to fetch item stock quantities:', error);
    return null;
  }
}

// Add this function to initialize stock cache for all items
export async function initializeStockCache(items, pos_profile) {
  try {
    console.info('Initializing stock cache for', items.length, 'items');

    const updatedItems = await fetchItemStockQuantities(items, pos_profile);

    if (updatedItems && updatedItems.length > 0) {
      const stockCache = {};

      updatedItems.forEach(item => {
        if (item.actual_qty !== undefined) {
          stockCache[item.item_code] = {
            actual_qty: item.actual_qty,
            last_updated: new Date().toISOString()
          };
        }
      });

      memory.local_stock_cache = stockCache;
      persist('local_stock_cache');
      console.info('Stock cache initialized with', Object.keys(stockCache).length, 'items');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to initialize stock cache:', error);
    return false;
  }
}

// New function to update local stock with actual quantities
export function updateLocalStockWithActualQuantities(invoiceItems, serverItems) {
  try {
    const stockCache = memory.local_stock_cache || {};

    invoiceItems.forEach(invoiceItem => {
      const key = invoiceItem.item_code;

      // Find corresponding server item with actual quantity
      const serverItem = serverItems.find(item => item.item_code === invoiceItem.item_code);

      if (serverItem && serverItem.actual_qty !== undefined) {
        // Initialize or update cache with actual server quantity
        if (!stockCache[key]) {
          stockCache[key] = {
            actual_qty: serverItem.actual_qty,
            last_updated: new Date().toISOString()
          };
        } else {
          // Update with server quantity if it's more recent
          stockCache[key].actual_qty = serverItem.actual_qty;
          stockCache[key].last_updated = new Date().toISOString();
        }

        // Now reduce quantity by sold amount
        const soldQty = Math.abs(invoiceItem.qty || 0);
        stockCache[key].actual_qty = Math.max(0, stockCache[key].actual_qty - soldQty);
      }
    });

    memory.local_stock_cache = stockCache;
    persist('local_stock_cache');
  } catch (e) {
    console.error('Failed to update local stock with actual quantities', e);
  }
}

// --- Generic getters and setters for cached data ----------------------------
export function getItemsStorage() {
  return memory.items_storage || [];
}

export function setItemsStorage(items) {
  memory.items_storage = items;
  persist('items_storage');
}

export function getCustomerStorage() {
  return memory.customer_storage || [];
}

export function setCustomerStorage(customers) {
  memory.customer_storage = customers;
  persist('customer_storage');
}

export function getSalesPersonsStorage() {
  return memory.sales_persons_storage || [];
}

export function setSalesPersonsStorage(data) {
  memory.sales_persons_storage = data;
  persist('sales_persons_storage');
}

export function getOpeningStorage() {
  return memory.pos_opening_storage || null;
}

export function setOpeningStorage(data) {
  memory.pos_opening_storage = data;
  persist('pos_opening_storage');
}

export function getOpeningDialogStorage() {
  return memory.opening_dialog_storage || null;
}

export function setOpeningDialogStorage(data) {
  memory.opening_dialog_storage = data;
  persist('opening_dialog_storage');
}

export function getLocalStockCache() {
  return memory.local_stock_cache || {};
}

export function setLocalStockCache(cache) {
  memory.local_stock_cache = cache || {};
  persist('local_stock_cache');
}
