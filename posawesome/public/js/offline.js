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

export async function syncOfflineInvoices() {
  const invoices = getOfflineInvoices();
  if (!invoices.length) return { pending: 0, synced: 0 };
  if (!navigator.onLine) {
    // When offline just return the pending count without attempting a sync
    return { pending: invoices.length, synced: 0 };
  }
  const failures = [];
  let synced = 0;
  for (const inv of invoices) {
    try {
      await frappe.call({
        method: 'posawesome.posawesome.api.posapp.submit_invoice',
        args: inv
      });
      synced += 1;
    } catch (err) {
      console.error('Failed to sync offline invoice', err);
      failures.push(inv);
    }
  }
  if (failures.length) {
    localStorage.setItem('offline_invoices', JSON.stringify(failures));
  } else {
    clearOfflineInvoices();
  }
  return { pending: invoices.length, synced };
}
