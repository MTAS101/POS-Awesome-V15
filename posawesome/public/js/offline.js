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

export async function syncOfflineInvoices() {
  const invoices = getOfflineInvoices();
  if (!invoices.length) return;
  const failures = [];
  for (const inv of invoices) {
    try {
      await frappe.call({
        method: 'posawesome.posawesome.api.posapp.submit_invoice',
        args: inv
      });
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
}
