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
  
  // Precache strategy for static assets
  // Add your files to precache here or use workbox-build to generate this list
  workbox.precaching.precacheAndRoute([
    { url: '/app/posapp', revision: '1.0.0' },
    { url: '/assets/posawesome/icons/icon-192x192.png', revision: '1.0.0' },
    { url: '/assets/posawesome/icons/icon-512x512.png', revision: '1.0.0' },
    { url: '/assets/posawesome/manifest.json', revision: '1.0.0' }
  ]);
  
  // Cache page navigations (html) with a Network First strategy
  workbox.routing.registerRoute(
    // Check to see if the request is a navigation to a new page
    ({ request }) => request.mode === 'navigate',
    // Use a Network First caching strategy
    new workbox.strategies.NetworkFirst({
      // Put all cached files in a cache named 'pages'
      cacheName: 'pages',
      plugins: [
        // Ensure that only requests that result in a 200 status are cached
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [200],
        }),
      ],
    }),
  );
  
  // Cache CSS, JS, and Web Worker files with a Stale While Revalidate strategy
  workbox.routing.registerRoute(
    // Check to see if the request's destination is style for stylesheets, script for JavaScript, or worker for web worker
    ({ request }) =>
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'worker',
    // Use a Stale While Revalidate caching strategy
    new workbox.strategies.StaleWhileRevalidate({
      // Put all cached files in a cache named 'assets'
      cacheName: 'assets',
      plugins: [
        // Ensure that only requests that result in a 200 status are cached
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [200],
        }),
      ],
    }),
  );
  
  // Cache images with a Cache First strategy
  workbox.routing.registerRoute(
    // Check to see if the request's destination is image
    ({ request }) => request.destination === 'image',
    // Use a Cache First caching strategy
    new workbox.strategies.CacheFirst({
      // Put all cached images in a cache named 'images'
      cacheName: 'images',
      plugins: [
        // Ensure that only requests that result in a 200 status are cached
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [200],
        }),
        // Don't cache more than 50 items, and expire them after 30 days
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    }),
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
  
  // Cache the API responses with a Network First strategy
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes('/api/'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-cache',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        }),
      ],
    }),
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

  // Handle offline fallback
  workbox.routing.setCatchHandler(({ event }) => {
    switch (event.request.destination) {
      case 'document':
        return caches.match('/offline.html');
      case 'image':
        return caches.match('/offline-image.png');
      default:
        return Response.error();
    }
  });
} else {
  console.log(`Workbox didn't load`);
} 