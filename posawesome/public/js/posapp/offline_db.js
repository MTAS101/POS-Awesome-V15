// Utility functions for IndexedDB operations

const DB_NAME = 'posawesome_offline';
const DB_VERSION = 1;
const INVOICE_STORE = 'offline_invoices';
const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed'
};

let db;

// Initialize IndexedDB
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(INVOICE_STORE)) {
        const store = db.createObjectStore(INVOICE_STORE, { keyPath: 'offline_pos_name' });
        store.createIndex('sync_status', 'sync_status');
        store.createIndex('created_at', 'created_at');
      }
    };
  });
}

// Save invoice offline
async function saveInvoiceOffline(invoice) {
  try {
    if (!db) await initDB();
    
    const offlineInvoice = {
      ...invoice,
      offline_pos_name: `OFFPOS${Date.now()}`,
      sync_status: SYNC_STATUS.PENDING,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(INVOICE_STORE, 'readwrite');
      const store = tx.objectStore(INVOICE_STORE);
      
      const request = store.add(offlineInvoice);
      
      request.onsuccess = () => resolve(offlineInvoice.offline_pos_name);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error saving invoice offline:', error);
    throw error;
  }
}

// Get all pending offline invoices
async function getPendingOfflineInvoices() {
  try {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(INVOICE_STORE, 'readonly');
      const store = tx.objectStore(INVOICE_STORE);
      const index = store.index('sync_status');
      
      const request = index.getAll(SYNC_STATUS.PENDING);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting pending invoices:', error);
    throw error;
  }
}

// Sync offline invoices when online
async function syncOfflineInvoices() {
  try {
    const pendingInvoices = await getPendingOfflineInvoices();
    console.log('Found pending invoices:', pendingInvoices.length);
    
    for (const invoice of pendingInvoices) {
      try {
        await updateInvoiceSyncStatus(invoice.offline_pos_name, SYNC_STATUS.SYNCING);
        
        const result = await frappe.call({
          method: 'posawesome.posawesome.api.posapp.submit_invoice',
          args: {
            invoice: JSON.stringify(invoice),
            data: {
              payments: invoice.payments,
              customer_credit_dict: invoice.customer_credit_dict || [],
              redeemed_customer_credit: invoice.redeemed_customer_credit || 0,
              credit_change: invoice.credit_change || 0,
              is_credit_sale: invoice.is_credit_sale || false
            }
          }
        });
        
        if (result.message && result.message.status === 1) {
          await updateInvoiceSyncStatus(invoice.offline_pos_name, SYNC_STATUS.SYNCED);
          console.log('Successfully synced invoice:', invoice.offline_pos_name);
        } else {
          throw new Error('Failed to sync invoice');
        }
      } catch (error) {
        console.error('Error syncing invoice:', invoice.offline_pos_name, error);
        await updateInvoiceSyncStatus(invoice.offline_pos_name, SYNC_STATUS.FAILED);
      }
    }
  } catch (error) {
    console.error('Error in sync process:', error);
    throw error;
  }
}

// Update invoice sync status
async function updateInvoiceSyncStatus(offlinePosName, status) {
  try {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(INVOICE_STORE, 'readwrite');
      const store = tx.objectStore(INVOICE_STORE);
      
      const request = store.get(offlinePosName);
      
      request.onsuccess = () => {
        const invoice = request.result;
        invoice.sync_status = status;
        invoice.modified_at = new Date().toISOString();
        
        const updateRequest = store.put(invoice);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    throw error;
  }
}

// Check if we're online
function isOnline() {
  return navigator.onLine;
}

// Export functions
export {
  initDB,
  saveInvoiceOffline,
  getPendingOfflineInvoices,
  syncOfflineInvoices,
  isOnline,
  SYNC_STATUS
};

// Centralized connectivity service
const connectivityService = {
  isOnline: navigator.onLine,
  listeners: new Set(),
  pendingSyncs: new Set(),

  init() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  },

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },

  handleOnline() {
    console.log('App is online');
    this.isOnline = true;
    this.notifyListeners('online');
    this.processPendingSyncs();
  },

  handleOffline() {
    console.log('App is offline');
    this.isOnline = false;
    this.notifyListeners('offline');
  },

  notifyListeners(status) {
    this.listeners.forEach(callback => callback(status));
  },

  async processPendingSyncs() {
    if (!this.isOnline) return;

    const pendingSyncs = Array.from(this.pendingSyncs);
    this.pendingSyncs.clear();

    for (const syncFn of pendingSyncs) {
      try {
        await syncFn();
      } catch (error) {
        console.error('Sync failed:', error);
        this.pendingSyncs.add(syncFn);
      }
    }
  },

  addPendingSync(syncFn) {
    this.pendingSyncs.add(syncFn);
    if (this.isOnline) {
      this.processPendingSyncs();
    }
  }
};

// Initialize connectivity service
connectivityService.init();

// Export connectivity service
export const ConnectivityService = connectivityService;

// Update existing setupConnectivityListeners function
export function setupConnectivityListeners(callbacks = {}) {
  const handleStatus = (status) => {
    if (status === 'online' && callbacks.onOnline) {
      callbacks.onOnline();
    } else if (status === 'offline' && callbacks.onOffline) {
      callbacks.onOffline();
    }
  };

  return ConnectivityService.addListener(handleStatus);
}

// Export isOnline function that uses the service
export function isOnline() {
  return ConnectivityService.isOnline;
}

// Function to submit an invoice to the server
async function submitInvoice(invoice) {
  try {
    // Prepare the invoice data for submission
    const requestData = {
      data: JSON.stringify({
        ...invoice,
        is_pos: 1,  // Force this to be a POS invoice
        update_stock: 1,  // Ensure stock is updated
        offline_submit: true // Flag to indicate this is an offline submission
      }),
      submit: 1,  // Always submit invoices when syncing from offline mode
      include_payments: 1  // Make sure payments are included
    };

    // Call the server API to process the invoice
    const response = await fetch('/api/method/posawesome.posawesome.api.posapp.update_invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': frappe.csrf_token
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`Server error: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Server response:', responseData);

    if (responseData.message?.name) {
      // Mark the invoice as synced in IndexedDB
      await markOrderSynced(invoice.id);
      
      // Show success message
      frappe.show_alert({
        message: __(`Invoice ${responseData.message.name} created and submitted`),
        indicator: 'green'
      }, 5);

      return responseData.message;
    } else {
      throw new Error('Invalid server response');
    }
  } catch (error) {
    console.error('Error submitting invoice:', error);
    
    // Show error message
    frappe.show_alert({
      message: __(`Error syncing invoice: ${error.message}`),
      indicator: 'red'
    }, 5);
    
    throw error;
  }
}

// Update processPendingInvoices to use the service
export async function processPendingInvoices() {
  const result = { processed: 0, failed: 0 };
  
  try {
    const pendingInvoices = await getPendingOrders();
    
    for (const invoice of pendingInvoices) {
      const syncFn = async () => {
        try {
          await submitInvoice(invoice);
          result.processed++;
        } catch (error) {
          console.error('Failed to sync invoice:', error);
          result.failed++;
          throw error; // Rethrow to trigger retry
        }
      };
      
      ConnectivityService.addPendingSync(syncFn);
    }
  } catch (error) {
    console.error('Error processing pending invoices:', error);
    throw error;
  }
  
  return result;
} 