// Utility functions for IndexedDB operations

const DB_NAME = 'posawesome-offline-db';
// Use a default version but detect actual version during initialization
let DB_VERSION = 1;
const ORDERS_STORE = 'offline-orders';

// Global reference to the database
let dbPromise = null;

// Function to detect current database version
async function getCurrentDbVersion() {
  return new Promise((resolve) => {
    // Open with a dummy version to just check existing version
    const request = indexedDB.open(DB_NAME);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const currentVersion = db.version;
      console.log('Current IndexedDB version:', currentVersion);
      db.close();
      resolve(currentVersion);
    };
    
    request.onupgradeneeded = (event) => {
      // This shouldn't happen when just checking version
      // If it does, it means the DB doesn't exist yet
      const db = event.target.result;
      db.close();
      resolve(1); // Default to version 1 if DB doesn't exist
    };
    
    request.onerror = () => {
      console.warn('Error checking DB version, using default version:', DB_VERSION);
      resolve(DB_VERSION); // Default to current version if error
    };
  });
}

// Initialize the database
export async function initDB() {
  // Return existing promise if already initializing
  if (dbPromise) return dbPromise;
  
  // Detect current database version first
  try {
    DB_VERSION = await getCurrentDbVersion();
  } catch (error) {
    console.warn('Error detecting database version:', error);
    // Continue with default version
  }
  
  // Create new promise for initialization
  dbPromise = new Promise((resolve, reject) => {
    console.log('Opening IndexedDB with version:', DB_VERSION);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event.target.error);
      dbPromise = null; // Reset promise on error
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log('IndexedDB initialized successfully with version:', db.version);
      
      // Add error handler for database
      db.onerror = (event) => {
        console.error('Database error:', event.target.errorCode);
      };
      
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('Upgrading IndexedDB to version:', event.newVersion);
      
      // Create object stores for offline orders
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        const store = db.createObjectStore(ORDERS_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('customer', 'customer', { unique: false });
        console.log('Object store created for offline orders');
      }
    };
  });
  
  return dbPromise;
}

// Ensure database is initialized and stores exist
async function ensureStoreExists() {
  try {
    const db = await initDB();
    // Verify store exists
    if (!db.objectStoreNames.contains(ORDERS_STORE)) {
      // If store doesn't exist, close and reopen with incremented version
      db.close();
      dbPromise = null; // Reset promise
      
      // Reopen with incremented version
      const newVersion = db.version + 1;
      console.log('Store missing, reopening with version:', newVersion);
      
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, newVersion);
        
        request.onerror = (event) => {
          console.error('Error reopening IndexedDB:', event.target.error);
          reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
          console.log('Successfully reopened database with version:', newVersion);
          resolve(event.target.result);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          // Create missing store
          if (!db.objectStoreNames.contains(ORDERS_STORE)) {
            const store = db.createObjectStore(ORDERS_STORE, { keyPath: 'id', autoIncrement: true });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('customer', 'customer', { unique: false });
            console.log('Object store created for offline orders on retry');
          }
        };
      });
      
      return dbPromise;
    }
    
    return db;
  } catch (error) {
    console.error('Error ensuring store exists:', error);
    throw error;
  }
}

// Save invoice to IndexedDB for offline storage
export async function saveInvoiceOffline(invoice) {
  try {
    const db = await ensureStoreExists();
    
    return new Promise((resolve, reject) => {
      // Verify the store exists before creating transaction
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        reject(new Error(`Object store '${ORDERS_STORE}' does not exist`));
        return;
      }
      
      const transaction = db.transaction([ORDERS_STORE], 'readwrite');
      const store = transaction.objectStore(ORDERS_STORE);
      
      // Sanitize the invoice to remove non-serializable data and circular references
      const sanitizedInvoice = sanitizeForStorage(invoice);
      
      // Add timestamp for sorting/tracking
      const order = {
        ...sanitizedInvoice,
        timestamp: Date.now(),
        synced: false
      };
      
      const request = store.add(order);
      
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
              payload: { id: request.result, timestamp: Date.now() }
            });
          });
        }
        
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Error saving invoice offline:', event.target.error);
        reject(event.target.error);
      };
      
      // Handle transaction errors
      transaction.onerror = (event) => {
        console.error('Transaction error:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to save invoice offline:', error);
    throw error;
  }
}

