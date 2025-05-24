// Service Worker for POS Awesome
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

const APP_CACHE = 'posawesome-cache-v1';
const DATA_CACHE = 'posawesome-data-cache-v1';
const OFFLINE_URL = '/app/offline.html';

// Listen for the skip waiting message from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Skip waiting and claim clients immediately
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installed');
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll([
        '/assets/posawesome/js/posapp.bundle.js',
        '/assets/posawesome/css/posawesome.css',
        '/assets/posawesome/icons/icon-192x192.png',
        '/assets/posawesome/manifest.json',
        OFFLINE_URL,
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated');
  event.waitUntil(
    Promise.all([
      // Claim clients so the service worker is in control immediately
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (cacheName) => 
                cacheName !== APP_CACHE && 
                cacheName !== DATA_CACHE
            )
            .map((cacheName) => {
              console.log('[Service Worker] Clearing old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
    ])
  );
});

// Precache static assets
workbox.precaching.precacheAndRoute([
  { url: '/assets/posawesome/js/posapp.bundle.js', revision: '1.0.0' },
  { url: '/assets/posawesome/css/posawesome.css', revision: '1.0.0' },
  { url: '/assets/posawesome/icons/icon-192x192.png', revision: '1.0.0' },
  { url: '/assets/posawesome/manifest.json', revision: '1.0.0' },
  { url: OFFLINE_URL, revision: '1.0.0' },
]);

// Cache CSS, JS, and Web Worker requests with a Stale While Revalidate strategy
workbox.routing.registerRoute(
  ({ request }) => 
    request.destination === 'style' || 
    request.destination === 'script' || 
    request.destination === 'worker',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: APP_CACHE,
  })
);

// Cache images with a Cache First strategy
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: APP_CACHE,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Cache fonts with a Cache First strategy
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'font',
  new workbox.strategies.CacheFirst({
    cacheName: APP_CACHE,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 Days
      }),
    ],
  })
);

// Use Network First for API calls
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new workbox.strategies.NetworkFirst({
    cacheName: DATA_CACHE,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Special handling for invoice-related API calls
workbox.routing.registerRoute(
  ({ url }) => url.pathname.includes('/api/method/posawesome.posawesome.api.posapp.update_invoice'),
  new workbox.strategies.NetworkOnly({
    plugins: [
      new workbox.backgroundSync.BackgroundSyncPlugin('pos-invoice-queue', {
        maxRetentionTime: 24 * 60, // Retry for up to 24 hours (specified in minutes)
      }),
    ],
  })
);

// Create IndexedDB storage for offline data
const DB_NAME = 'posawesome-offline-db';
const DB_VERSION = 1;
const PENDING_INVOICES_STORE = 'pendingInvoices';

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PENDING_INVOICES_STORE)) {
        db.createObjectStore(PENDING_INVOICES_STORE, { keyPath: 'id' });
      }
    };
  });
}

// Save pending invoice to IndexedDB
async function savePendingInvoice(invoice) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_INVOICES_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_INVOICES_STORE);
    
    // Add timestamp and unique ID
    invoice.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    invoice.timestamp = Date.now();
    
    const request = store.add(invoice);
    
    request.onsuccess = () => resolve(invoice.id);
    request.onerror = () => reject(new Error('Failed to save invoice offline'));
  });
}

// Get all pending invoices
async function getPendingInvoices() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_INVOICES_STORE], 'readonly');
    const store = transaction.objectStore(PENDING_INVOICES_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to get pending invoices'));
  });
}

// Delete pending invoice
async function deletePendingInvoice(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_INVOICES_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_INVOICES_STORE);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete pending invoice'));
  });
}

// Listen for sync events to process pending invoices
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-invoices') {
    event.waitUntil(syncPendingInvoices());
  }
});

// Process pending invoices
async function syncPendingInvoices() {
  try {
    const pendingInvoices = await getPendingInvoices();
    
    // Sort by timestamp (oldest first)
    pendingInvoices.sort((a, b) => a.timestamp - b.timestamp);
    
    for (const invoice of pendingInvoices) {
      try {
        const response = await fetch('/api/method/posawesome.posawesome.api.posapp.update_invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-CSRF-Token': invoice.csrf_token || '',
          },
          body: JSON.stringify(invoice.data),
        });
        
        if (response.ok) {
          // If successful, remove from queue
          await deletePendingInvoice(invoice.id);
          
          // Send notification to all clients
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'INVOICE_SYNCED',
              invoiceId: invoice.id,
              success: true,
            });
          });
        } else {
          throw new Error(`Failed to sync invoice: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error syncing invoice:', error);
        
        // Send notification of failure
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'INVOICE_SYNC_FAILED',
            invoiceId: invoice.id,
            error: error.message,
          });
        });
      }
    }
  } catch (error) {
    console.error('Error in syncPendingInvoices:', error);
  }
}

// Special handling for offline navigation to app URLs
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/app/'),
  async ({ url, request, event, params }) => {
    try {
      // Try network first
      const networkResponse = await fetch(request);
      return networkResponse;
    } catch (error) {
      console.log('[Service Worker] Serving offline page for app route:', url.pathname);
      // If offline, return the offline page
      const cache = await caches.open(APP_CACHE);
      const cachedResponse = await cache.match(OFFLINE_URL);
      return cachedResponse || new Response('You are offline. Please check your connection.', {
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }
);

// Intercept fetch requests for offline handling
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle API calls for invoice updates when offline
  if (url.pathname.includes('/api/method/posawesome.posawesome.api.posapp.update_invoice') && 
      event.request.method === 'POST') {
    
    // Check if offline
    if (!self.navigator.onLine) {
      event.respondWith(
        (async () => {
          try {
            // Clone request to extract data
            const requestClone = event.request.clone();
            const requestData = await requestClone.json();
            
            // Store in IndexedDB
            const invoiceId = await savePendingInvoice({
              data: requestData,
              csrf_token: event.request.headers.get('X-Frappe-CSRF-Token'),
            });
            
            // Register for background sync
            await self.registration.sync.register('sync-invoices');
            
            // Return success response
            return new Response(JSON.stringify({
              status: 'queued',
              message: 'Invoice saved offline and will be synced when online',
              invoice_id: invoiceId,
            }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            });
          } catch (error) {
            console.error('Error saving invoice offline:', error);
            
            // Return error response
            return new Response(JSON.stringify({
              status: 'error',
              message: 'Failed to save invoice offline',
              error: error.message,
            }), {
              headers: { 'Content-Type': 'application/json' },
              status: 500,
            });
          }
        })()
      );
    }
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification from POS Awesome',
      icon: '/assets/posawesome/icons/icon-192x192.png',
      badge: '/assets/posawesome/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/app/posapp',
      },
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'POS Awesome', options)
    );
  } catch (error) {
    console.error('Error showing push notification:', error);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = event.notification.data.url;
      
      // Check if a window is already open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open one
      return clients.openWindow(url);
    })
  );
}); 