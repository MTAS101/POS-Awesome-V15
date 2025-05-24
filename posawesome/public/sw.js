// Import Workbox from CDN - in production you might want to use a bundled version
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  console.log(`Workbox is loaded`);
  
  workbox.setConfig({ debug: false });
  
  // Force production builds
  workbox.setConfig({
    debug: false
  });
  
  // Cache names
  workbox.core.setCacheNameDetails({
    prefix: 'posawesome',
    suffix: 'v1',
    precache: 'precache',
    runtime: 'runtime'
  });
  
  // Skip waiting and claim clients so new service worker activates immediately
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();
  
  // Precache strategy for static assets
  workbox.precaching.precacheAndRoute([
    { url: '/app/posapp', revision: '1.0.0' },
    { url: '/assets/posawesome/icons/icon-192x192.png', revision: '1.0.0' },
    { url: '/assets/posawesome/icons/icon-512x512.png', revision: '1.0.0' },
    { url: '/assets/posawesome/manifest.json', revision: '1.0.0' },
    // Add more static assets here
    { url: '/assets/posawesome/js/posapp/Home.vue', revision: '1.0.0' },
    { url: '/assets/posawesome/js/posapp/components/pos/Pos.vue', revision: '1.0.0' },
    { url: '/assets/posawesome/js/posapp/components/payments/Pay.vue', revision: '1.0.0' }
  ]);
  
  // Cache CSS with stale-while-revalidate
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'style',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'posawesome-styles',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    })
  );
  
  // Cache JavaScript with stale-while-revalidate
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'script',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'posawesome-scripts',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );
  
  // Cache images with cache-first
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'posawesome-images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );
  
  // Cache fonts with cache-first
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'font',
    new workbox.strategies.CacheFirst({
      cacheName: 'posawesome-fonts',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );
  
  // API requests - Network first with fallback to cache
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes('/api/'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'posawesome-api',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
      networkTimeoutSeconds: 3,
    })
  );
  
  // Offline fallback page for navigation requests
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    async ({ event }) => {
      try {
        return await workbox.strategies.NetworkFirst({
          cacheName: 'posawesome-pages',
          plugins: [
            new workbox.expiration.ExpirationPlugin({
              maxEntries: 25,
              maxAgeSeconds: 24 * 60 * 60, // 24 hours
            }),
            new workbox.cacheableResponse.CacheableResponsePlugin({
              statuses: [0, 200],
            }),
          ],
          networkTimeoutSeconds: 3,
        }).handle({ event });
      } catch (error) {
        return workbox.precaching.matchPrecache('/offline.html');
      }
    }
  );
  
  // Background sync for offline orders
  const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('posawesome-offline-orders', {
    maxRetentionTime: 24 * 60, // Retry for up to 24 hours (in minutes)
    onSync: async ({ queue }) => {
      let entry;
      while ((entry = await queue.shiftRequest())) {
        try {
          await fetch(entry.request.clone());
          
          // Notify clients about successful sync
          const clients = await self.clients.matchAll();
          for (const client of clients) {
            client.postMessage({
              type: 'BACKGROUND_SYNC_SUCCESS',
              payload: {
                timestamp: Date.now(),
                request: entry.request.url
              }
            });
          }
        } catch (error) {
          console.error('Replay failed for request', entry.request.url, error);
          
          // Put entry back in the queue
          await queue.unshiftRequest(entry);
          
          // Notify clients about sync failure
          const clients = await self.clients.matchAll();
          for (const client of clients) {
            client.postMessage({
              type: 'BACKGROUND_SYNC_FAILED',
              payload: {
                timestamp: Date.now(),
                request: entry.request.url,
                error: error.message
              }
            });
          }
          
          throw error;
        }
      }
    }
  });
  
  // Register route for offline order submission with background sync
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes('/api/method/posawesome.posawesome.api.posapp.update_invoice'),
    new workbox.strategies.NetworkOnly({
      plugins: [bgSyncPlugin]
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
  
  // Handle sync events
  self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-orders') {
      event.waitUntil(bgSyncPlugin.replay());
    }
  });
  
  // Handle message events
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'STORE_OFFLINE_ORDER') {
      // Store order data in IndexedDB for offline sync
      const order = event.data.payload;
      event.waitUntil(
        bgSyncPlugin.queue.pushRequest({
          request: new Request('/api/method/posawesome.posawesome.api.posapp.update_invoice', {
            method: 'POST',
            body: JSON.stringify(order),
            headers: {
              'Content-Type': 'application/json'
            }
          })
        })
      );
    }
  });
} else {
  console.log(`Workbox didn't load`);
} 