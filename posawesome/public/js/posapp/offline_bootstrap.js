// Offline Data Bootstrap Module
// This module handles downloading and validating master data for offline use

import { initDB } from './offline_db';

// Constants for object store names
const CUSTOMERS_STORE = 'offline-customers';
const ITEMS_STORE = 'offline-items';
const TAXES_STORE = 'offline-taxes';
const BOOTSTRAP_INFO_STORE = 'bootstrap-info';

// Current database version (increased to add new stores)
const REQUIRED_DB_VERSION = 2;

// Bootstrap status object
const bootstrapStatus = {
  isComplete: false,
  progress: 0,
  message: 'Not started',
  error: null,
  lastUpdated: null,
};

/**
 * Initialize database with required object stores for master data
 */
export async function initOfflineStores() {
  try {
    // Close any existing database connections
    let db = null;
    try {
      db = await initDB();
      db.close();
    } catch (error) {
      console.log('No existing database connection to close');
    }

    // Create new promise for upgrading database
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('posawesome-offline-db', REQUIRED_DB_VERSION);
      
      request.onerror = (event) => {
        console.error('Error opening IndexedDB for bootstrap:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        console.log('IndexedDB opened for bootstrap with version:', db.version);
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Upgrading IndexedDB for bootstrap to version:', event.newVersion);
        
        // Create object stores for offline master data if they don't exist
        if (!db.objectStoreNames.contains(CUSTOMERS_STORE)) {
          const customerStore = db.createObjectStore(CUSTOMERS_STORE, { keyPath: 'name' });
          customerStore.createIndex('customer_name', 'customer_name', { unique: false });
          customerStore.createIndex('mobile_no', 'mobile_no', { unique: false });
          console.log('Created customers store');
        }
        
        if (!db.objectStoreNames.contains(ITEMS_STORE)) {
          const itemStore = db.createObjectStore(ITEMS_STORE, { keyPath: 'name' });
          itemStore.createIndex('item_name', 'item_name', { unique: false });
          itemStore.createIndex('item_group', 'item_group', { unique: false });
          itemStore.createIndex('barcode', 'barcode', { unique: false });
          console.log('Created items store');
        }
        
        if (!db.objectStoreNames.contains(TAXES_STORE)) {
          const taxStore = db.createObjectStore(TAXES_STORE, { keyPath: 'name' });
          console.log('Created taxes store');
        }
        
        if (!db.objectStoreNames.contains(BOOTSTRAP_INFO_STORE)) {
          const infoStore = db.createObjectStore(BOOTSTRAP_INFO_STORE, { keyPath: 'id' });
          console.log('Created bootstrap info store');
        }
      };
    });
  } catch (error) {
    console.error('Failed to initialize offline stores:', error);
    throw error;
  }
}

/**
 * Start the bootstrap process to download all master data
 */
export async function startBootstrap(posProfile) {
  try {
    if (!posProfile) {
      throw new Error('POS Profile is required for bootstrapping');
    }
    
    console.log('Starting offline data bootstrap process');
    updateBootstrapStatus('Starting data download...', 5);
    
    // Initialize database with required stores
    const db = await initOfflineStores();
    
    // Get batch size from POS profile or use default
    const batchSize = posProfile.posa_offline_batch_size || 100;
    
    // Start downloading data in stages
    await downloadCustomers(db, posProfile, batchSize);
    updateBootstrapStatus('Customers downloaded', 40);
    
    await downloadItems(db, posProfile, batchSize);
    updateBootstrapStatus('Items downloaded', 80);
    
    await downloadTaxes(db, posProfile);
    updateBootstrapStatus('Taxes downloaded', 90);
    
    // Validate the downloaded data
    await validateData(db);
    updateBootstrapStatus('Data validated', 95);
    
    // Save bootstrap completion info
    await saveBootstrapInfo(db, posProfile);
    
    // Mark bootstrap as complete
    bootstrapStatus.isComplete = true;
    bootstrapStatus.progress = 100;
    bootstrapStatus.message = 'Bootstrap complete';
    bootstrapStatus.lastUpdated = new Date();
    
    console.log('Offline data bootstrap complete');
    return true;
  } catch (error) {
    console.error('Bootstrap process failed:', error);
    bootstrapStatus.error = error.message;
    bootstrapStatus.message = 'Bootstrap failed: ' + error.message;
    return false;
  }
}

/**
 * Download all customers in batches
 */
