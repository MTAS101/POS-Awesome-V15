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
    console.log('Starting saveInvoiceOffline for customer:', invoice.customer);
    const db = await ensureStoreExists();
    
    // Generate a unique ID for tracking if not already set
    if (!invoice.offline_pos_name) {
      invoice.offline_pos_name = 'Offline-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }
    
    return new Promise((resolve, reject) => {
      // Verify the store exists before creating transaction
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        console.error(`Object store '${ORDERS_STORE}' does not exist`);
        reject(new Error(`Object store '${ORDERS_STORE}' does not exist`));
        return;
      }
      
      try {
        const transaction = db.transaction([ORDERS_STORE], 'readwrite');
        const store = transaction.objectStore(ORDERS_STORE);
        
        // First check if this invoice already exists using getAllKeys for better performance
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          try {
            const existingOrders = getAllRequest.result || [];
            console.log(`Found ${existingOrders.length} existing orders, checking for duplicates`);
            
            // Check for duplicates with improved logic
            const isDuplicate = existingOrders.some(order => {
              // Check for exact offline_pos_name match (same invoice)
              if (order.offline_pos_name === invoice.offline_pos_name) {
                console.log('Found exact duplicate by offline_pos_name:', invoice.offline_pos_name);
                return true;
              }
              
              // Check for very recent invoice for same customer with same items count
              // This helps prevent duplicate submissions from double-clicking
              if (order.customer === invoice.customer && 
                  order.items?.length === invoice.items?.length &&
                  Date.now() - order.timestamp < 10000) { // Within last 10 seconds
                
                console.log('Found potential duplicate by customer and items within 10 seconds');
                
                // For extra certainty, check if the total matches
                if (Math.abs(order.grand_total - invoice.grand_total) < 0.01) {
                  console.log('Totals match, confirming as duplicate');
                  return true;
                }
              }
              
              return false;
            });
            
            if (isDuplicate) {
              console.log('Invoice is a duplicate, not saving:', invoice.offline_pos_name);
              resolve(null); // Resolve with null to indicate no new invoice was created
              return;
            }
            
            // If we get here, it's not a duplicate
            console.log('Invoice is not a duplicate, proceeding with save');
            
            // Sanitize the invoice to remove non-serializable data and circular references
            const sanitizedInvoice = sanitizeForStorage(invoice);
            
            // Add timestamp for sorting/tracking and set offline_submit flag to true
            // so invoice will be submitted when synced online, not saved as draft
            const order = {
              ...sanitizedInvoice,
              timestamp: Date.now(),
              synced: false,
              offline_submit: true, // Always set to true to ensure invoice is submitted when synced
              stored_at: new Date().toISOString() // Add ISO string timestamp for debugging
            };
            
            // Log key details for debugging
            console.log('Saving invoice with details:', {
              customer: order.customer,
              offline_pos_name: order.offline_pos_name,
              total: order.grand_total || order.total,
              items_count: order.items?.length
            });
            
            const request = store.add(order);
            
            request.onsuccess = () => {
              console.log('Invoice saved offline successfully with ID:', request.result);
              
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
              
              // Resolve with the ID
              resolve(request.result);
              
              // Update offline queue count
              const event = new CustomEvent('offline-queue-updated', {
                detail: { count: existingOrders.length + 1 }
              });
              window.dispatchEvent(event);
            };
            
            request.onerror = (event) => {
              console.error('Error saving invoice offline:', event.target.error);
              reject(event.target.error);
            };
          } catch (checkError) {
            console.error('Error in duplicate check logic:', checkError);
            // If the duplicate check fails, log the error but still try to save
            // This is a fallback to ensure the invoice is saved even if duplicate check fails
            const sanitizedInvoice = sanitizeForStorage(invoice);
            const order = {
              ...sanitizedInvoice,
              timestamp: Date.now(),
              synced: false,
              offline_submit: true
            };
            
            const request = store.add(order);
            
            request.onsuccess = () => {
              console.log('Invoice saved offline (after duplicate check error):', request.result);
              resolve(request.result);
            };
            
            request.onerror = (event) => {
              console.error('Error saving invoice offline after duplicate check error:', event.target.error);
              reject(event.target.error);
            };
          }
        };
        
        getAllRequest.onerror = (event) => {
          console.error('Error checking for duplicates:', event.target.error);
          // Continue with saving anyway since we failed at duplicate check
          
          const sanitizedInvoice = sanitizeForStorage(invoice);
          const order = {
            ...sanitizedInvoice,
            timestamp: Date.now(),
            synced: false,
            offline_submit: true // Always set to true to ensure invoice is submitted when synced
          };
          
          const request = store.add(order);
          
          request.onsuccess = () => {
            console.log('Invoice saved offline (after duplicate check failed):', request.result);
            resolve(request.result);
          };
          
          request.onerror = (event) => {
            console.error('Error saving invoice offline:', event.target.error);
            reject(event.target.error);
          };
        };
        
        // Handle transaction errors
        transaction.onerror = (event) => {
          console.error('Transaction error:', event.target.error);
          reject(event.target.error);
        };
      } catch (transactionError) {
        console.error('Error creating transaction:', transactionError);
        reject(transactionError);
      }
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

// Process all pending invoices
export async function processPendingInvoices() {
  try {
    // Fetch all pending orders that haven't been synced yet
    const pendingOrders = await getPendingOrders();
    
    if (pendingOrders.length === 0) {
      console.log('No pending orders to process');
      return { success: true, processed: 0 };
    }
    
    console.log(`Found ${pendingOrders.length} pending orders to process`);
    
    // Track order processing
    let successCount = 0;
    let errorCount = 0;
    
    // Use a map to keep track of orders by unique identifiers
    // This prevents duplicate processing of invoices with similar data
    const orderTrackingMap = new Map();
    
    // Process orders sequentially to prevent race conditions
    for (const order of pendingOrders) {
      try {
        // Create a unique key for this order using customer + timestamp or offline_pos_name
        const uniqueKey = order.offline_pos_name || 
                          `${order.customer}-${order.timestamp}-${order.items?.length || 0}`;
        
        // Skip if we've already processed an order with this unique key
        if (orderTrackingMap.has(uniqueKey)) {
          console.log(`Skipping potential duplicate order: ${uniqueKey}`);
          continue;
        }
        
        // Add to tracking map
        orderTrackingMap.set(uniqueKey, true);
        
        console.log(`Processing order: ${order.id}`);
        console.log('Order details:', {
          customer: order.customer,
          timestamp: new Date(order.timestamp).toISOString(),
          offline_pos_name: order.offline_pos_name,
          total: order.total,
          items_count: order.items?.length || 0
        });
        
        // Ensure critical POS fields are properly set
        const processedOrder = {
          ...order,
          is_pos: 1,
          update_stock: 1,
          offline_submit: true // Ensure invoice is submitted, not saved as draft
        };
        
        // Ensure payments are properly set
        if (processedOrder.payments && processedOrder.payments.length > 0) {
          // Make sure at least one payment has an amount
          let hasPaymentAmount = false;
          
          for (const payment of processedOrder.payments) {
            if (payment.amount && payment.amount !== 0) {
              hasPaymentAmount = true;
            }
          }
          
          // If no payment has amount, set the default payment to the invoice total
          if (!hasPaymentAmount && processedOrder.payments.length > 0) {
            const defaultPayment = processedOrder.payments.find(p => p.default) || 
                                  processedOrder.payments[0];
                                  
            const totalAmount = processedOrder.grand_total || processedOrder.rounded_total || processedOrder.total;
            defaultPayment.amount = totalAmount;
            
            // Also set base_amount for multi-currency
            if (processedOrder.conversion_rate) {
              defaultPayment.base_amount = totalAmount * processedOrder.conversion_rate;
            }
            
            console.log(`Set default payment amount to ${defaultPayment.amount}`);
          }
        }
        
        // Make API call with proper parameters
        console.log('Submitting order to server with submit=true and include_payments=true');
        const response = await frappe.call({
          method: 'posawesome.posawesome.api.posapp.update_invoice',
          args: {
            data: processedOrder,
            submit: true, // Always submit when syncing
            include_payments: true // Ensure payments are included
          }
        });
        
        if (response.message) {
          if (response.message.error) {
            // Server returned success:false with an error message
            console.error('Server error processing order:', response.message.error);
            errorCount++;
            
            // Don't mark as synced, will retry later
            continue;
          }
          
          // Successfully processed the order
          console.log('Server successfully processed order:', response.message.name);
          
          try {
            // Mark this order as synced in our offline database
            await markOrderSynced(order.id);
            successCount++;
            
            // Send an event for UI updates
            const event = new CustomEvent('offline-invoice-synced', {
              detail: { 
                success: true, 
                invoice: response.message.name,
                customer: order.customer
              }
            });
            window.dispatchEvent(event);
            
          } catch (markError) {
            console.error('Error marking order as synced:', markError);
            // Continue processing other orders even if marking this one failed
          }
        } else {
          console.error('No response message from server for order:', order.id);
          errorCount++;
        }
      } catch (orderError) {
        console.error('Error processing order:', order.id, orderError);
        errorCount++;
        
        // Continue with next order
        continue;
      }
      
      // Add a small delay between orders to prevent overloading the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Fetch updated count of pending orders
    const remainingOrders = await getPendingOrders();
    const remainingCount = remainingOrders.length;
    
    console.log(`Processing complete: ${successCount} succeeded, ${errorCount} failed, ${remainingCount} remaining`);
    
    // Notify the UI about updated queue count
    const event = new CustomEvent('offline-queue-updated', {
      detail: { count: remainingCount }
    });
    window.dispatchEvent(event);
    
    // Show appropriate message based on results
    if (successCount > 0) {
      frappe.show_alert({
        message: __(`Successfully synced ${successCount} offline orders`),
        indicator: 'green'
      }, 5);
    }
    
    if (errorCount > 0) {
      frappe.show_alert({
        message: __(`Failed to sync ${errorCount} offline orders - will retry automatically`),
        indicator: 'red'
      }, 5);
    }
    
    return { 
      success: true, 
      processed: successCount,
      errors: errorCount,
      remaining: remainingCount
    };
  } catch (error) {
    console.error('Fatal error in processPendingInvoices:', error);
    
    // Show error message
    frappe.show_alert({
      message: __(`Error synchronizing orders: ${error.message}`),
      indicator: 'red'
    }, 5);
    
    return { 
      success: false, 
      error: error.message 
    };
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