// Register service worker for PWA functionality
(function() {
  'use strict';

  // Check if service workers are supported
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      // Try registering with root scope first, if that fails, fallback to default scope
      registerServiceWorker('/', function(err) {
        if (err) {
          console.warn('Failed to register service worker with root scope, falling back to default scope.', err);
          
          // Fallback to default scope (the directory where the service worker is)
          registerServiceWorker('/assets/posawesome/js/', function(fallbackErr) {
            if (fallbackErr) {
              console.error('Service Worker registration failed with all scopes:', fallbackErr);
            }
          });
        }
      });
      
      // Handle controller change
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', function(event) {
      const data = event.data;
      
      if (data.type === 'INVOICE_SYNCED') {
        showNotification('Invoice Synced', 'An invoice has been successfully synced with the server.', 'success');
      } else if (data.type === 'INVOICE_SYNC_FAILED') {
        showNotification('Sync Failed', `Failed to sync invoice: ${data.error}`, 'error');
      }
    });
  }
  
  // Helper function to register service worker with a specific scope
  function registerServiceWorker(scope, callback) {
    navigator.serviceWorker.register('/assets/posawesome/js/service-worker.js', {
      scope: scope
    })
    .then(function(registration) {
      console.log('Service Worker registered with scope:', registration.scope);
      
      // Check for updates
      registration.addEventListener('updatefound', function() {
        // A new service worker is being installed
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker is installed but waiting to activate
            showUpdateNotification();
          }
        });
      });
      
      if (callback) callback(null, registration);
    })
    .catch(function(error) {
      console.error('Service Worker registration failed:', error);
      if (callback) callback(error);
    });
  }

  // Function to show update notification
  function showUpdateNotification() {
    // Only show if we're in the POS app
    if (!window.location.pathname.includes('/app/posapp')) {
      return;
    }

    if (typeof frappe !== 'undefined') {
      // Using Frappe's built-in notification system
      frappe.show_alert({
        message: `<div style="display: flex; align-items: center;">
                    <span>New version available! Click to update.</span>
                    <button class="btn btn-primary btn-sm ml-3 update-app">Update</button>
                  </div>`,
        indicator: 'green'
      }, 0);
      
      // Add click handler
      setTimeout(() => {
        document.querySelector('.update-app').addEventListener('click', function() {
          skipWaitingAndReload();
        });
      }, 300);
    } else {
      // Fallback notification
      const updateBar = document.createElement('div');
      updateBar.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; background: #0097A7; color: white; padding: 16px; text-align: center; z-index: 9999; display: flex; justify-content: center; align-items: center;';
      updateBar.innerHTML = `
        <span>New version available!</span>
        <button style="margin-left: 16px; background: white; color: #0097A7; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Update</button>
      `;
      document.body.appendChild(updateBar);
      
      updateBar.querySelector('button').addEventListener('click', function() {
        skipWaitingAndReload();
      });
    }
  }

  // Function to skip waiting and reload the page
  function skipWaitingAndReload() {
    navigator.serviceWorker.getRegistration().then(function(reg) {
      if (reg.waiting) {
        // Send message to service worker to skip waiting
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  }

  // Function to show notifications (uses Frappe if available, falls back to browser notifications)
  function showNotification(title, message, type) {
    if (typeof frappe !== 'undefined') {
      frappe.show_alert({
        message: message,
        indicator: type === 'success' ? 'green' : 'red'
      });
    } else if ('Notification' in window) {
      // Check if notification permissions are granted
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: '/assets/posawesome/icons/icon-192x192.png'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(function(permission) {
          if (permission === 'granted') {
            new Notification(title, {
              body: message,
              icon: '/assets/posawesome/icons/icon-192x192.png'
            });
          }
        });
      }
    }
  }

  // Set up offline status handling
  window.addEventListener('online', function() {
    showNotification('Online', 'You are back online. Syncing data...', 'success');
    
    // Try to sync pending invoices
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(function(registration) {
        registration.sync.register('sync-invoices');
      });
    }
  });

  window.addEventListener('offline', function() {
    showNotification('Offline', 'You are offline. Changes will be saved locally.', 'warning');
  });

  // Function to request notification permission
  window.requestNotificationPermission = function() {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return Promise.resolve(false);
    }
    
    if (Notification.permission === 'granted') {
      return Promise.resolve(true);
    }
    
    if (Notification.permission === 'denied') {
      console.log('Notification permission was denied');
      return Promise.resolve(false);
    }
    
    return Notification.requestPermission().then(function(permission) {
      return permission === 'granted';
    });
  };
})(); 