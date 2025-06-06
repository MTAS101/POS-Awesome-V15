export function saveOfflineInvoice(entry) {
  const key = 'offline_invoices';
  let entries = [];
  try {
    entries = JSON.parse(localStorage.getItem(key)) || [];
  } catch(e) {
    entries = [];
  }
  entries.push(entry);
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch(e) {
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
  } catch(e) {
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
      synced += 1;
    } catch (err) {
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
