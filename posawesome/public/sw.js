// Import Workbox from CDN - in production you might want to use a bundled version
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log(`Workbox is loaded`);
  
  workbox.setConfig({ debug: false });
  
  // Force development builds
  workbox.setConfig({ debug: true });
  
  // Cache names
  workbox.core.setCacheNameDetails({
    prefix: 'posawesome',
    suffix: 'v1',
    precache: 'precache',
    runtime: 'runtime'
  });
  
  // Skip waiting and claim clients
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();
  
  // Cache CSS, JS, and Web Worker files with a 'Cache First' strategy
  workbox.routing.registerRoute(
    ({request}) => 
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'worker',
    new workbox.strategies.CacheFirst({
      cacheName: 'assets-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );
  
  // Cache images with a 'Cache First' strategy
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'images-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );
  
  // Cache page navigations (HTML) with a 'Cache First' strategy for POS app
  workbox.routing.registerRoute(
    ({url}) => url.pathname.includes('/app/posapp'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'pos-pages-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
      networkTimeoutSeconds: 3, // Fallback to cache after 3 seconds
    })
  );
  
  // Cache all POS app assets with a 'Cache First' strategy
  workbox.routing.registerRoute(
    ({url}) => url.pathname.includes('/assets/posawesome/'),
    new workbox.strategies.CacheFirst({
      cacheName: 'pos-assets-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );
  
  // Cache all Frappe assets with a 'Cache First' strategy
  workbox.routing.registerRoute(
    ({url}) => url.pathname.includes('/assets/frappe/'),
    new workbox.strategies.CacheFirst({
      cacheName: 'frappe-assets-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );
  
  // Cache all API responses with a 'Network First' strategy
  workbox.routing.registerRoute(
    ({url}) => url.pathname.includes('/api/method/'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 12 * 60 * 60, // 12 Hours
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
      networkTimeoutSeconds: 3, // Fallback to cache after 3 seconds
    })
  );
  
  // Precache essential POS app files
  workbox.precaching.precacheAndRoute([
    { url: '/assets/posawesome/js/posapp/posapp.js', revision: '1.0.0' },
    { url: '/assets/posawesome/css/posawesome.css', revision: '1.0.0' },
    { url: '/assets/frappe/js/frappe.js', revision: '1.0.0' },
    { url: '/assets/js/control.js', revision: '1.0.0' },
    { url: '/assets/js/dialog.js', revision: '1.0.0' },
    { url: '/assets/js/form.js', revision: '1.0.0' }
  ]);
  
  // Other page navigations with Network First
  workbox.routing.registerRoute(
    ({request}) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );
  
  // Cache API responses with a stale-while-revalidate strategy for better offline performance
  workbox.routing.registerRoute(
    new RegExp('/api/method/(?!posawesome).*'),  // All API routes except posawesome
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'api-general-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 12 * 60 * 60, // 12 Hours
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );
  
  // Specific cache for frequently accessed POS data
  workbox.routing.registerRoute(
    new RegExp('/api/method/posawesome.*'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'pos-api-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 4 * 60 * 60, // 4 Hours
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
      networkTimeoutSeconds: 3,  // Fallback to cache if network is slow
    })
  );
  
  // Background Sync for offline invoice submissions
  const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('invoiceQueue', {
    maxRetentionTime: 24 * 60 // Retry for up to 24 Hours (specified in minutes)
  });
  
  workbox.routing.registerRoute(
    new RegExp('/api/method/posawesome.posawesome.api.posapp.update_invoice'),
    new workbox.strategies.NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    'POST'
  );
  
  // Handle push notifications
  self.addEventListener('push', (event) => {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/assets/posawesome/icons/icon-192x192.png',
      badge: '/assets/posawesome/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '1',
        url: data.url || '/app/posapp'
      },
      actions: [
        {
          action: 'explore',
          title: 'View',
          icon: '/assets/posawesome/icons/icon-72x72.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });
  
  // Handle notification click
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'explore') {
      event.waitUntil(
        clients.openWindow(event.notification.data.url)
      );
    } else {
      event.waitUntil(
        clients.openWindow('/app/posapp')
      );
    }
  });
  
  // IndexedDB setup for offline order storage
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'STORE_OFFLINE_ORDER') {
      // This will be handled by the background sync plugin
      console.log('Order stored for offline sync:', event.data.payload);
    }
  });

  // Handle background sync for invoices
  self.addEventListener('sync', async (event) => {
    if (event.tag === 'sync-invoices') {
      event.waitUntil(syncInvoices());
    }
  });

  // Function to sync invoices
  async function syncInvoices() {
    try {
      const db = await openDB();
      const submittedInvoices = JSON.parse(localStorage.getItem('submitted_offline_invoices') || '[]');
      const pendingInvoices = await getPendingInvoices(db);
      
      for (const invoice of pendingInvoices) {
        try {
          // Skip if already submitted
          if (invoice.submitted || submittedInvoices.includes(invoice.offline_id)) {
            console.log('Skipping already submitted invoice:', invoice.offline_id);
            continue;
          }

          // Mark as submitted before sending
          await markInvoiceAsSubmitted(db, invoice.offline_id);
          
          const response = await submitInvoice(invoice);
          if (response.message) {
            await removeInvoice(db, invoice.offline_id);
            
            // Remove from localStorage
            const updatedSubmitted = submittedInvoices.filter(id => id !== invoice.offline_id);
            localStorage.setItem('submitted_offline_invoices', JSON.stringify(updatedSubmitted));
          }
        } catch (error) {
          console.error('Error syncing invoice:', error);
          await markInvoiceAsNotSubmitted(db, invoice.offline_id);
        }
      }
    } catch (error) {
      console.error('Error in sync process:', error);
    }
  }

  // Open IndexedDB
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('POS_DB', 1);
      
      request.onerror = () => reject(new Error('Failed to open database'));
      request.onsuccess = (event) => resolve(event.target.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('invoices')) {
          const store = db.createObjectStore('invoices', { keyPath: 'offline_id' });
          store.createIndex('sync_status', 'sync_status');
          store.createIndex('created_at', 'created_at');
          store.createIndex('submitted', 'submitted');
        }
      };
    });
  }

  // Get pending invoices
  function getPendingInvoices(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['invoices'], 'readonly');
      const store = transaction.objectStore('invoices');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get pending invoices'));
    });
  }

  // Mark invoice as submitted
  function markInvoiceAsSubmitted(db, offlineId) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['invoices'], 'readwrite');
      const store = transaction.objectStore('invoices');
      const request = store.get(offlineId);
      
      request.onsuccess = (e) => {
        const invoice = e.target.result;
        if (invoice) {
          invoice.submitted = true;
          store.put(invoice);
          resolve();
        } else {
          reject(new Error('Invoice not found'));
        }
      };
      
      request.onerror = () => reject(new Error('Failed to mark invoice as submitted'));
    });
  }

  // Mark invoice as not submitted
  function markInvoiceAsNotSubmitted(db, offlineId) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['invoices'], 'readwrite');
      const store = transaction.objectStore('invoices');
      const request = store.get(offlineId);
      
      request.onsuccess = (e) => {
        const invoice = e.target.result;
        if (invoice) {
          invoice.submitted = false;
          store.put(invoice);
          resolve();
        } else {
          reject(new Error('Invoice not found'));
        }
      };
      
      request.onerror = () => reject(new Error('Failed to mark invoice as not submitted'));
    });
  }

  // Remove invoice from IndexedDB
  function removeInvoice(db, offlineId) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['invoices'], 'readwrite');
      const store = transaction.objectStore('invoices');
      const request = store.delete(offlineId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove invoice'));
    });
  }

  // Submit invoice to server
  function submitInvoice(invoice) {
    return new Promise((resolve, reject) => {
      fetch('/api/method/posawesome.posawesome.api.posapp.submit_invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': frappe.csrf_token
        },
        body: JSON.stringify({
          invoice: invoice,
          data: {
            total_change: invoice.total_change,
            paid_change: invoice.paid_change,
            credit_change: invoice.credit_change,
            redeemed_customer_credit: invoice.redeemed_customer_credit,
            customer_credit_dict: invoice.customer_credit_dict,
            is_cashback: invoice.is_cashback,
          }
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.exc) {
          reject(new Error(data.exc));
        } else {
          resolve(data);
        }
      })
      .catch(error => reject(error));
    });
  }
} else {
  console.log(`Workbox didn't load`);
} 