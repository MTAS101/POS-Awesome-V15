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
  // Add your files to precache here or use workbox-build to generate this list
  workbox.precaching.precacheAndRoute([
    { url: '/app/point-of-sale', revision: '1.0.0' },
    { url: '/assets/posawesome/icons/icon-192x192.png', revision: '1.0.0' },
    { url: '/assets/posawesome/icons/icon-512x512.png', revision: '1.0.0' },
    { url: '/manifest.json', revision: '1.0.0' }
  ]);
  
  // Cache CSS
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'style',
    new workbox.strategies.CacheFirst({
      cacheName: 'posawesome-styles',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    })
  );
  
  // Cache JavaScript
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'script',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'posawesome-scripts',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
    })
  );
  
  // Cache images
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'posawesome-images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    })
  );
  
  // Cache fonts
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'font',
    new workbox.strategies.CacheFirst({
      cacheName: 'posawesome-fonts',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
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
      ],
    })
  );
  
  // Offline fallback page for navigation requests
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    async () => {
      try {
        // Try to fetch from network first
        return await workbox.strategies.NetworkFirst({
          cacheName: 'posawesome-pages',
          plugins: [
            new workbox.expiration.ExpirationPlugin({
              maxEntries: 25,
              maxAgeSeconds: 24 * 60 * 60, // 24 hours
            })
          ]
        }).handle({ request: 'index.html' });
      } catch (error) {
        // If network fails, serve from cache
        return workbox.precaching.matchPrecache('index.html');
      }
    }
  );
  
  // Background sync for offline orders
  const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('posawesome-offline-orders', {
    maxRetentionTime: 24 * 60 // Retry for up to 24 hours (in minutes)
  });
  
  // Register route for offline order submission
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
        url: data.url || '/app/point-of-sale'
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
        clients.openWindow('/app/point-of-sale')
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
} else {
  console.log(`Workbox didn't load`);
} 