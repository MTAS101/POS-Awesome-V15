// Utility functions for IndexedDB operations

const DB_NAME = 'POS_DB';
const DB_VERSION = 2; // Increment version for schema update
const ORDERS_STORE = 'offline-orders';
const INVOICE_STORE = 'invoices';
const SEQUENCE_STORE = 'sequences';

// Global reference to the database
let dbPromise = null;

// Helper to generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0,
        v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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

      // Create/update invoices store with indexes
      if (!db.objectStoreNames.contains(INVOICE_STORE)) {
        const store = db.createObjectStore(INVOICE_STORE, { keyPath: 'offline_uuid' });
        store.createIndex('offline_pos_name', 'offline_pos_name', { unique: true });
        store.createIndex('creation_timestamp', 'creation_timestamp');
        store.createIndex('sync_status', 'sync_status');
        store.createIndex('idempotency_key', 'idempotency_key', { unique: true });
      }

      // Create/update sequences store
      if (!db.objectStoreNames.contains(SEQUENCE_STORE)) {
        const seqStore = db.createObjectStore(SEQUENCE_STORE, { keyPath: 'name' });
        seqStore.put({ name: 'invoice_sequence', value: 1 });
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

// Get next sequence number
async function getNextSequence(db, sequenceName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SEQUENCE_STORE, 'readwrite');
    const store = transaction.objectStore(SEQUENCE_STORE);
    
    const request = store.get(sequenceName);
    
    request.onsuccess = () => {
      const sequence = request.result;
      const nextValue = sequence.value + 1;
      
      store.put({ name: sequenceName, value: nextValue });
      resolve(sequence.value);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Save invoice to IndexedDB with idempotency
async function saveInvoiceOffline(invoice) {
  try {
    const db = await initDB();
    const sequence = await getNextSequence(db, 'invoice_sequence');
    
    // Generate persistent unique identifiers
    const timestamp = Date.now();
    const uuid = generateUUID();
    const idempotencyKey = `${uuid}-${timestamp}`;
    
    // Prepare invoice data with identifiers
    const invoiceData = {
      ...invoice,
      offline_uuid: uuid,
      offline_pos_name: `OFFPOS${sequence}`,
      creation_timestamp: timestamp,
      sync_status: 'pending',
      sync_attempts: 0,
      idempotency_key: idempotencyKey,
      offline_mode: true
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(INVOICE_STORE, 'readwrite');
      const store = transaction.objectStore(INVOICE_STORE);
      
      const request = store.add(invoiceData);
      
      request.onsuccess = () => resolve(invoiceData.offline_pos_name);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error saving invoice offline:', error);
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

// Get pending invoices for sync
async function getPendingInvoices() {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INVOICE_STORE, 'readonly');
    const store = transaction.objectStore(INVOICE_STORE);
    const index = store.index('sync_status');
    
    const request = index.getAll('pending');
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Update invoice sync status
async function updateInvoiceSyncStatus(uuid, status, error = null) {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INVOICE_STORE, 'readwrite');
    const store = transaction.objectStore(INVOICE_STORE);
    
    const request = store.get(uuid);
    
    request.onsuccess = () => {
      const invoice = request.result;
      if (invoice) {
        invoice.sync_status = status;
        invoice.sync_attempts += 1;
        invoice.last_sync_attempt = Date.now();
        if (error) {
          invoice.last_sync_error = error;
        }
        
        store.put(invoice);
        resolve(true);
      } else {
        resolve(false);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Export functions
export {
  initDB,
  saveInvoiceOffline,
  getPendingInvoices,
  updateInvoiceSyncStatus,
  generateUUID
}; 