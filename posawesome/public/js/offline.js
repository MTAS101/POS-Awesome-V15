export function saveOfflineInvoice(entry) {
  const key = 'offline_invoices';
  let entries = [];
  try {
    entries = JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    entries = [];
  }
  entries.push(entry);
  try {
    localStorage.setItem(key, JSON.stringify(entries));

    // Update local stock quantities
    if (entry.invoice && entry.invoice.items) {
      updateLocalStock(entry.invoice.items);
    }
  } catch (e) {
    console.error('Failed to save offline invoice', e);
  }
}

export function isOffline() {
  if (typeof window !== 'undefined' && typeof window.serverOnline === 'boolean') {
    return !navigator.onLine || !window.serverOnline;
  }
  return !navigator.onLine;
}

export function getOfflineInvoices() {
  try {
    return JSON.parse(localStorage.getItem('offline_invoices')) || [];
  } catch (e) {
    return [];
  }
}

export function clearOfflineInvoices() {
  localStorage.removeItem('offline_invoices');
}

export function getPendingOfflineInvoiceCount() {
  return getOfflineInvoices().length;
}

export function setLastSyncTotals(totals) {
  try {
    localStorage.setItem('pos_last_sync_totals', JSON.stringify(totals));
  } catch (e) {
    console.error('Failed to persist last sync totals', e);
  }
}

export function getLastSyncTotals() {
  try {
    return JSON.parse(localStorage.getItem('pos_last_sync_totals')) || { pending: 0, synced: 0, drafted: 0 };
  } catch (e) {
    return { pending: 0, synced: 0, drafted: 0 };
  }
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
        args: inv
      });
      synced++;
    } catch (error) {
      console.error('Failed to submit invoice, saving as draft', err);
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
    localStorage.setItem('offline_invoices', JSON.stringify(failures));
  } else {
    clearOfflineInvoices();
  }

  const totals = { pending: pendingLeft, synced, drafted };
  setLastSyncTotals(totals);
  return totals;
}
export function saveItemUOMs(itemCode, uoms) {
  try {
    const cache = JSON.parse(localStorage.getItem('uom_cache')) || {};
    cache[itemCode] = uoms;
    localStorage.setItem('uom_cache', JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to cache UOMs', e);
  }
}

export function getItemUOMs(itemCode) {
  try {
    const cache = JSON.parse(localStorage.getItem('uom_cache')) || {};
    return cache[itemCode] || [];
  } catch (e) {
    return [];
  }
}

export function saveOffers(offers) {
  try {
    localStorage.setItem('offers_cache', JSON.stringify(offers));
  } catch (e) {
    console.error('Failed to cache offers', e);
  }
}

export function getCachedOffers() {
  try {
    return JSON.parse(localStorage.getItem('offers_cache')) || [];
  } catch (e) {
    return [];
  }
}

// Customer balance caching functions
export function saveCustomerBalance(customer, balance) {
  try {
    const cache = JSON.parse(localStorage.getItem('customer_balance_cache')) || {};
    cache[customer] = {
      balance: balance,
      timestamp: Date.now()
    };
    localStorage.setItem('customer_balance_cache', JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to cache customer balance', e);
  }
}

export function getCachedCustomerBalance(customer) {
  try {
    const cache = JSON.parse(localStorage.getItem('customer_balance_cache')) || {};
    const cachedData = cache[customer];
    if (cachedData) {
      // Check if cache is less than 24 hours old
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
    localStorage.removeItem('customer_balance_cache');
  } catch (e) {
    console.error('Failed to clear customer balance cache', e);
  }
}

export function clearExpiredCustomerBalances() {
  try {
    const cache = JSON.parse(localStorage.getItem('customer_balance_cache')) || {};
    const now = Date.now();
    const validCache = {};

    Object.keys(cache).forEach(customer => {
      const cachedData = cache[customer];
      // Keep balances that are less than 24 hours old
      if (cachedData && (now - cachedData.timestamp) < (24 * 60 * 60 * 1000)) {
        validCache[customer] = cachedData;
      }
    });

    localStorage.setItem('customer_balance_cache', JSON.stringify(validCache));
  } catch (e) {
    console.error('Failed to clear expired customer balances', e);
  }
}

// Local stock management functions
export function updateLocalStock(items) {
  try {
    const stockCache = JSON.parse(localStorage.getItem('local_stock_cache')) || {};

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

    localStorage.setItem('local_stock_cache', JSON.stringify(stockCache));
  } catch (e) {
    console.error('Failed to update local stock', e);
  }
}

export function getLocalStock(itemCode) {
  try {
    const stockCache = JSON.parse(localStorage.getItem('local_stock_cache')) || {};
    return stockCache[itemCode]?.actual_qty || null;
  } catch (e) {
    return null;
  }
}

export function clearLocalStockCache() {
  localStorage.removeItem('local_stock_cache');
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

      localStorage.setItem('local_stock_cache', JSON.stringify(stockCache));
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
    const stockCache = JSON.parse(localStorage.getItem('local_stock_cache')) || {};

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

    localStorage.setItem('local_stock_cache', JSON.stringify(stockCache));
  } catch (e) {
    console.error('Failed to update local stock with actual quantities', e);
  }
}