// Function to sanitize invoice data for storage
function sanitizeForStorage(invoice) {
  // Create a deep clone of the invoice to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify({
    // Only include necessary fields with proper serialization
    doctype: invoice.doctype,
    name: invoice.name || null,
    customer: invoice.customer,
    posting_date: invoice.posting_date,
    due_date: invoice.due_date,
    currency: invoice.currency,
    conversion_rate: invoice.conversion_rate,
    is_return: invoice.is_return ? 1 : 0,
    total: invoice.total,
    net_total: invoice.net_total,
    base_total: invoice.base_total,
    base_net_total: invoice.base_net_total,
    discount_amount: invoice.discount_amount,
    base_discount_amount: invoice.base_discount_amount,
    additional_discount_percentage: invoice.additional_discount_percentage,
    grand_total: invoice.grand_total,
    base_grand_total: invoice.base_grand_total,
    rounded_total: invoice.rounded_total,
    base_rounded_total: invoice.base_rounded_total,
    company: invoice.company,
    pos_profile: invoice.pos_profile,
    posa_pos_opening_shift: invoice.posa_pos_opening_shift,
    posa_is_offer_applied: invoice.posa_is_offer_applied ? 1 : 0,
    return_against: invoice.return_against || null,
    
    // Clean items array - ensure only serializable data
    items: (invoice.items || []).map(item => ({
      item_code: item.item_code,
      item_name: item.item_name,
      qty: item.qty,
      rate: item.rate,
      base_rate: item.base_rate,
      amount: item.amount,
      base_amount: item.base_amount,
      discount_percentage: item.discount_percentage,
      discount_amount: item.discount_amount,
      base_discount_amount: item.base_discount_amount,
      stock_qty: item.stock_qty,
      uom: item.uom,
      conversion_factor: item.conversion_factor,
      stock_uom: item.stock_uom,
      price_list_rate: item.price_list_rate,
      base_price_list_rate: item.base_price_list_rate,
      serial_no: item.serial_no,
      batch_no: item.batch_no,
      posa_notes: item.posa_notes,
      posa_delivery_date: item.posa_delivery_date,
      posa_offers: typeof item.posa_offers === 'string' ? item.posa_offers : JSON.stringify([]),
      posa_offer_applied: item.posa_offer_applied ? 1 : 0,
      posa_is_offer: item.posa_is_offer ? 1 : 0,
      posa_is_replace: item.posa_is_replace || null,
      is_free_item: item.is_free_item ? 1 : 0
    })),
    
    // Clean payments array
    payments: (invoice.payments || []).map(payment => ({
      mode_of_payment: payment.mode_of_payment,
      amount: payment.amount,
      base_amount: payment.base_amount,
      type: payment.type,
      account: payment.account,
      default: payment.default ? 1 : 0,
      currency: payment.currency,
      conversion_rate: payment.conversion_rate
    })),
    
    // Clean offers data to avoid circular references
    posa_offers: (invoice.posa_offers || []).map(offer => ({
      offer_name: offer.offer_name,
      row_id: offer.row_id,
      apply_on: offer.apply_on,
      offer: offer.offer,
      items: typeof offer.items === 'string' ? offer.items : JSON.stringify(offer.items || []),
      give_item: offer.give_item,
      give_item_row_id: offer.give_item_row_id,
      offer_applied: offer.offer_applied ? 1 : 0,
      coupon_based: offer.coupon_based ? 1 : 0,
      coupon: offer.coupon
    })),
    
    // Other necessary data
    posa_coupons: invoice.posa_coupons || [],
    taxes: invoice.taxes || [],
    posa_delivery_charges: invoice.posa_delivery_charges || null,
    posa_delivery_charges_rate: invoice.posa_delivery_charges_rate || 0
  }));
  
  return sanitized;
}

