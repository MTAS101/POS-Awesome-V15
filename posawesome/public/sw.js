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
  
  // Skip waiting and claim clients so new service worker activates immediately
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
  
  // Cache page navigations (HTML) with a 'Network First' strategy
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
  
  // Fallback to offline page if network request fails
  const offlineFallbackPage = '/assets/posawesome/offline.html';
  
  workbox.routing.setCatchHandler(({event}) => {
    switch (event.request.destination) {
      case 'document':
        return caches.match(offlineFallbackPage);
      default:
        return Response.error();
    }
  });
  
  // Precache offline page and other essential assets
  workbox.precaching.precacheAndRoute([
    { url: offlineFallbackPage, revision: '1.0.0' },
    { url: '/assets/posawesome/offline-image.png', revision: '1.0.0' }
  ]);
  
  // Handle API requests with Network First strategy
  workbox.routing.registerRoute(
    new RegExp('/api/.*'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 Day
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );
  
  // Background Sync for offline invoice submissions
  const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('invoiceQueue', {
    maxRetentionTime: 24 * 60 // Retry for up to 24 Hours (specified in minutes)
  });
  
  workbox.routing.registerRoute(
    new RegExp('/api/method/posawesome.*'),
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
} else {
  console.log(`Workbox didn't load`);
} 