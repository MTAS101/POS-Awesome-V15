// Utility functions for IndexedDB operations

const DB_NAME = 'posawesome-offline-db';
const DB_VERSION = 1;
const ORDERS_STORE = 'offline-orders';

// Initialize the database
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log('IndexedDB initialized successfully');
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores for offline orders
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        const store = db.createObjectStore(ORDERS_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('customer', 'customer', { unique: false });
        console.log('Object store created for offline orders');
      }
    };
  });
}

// Save invoice to IndexedDB for offline storage
export async function saveInvoiceOffline(invoice) {
  try {
    const db = await initDB();
    const transaction = db.transaction([ORDERS_STORE], 'readwrite');
    const store = transaction.objectStore(ORDERS_STORE);
    
    // Add timestamp for sorting/tracking
    const order = {
      ...invoice,
      timestamp: Date.now(),
      synced: false
    };
    
    const request = store.add(order);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('Invoice saved offline:', request.result);
        
        // Try to sync with service worker if available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then(registration => {
            registration.sync.register('sync-orders').catch(err => {
              console.error('Background sync registration failed:', err);
            });
            
            // Also send a message to the service worker
            navigator.serviceWorker.controller?.postMessage({
              type: 'STORE_OFFLINE_ORDER',
              payload: order
            });
          });
        }
        
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Error saving invoice offline:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to save invoice offline:', error);
    throw error;
  }
}

// Get all pending offline orders
export async function getPendingOrders() {
  try {
    const db = await initDB();
    const transaction = db.transaction([ORDERS_STORE], 'readonly');
    const store = transaction.objectStore(ORDERS_STORE);
    const index = store.index('timestamp');
    
    const request = index.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const pendingOrders = request.result.filter(order => !order.synced);
        console.log(`Found ${pendingOrders.length} pending orders`);
        resolve(pendingOrders);
      };
      
      request.onerror = (event) => {
        console.error('Error getting pending orders:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to get pending orders:', error);
    return [];
  }
}

// Mark an order as synced
export async function markOrderSynced(id) {
  try {
    const db = await initDB();
    const transaction = db.transaction([ORDERS_STORE], 'readwrite');
    const store = transaction.objectStore(ORDERS_STORE);
    
    // First get the order
    const getRequest = store.get(id);
    
    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const order = getRequest.result;
        if (!order) {
          reject(new Error(`Order with ID ${id} not found`));
          return;
        }
        
        // Update the order to mark as synced
        order.synced = true;
        order.syncedAt = Date.now();
        
        const updateRequest = store.put(order);
        
        updateRequest.onsuccess = () => {
          console.log(`Order ${id} marked as synced`);
          resolve(true);
        };
        
        updateRequest.onerror = (event) => {
          console.error('Error marking order as synced:', event.target.error);
          reject(event.target.error);
        };
      };
      
      getRequest.onerror = (event) => {
        console.error('Error getting order to mark as synced:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to mark order as synced:', error);
    throw error;
  }
}

// Process all pending invoices
export async function processPendingInvoices() {
  try {
    const pendingOrders = await getPendingOrders();
    
    if (pendingOrders.length === 0) {
      console.log('No pending orders to process');
      return { success: true, processed: 0 };
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const order of pendingOrders) {
      try {
        // Call the server API to process the order
        const response = await fetch('/api/method/posawesome.posawesome.api.posapp.update_invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-CSRF-Token': frappe.csrf_token
          },
          body: JSON.stringify({ data: order })
        });
        
        if (response.ok) {
          await markOrderSynced(order.id);
          successCount++;
        } else {
          console.error('Error syncing order:', order.id, await response.text());
          errorCount++;
        }
      } catch (error) {
        console.error('Error processing pending order:', order.id, error);
        errorCount++;
      }
    }
    
    return {
      success: errorCount === 0,
      processed: successCount,
      failed: errorCount,
      total: pendingOrders.length
    };
  } catch (error) {
    console.error('Failed to process pending invoices:', error);
    return { success: false, error: error.message };
  }
}

// Check online status
export function isOnline() {
  return navigator.onLine;
}

// Listen for online/offline events
export function setupConnectivityListeners(callbacks = {}) {
  const handleOnline = () => {
    console.log('App is online');
    if (callbacks.onOnline) callbacks.onOnline();
  };
  
  const handleOffline = () => {
    console.log('App is offline');
    if (callbacks.onOffline) callbacks.onOffline();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Return a cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
} 