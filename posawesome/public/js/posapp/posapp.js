import { createVuetify } from 'vuetify';
import { createApp } from 'vue';
import eventBus from './bus';
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import Home from './Home.vue';
import UpdateNotification from './components/pwa/UpdateNotification.vue';
import ConnectivityStatus from './components/pwa/ConnectivityStatus.vue';
import { initDB } from './offline_db';

frappe.provide('frappe.PosApp');

// Initialize IndexedDB first
initDB().catch(error => {
    console.error('Error initializing IndexedDB:', error);
});

// Constants for sync
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
let syncInterval;

// Function to start periodic sync
function startPeriodicSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    syncInterval = setInterval(async () => {
      if (navigator.onLine) {
        try {
          const { processPendingInvoices } = await import('./offline_db');
          await processPendingInvoices();
        } catch (error) {
          console.error('Periodic sync failed:', error);
        }
      }
    }, SYNC_INTERVAL);
  }
}

// Function to stop periodic sync
function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
}

window.addEventListener('load', () => {
  // Wait a moment to ensure app is loaded
  setTimeout(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/assets/posawesome/sw.js')
        .then(registration => {
          console.log('ServiceWorker registration successful');
          
          // Start periodic sync
          startPeriodicSync();
          
          // Register for background sync
          if ('SyncManager' in window) {
            registration.sync.register('sync-orders')
              .catch(err => console.error('Background sync registration failed:', err));
          }
          
          // Listen for service worker messages
          navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'OFFLINE_QUEUE_COUNT') {
              window.dispatchEvent(new CustomEvent('offline-queue-updated', {
                detail: { count: event.data.count }
              }));
            }
          });
        })
        .catch(err => console.error('ServiceWorker registration failed:', err));
    }
  }, 1000);
});

// Clean up on page unload
window.addEventListener('unload', () => {
  stopPeriodicSync();
});

// Function to sync pending orders on app startup
async function syncPendingOrders() {
  try {
    if (navigator.onLine) {
      const { processPendingInvoices } = await import('./offline_db');
      const result = await processPendingInvoices();
      
      if (result.success && result.processed > 0) {
        console.log(`Successfully synced ${result.processed} pending orders`);
        frappe.show_alert({
          message: __(`${result.processed} offline orders synchronized`),
          indicator: 'green'
        });
      }
      
      if (result.failed > 0) {
        console.warn(`Failed to sync ${result.failed} orders`);
        frappe.show_alert({
          message: __(`Failed to sync ${result.failed} orders. Will retry automatically.`),
          indicator: 'orange'
        });
      }
    }
  } catch (error) {
    console.error('Error syncing pending orders on startup:', error);
    frappe.show_alert({
      message: __('Error syncing offline orders. Will retry later.'),
      indicator: 'red'
    });
  }
}

// Try to sync pending orders when app starts
setTimeout(syncPendingOrders, 5000);

frappe.PosApp.posapp = class {
    constructor({ parent }) {
        this.$parent = $(document);
        this.page = parent.page;
        this.make_body();
    }
    
    make_body() {
        this.$el = this.$parent.find('.main-section');
        const vuetify = createVuetify(
            {
                components,
                directives,
                locale: {
                    rtl: frappe.utils.is_rtl()
                },
                theme: {
                    themes: {
                        light: {
                            background: '#FFFFFF',
                            primary: '#0097A7',
                            secondary: '#00BCD4',
                            accent: '#9575CD',
                            success: '#66BB6A',
                            info: '#2196F3',
                            warning: '#FF9800',
                            error: '#E86674',
                            orange: '#E65100',
                            golden: '#A68C59',
                            badge: '#F5528C',
                            customPrimary: '#085294',
                        },
                    },
                },
            }
        );
        
        // Create app instance
        const app = createApp(Home);
        
        // Register global components
        app.component('update-notification', UpdateNotification);
        app.component('connectivity-status', ConnectivityStatus);
        
        // Use plugins
        app.use(eventBus);
        app.use(vuetify);
        
        // Mount the app
        app.mount(this.$el[0]);
    }
    
    setup_header() {
    }
};