async function downloadCustomers(db, posProfile, batchSize) {
  try {
    updateBootstrapStatus('Downloading customers...', 10);
    
    // Clear existing customers
    await clearObjectStore(db, CUSTOMERS_STORE);
    
    // Get total count first
    const countResponse = await frappe.call({
      method: 'frappe.client.get_count',
      args: {
        doctype: 'Customer',
        filters: { 
          disabled: 0,
          company: posProfile.company
        }
      },
      async: true
    });
    
    const totalCustomers = countResponse.message || 0;
    console.log(`Total customers to download: ${totalCustomers}`);
    
    if (totalCustomers === 0) {
      updateBootstrapStatus('No customers found', 20);
      return;
    }
    
    // Download in batches
    let downloadedCount = 0;
    let page = 0;
    
    while (downloadedCount < totalCustomers) {
      updateBootstrapStatus(`Downloading customers batch ${page + 1}...`, 10 + (downloadedCount / totalCustomers) * 30);
      
      const customerResponse = await frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_customer_names',
        args: {
          pos_profile: JSON.stringify(posProfile),
          start: page * batchSize,
          page_length: batchSize
        },
        async: true
      });
      
      const customers = customerResponse.message || [];
      
      if (customers.length === 0) {
        break;
      }
      
      // Save batch to IndexedDB
      await saveDataBatch(db, CUSTOMERS_STORE, customers);
      
      downloadedCount += customers.length;
      page++;
    }
    
    updateBootstrapStatus(`Downloaded ${downloadedCount} customers`, 40);
  } catch (error) {
    console.error('Error downloading customers:', error);
    throw new Error('Failed to download customers: ' + error.message);
  }
}

/**
 * Download all items in batches
 */
async function downloadItems(db, posProfile, batchSize) {
  try {
    updateBootstrapStatus('Downloading items...', 45);
    
    // Clear existing items
    await clearObjectStore(db, ITEMS_STORE);
    
    // Get total count first
    const countResponse = await frappe.call({
      method: 'frappe.client.get_count',
      args: {
        doctype: 'Item',
        filters: { 
          disabled: 0,
          is_sales_item: 1 
        }
      },
      async: true
    });
    
    const totalItems = countResponse.message || 0;
    console.log(`Total items to download: ${totalItems}`);
    
    if (totalItems === 0) {
      updateBootstrapStatus('No items found', 50);
      return;
    }
    
    // Download in batches
    let downloadedCount = 0;
    let page = 0;
    
    while (downloadedCount < totalItems) {
      updateBootstrapStatus(`Downloading items batch ${page + 1}...`, 45 + (downloadedCount / totalItems) * 30);
      
      const itemsResponse = await frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_items',
        args: {
          pos_profile: JSON.stringify(posProfile),
          start: page * batchSize,
          page_length: batchSize
        },
        async: true
      });
      
      const items = itemsResponse.message || [];
      
      if (items.length === 0) {
        break;
      }
      
      // Save batch to IndexedDB
      await saveDataBatch(db, ITEMS_STORE, items);
      
      downloadedCount += items.length;
      page++;
    }
    
    updateBootstrapStatus(`Downloaded ${downloadedCount} items`, 75);
  } catch (error) {
    console.error('Error downloading items:', error);
    throw new Error('Failed to download items: ' + error.message);
  }
}

/**
 * Download tax templates and rates
 */
async function downloadTaxes(db, posProfile) {
  try {
    updateBootstrapStatus('Downloading taxes...', 85);
    
    // Clear existing taxes
    await clearObjectStore(db, TAXES_STORE);
    
    // Get tax templates for the company
    const taxTemplatesResponse = await frappe.call({
      method: 'frappe.client.get_list',
      args: {
        doctype: 'Sales Taxes and Charges Template',
        fields: ['name', 'company', 'is_default'],
        filters: { company: posProfile.company }
      },
      async: true
    });
    
    const taxTemplates = taxTemplatesResponse.message || [];
    console.log(`Found ${taxTemplates.length} tax templates`);
    
    // For each template, get the tax details
    for (let i = 0; i < taxTemplates.length; i++) {
      const template = taxTemplates[i];
      
      const taxDetailsResponse = await frappe.call({
        method: 'frappe.client.get',
        args: {
          doctype: 'Sales Taxes and Charges Template',
          name: template.name
        },
        async: true
      });
      
      const taxDetails = taxDetailsResponse.message;
      
      if (taxDetails) {
        // Save tax template to IndexedDB
        await saveToObjectStore(db, TAXES_STORE, taxDetails);
      }
    }
    
    updateBootstrapStatus(`Downloaded ${taxTemplates.length} tax templates`, 90);
  } catch (error) {
    console.error('Error downloading taxes:', error);
    throw new Error('Failed to download taxes: ' + error.message);
  }
}

/**
 * Validate downloaded data for integrity
 */