// Get all pending offline orders
export async function getPendingOrders() {
  try {
    const db = await ensureStoreExists();
    
    return new Promise((resolve, reject) => {
      // Verify the store exists before creating transaction
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        console.warn(`Object store '${ORDERS_STORE}' does not exist yet, returning empty array`);
        resolve([]);
        return;
      }
      
      // Use a try/catch block inside the promise for better error handling
      try {
        const transaction = db.transaction([ORDERS_STORE], 'readonly');
        const store = transaction.objectStore(ORDERS_STORE);
        
        // Handle transaction errors
        transaction.onerror = (event) => {
          console.error('Transaction error when getting pending orders:', event.target.error);
          reject(event.target.error);
        };
        
        // Use the timestamp index if it exists
        let request;
        try {
          const index = store.index('timestamp');
          request = index.getAll();
        } catch (indexError) {
          console.warn('Index not found, falling back to getAll() on store:', indexError);
          request = store.getAll();
        }
        
        request.onsuccess = () => {
          try {
            // Filter out synced orders, handle empty result
            const pendingOrders = request.result ? 
              request.result.filter(order => !order.synced) : 
              [];
            
            console.log(`Found ${pendingOrders.length} pending orders`);
            resolve(pendingOrders);
          } catch (filterError) {
            console.error('Error filtering pending orders:', filterError);
            // Return empty array instead of failing completely
            resolve([]);
          }
        };
        
        request.onerror = (event) => {
          console.error('Error getting pending orders:', event.target.error);
          reject(event.target.error);
        };
      } catch (transactionError) {
        console.error('Error creating transaction:', transactionError);
        // Return empty array instead of rejecting
        resolve([]);
      }
    });
  } catch (error) {
    console.error('Failed to get pending orders:', error);
    return [];
  }
}

// Mark an order as synced
export async function markOrderSynced(id) {
  try {
    const db = await ensureStoreExists();
    
    return new Promise((resolve, reject) => {
      // Verify the store exists before creating transaction
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        reject(new Error(`Object store '${ORDERS_STORE}' does not exist`));
        return;
      }
      
      const transaction = db.transaction([ORDERS_STORE], 'readwrite');
      const store = transaction.objectStore(ORDERS_STORE);
      
      // First get the order
      const getRequest = store.get(id);
      
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
      
      // Handle transaction errors
      transaction.onerror = (event) => {
        console.error('Transaction error when marking order as synced:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to mark order as synced:', error);
    throw error;
  }
}

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
        console.log('Processing order:', order.id);
        
        // Check if this invoice should be submitted (not just saved as draft)
        const shouldSubmit = order.offline_submit === true;
        
        // Server expects data in a specific format
        // The API is expecting a string that it will JSON.parse,
        // but we need to send a proper object wrapped in a data field
        const requestData = {
          data: JSON.stringify(order),
          submit: shouldSubmit ? 1 : 0  // Add submit flag if this should be submitted
        };
        
        console.log('Sending order with submit flag:', shouldSubmit);
        
        // Call the server API to process the order
        const response = await fetch('/api/method/posawesome.posawesome.api.posapp.update_invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-CSRF-Token': frappe.csrf_token
          },
          body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
          console.log('Successfully synced order:', order.id);
          await markOrderSynced(order.id);
          successCount++;
        } else {
          const errorText = await response.text();
          console.error('Error syncing order:', order.id, errorText);
          
          try {
            // Try to parse error response
            const errorJson = JSON.parse(errorText);
            console.error('Server error details:', errorJson);
          } catch (parseError) {
            // If parsing fails, just log the raw text
            console.error('Raw error response:', errorText);
          }
          
          errorCount++;
        }
      } catch (error) {
        console.error('Error processing pending order:', order.id, error);
        errorCount++;
      }
    }
    
    if (errorCount > 0) {
      frappe.show_alert({
        message: __(`Failed to sync ${errorCount} offline order(s). Will retry automatically.`),
        indicator: 'red'
      });
    }
    
    if (successCount > 0) {
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