async function validateData(db) {
  try {
    updateBootstrapStatus('Validating data integrity...', 95);
    
    // Check if we have at least one customer
    const customerCount = await getObjectStoreCount(db, CUSTOMERS_STORE);
    console.log(`Validated ${customerCount} customers`);
    
    // Check if we have at least one item
    const itemCount = await getObjectStoreCount(db, ITEMS_STORE);
    console.log(`Validated ${itemCount} items`);
    
    // Log validation results
    console.log('Data validation completed successfully');
    
    return true;
  } catch (error) {
    console.error('Error validating data:', error);
    throw new Error('Data validation failed: ' + error.message);
  }
}

/**
 * Save bootstrap info to the info store
 */
async function saveBootstrapInfo(db, posProfile) {
  try {
    const info = {
      id: 'bootstrap_info',
      lastUpdated: new Date(),
      posProfile: posProfile.name,
      company: posProfile.company,
      customerCount: await getObjectStoreCount(db, CUSTOMERS_STORE),
      itemCount: await getObjectStoreCount(db, ITEMS_STORE),
      taxTemplateCount: await getObjectStoreCount(db, TAXES_STORE)
    };
    
    await saveToObjectStore(db, BOOTSTRAP_INFO_STORE, info);
    console.log('Saved bootstrap info:', info);
  } catch (error) {
    console.error('Error saving bootstrap info:', error);
  }
}

/**
 * Helper to save a batch of data to an object store
 */
async function saveDataBatch(db, storeName, dataArray) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    transaction.oncomplete = () => {
      resolve();
    };
    
    transaction.onerror = (event) => {
      reject(new Error(`Error saving batch to ${storeName}: ${event.target.error}`));
    };
    
    // Add each item to the store
    dataArray.forEach(item => {
      try {
        store.add(item);
      } catch (e) {
        console.error(`Error adding item to ${storeName}:`, e, item);
      }
    });
  });
}

/**
 * Helper to save a single item to an object store
 */
async function saveToObjectStore(db, storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const request = store.add(data);
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = (event) => {
      reject(new Error(`Error saving to ${storeName}: ${event.target.error}`));
    };
  });
}

/**
 * Helper to clear an object store
 */
async function clearObjectStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const request = store.clear();
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(new Error(`Error clearing ${storeName}: ${event.target.error}`));
    };
  });
}

/**
 * Helper to get count of items in an object store
 */
async function getObjectStoreCount(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    const request = store.count();
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = (event) => {
      reject(new Error(`Error counting ${storeName}: ${event.target.error}`));
    };
  });
}

/**
 * Update bootstrap status with progress
 */
function updateBootstrapStatus(message, progress) {
  bootstrapStatus.message = message;
  bootstrapStatus.progress = progress;
  bootstrapStatus.lastUpdated = new Date();
  console.log(`Bootstrap status: ${message} (${progress}%)`);
}

/**
 * Get current bootstrap status
 */
export function getBootstrapStatus() {
  return { ...bootstrapStatus };
}

/**
 * Check if bootstrap is complete
 */
export function isBootstrapComplete() {
  return bootstrapStatus.isComplete;
}

/**
 * Check if bootstrap needs to be performed based on last update time
 */
export async function checkBootstrapNeeded(db, posProfile) {
  try {
    // Get bootstrap info from store
    const info = await getBootstrapInfo(db);
    
    if (!info) {
      console.log('No bootstrap info found, bootstrap needed');
      return true;
    }
    
    // Check if POS profile has changed
    if (info.posProfile !== posProfile.name) {
      console.log('POS profile changed, bootstrap needed');
      return true;
    }
    
    // Check if company has changed
    if (info.company !== posProfile.company) {
      console.log('Company changed, bootstrap needed');
      return true;
    }
    
    // Check if it's been more than 24 hours since last update
    const lastUpdate = new Date(info.lastUpdated);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate > 24) {
      console.log(`Last bootstrap was ${hoursSinceUpdate.toFixed(2)} hours ago, bootstrap needed`);
      return true;
    }
    
    console.log('Bootstrap not needed, data is up to date');
    bootstrapStatus.isComplete = true;
    bootstrapStatus.progress = 100;
    bootstrapStatus.message = 'Using cached data';
    
    return false;
  } catch (error) {
    console.error('Error checking bootstrap need:', error);
    return true;
  }
}

/**
 * Get bootstrap info from store
 */
async function getBootstrapInfo(db) {
  try {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([BOOTSTRAP_INFO_STORE], 'readonly');
      const store = transaction.objectStore(BOOTSTRAP_INFO_STORE);
      
      const request = store.get('bootstrap_info');
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Error getting bootstrap info: ${event.target.error}`));
      };
    });
  } catch (error) {
    console.error('Error getting bootstrap info:', error);
    return null;
  }
} 