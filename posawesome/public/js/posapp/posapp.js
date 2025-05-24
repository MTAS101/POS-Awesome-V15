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

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Wait a moment to ensure app is loaded
        setTimeout(() => {
            navigator.serviceWorker.register('/assets/posawesome/sw.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                    
                    // Check if there's a waiting service worker (update available)
                    if (registration.waiting) {
                        // Dispatch event for the update notification component
                        window.dispatchEvent(new CustomEvent('sw-updated', { 
                            detail: { worker: registration.waiting } 
                        }));
                    }
                    
                    // Listen for new service workers
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        
                        // Track state changes of the new service worker
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker is available (update ready)
                                window.dispatchEvent(new CustomEvent('sw-updated', { 
                                    detail: { worker: newWorker } 
                                }));
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                    // Still initialize app even if service worker fails
                });
                
            // Listen for service worker messages
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'OFFLINE_QUEUE_COUNT') {
                    // Dispatch event with queue count for components
                    window.dispatchEvent(new CustomEvent('offline-queue-updated', { 
                        detail: { count: event.data.count } 
                    }));
                }
            });
        }, 1000); // Wait 1 second to ensure page is fully loaded
    });
}

// Function to sync pending orders on app startup
async function syncPendingOrders() {
    try {
        // Check if we're online
        if (navigator.onLine) {
            // Import only when needed to avoid circular dependencies
            const { processPendingInvoices } = await import('./offline_db');
            const result = await processPendingInvoices();
            
            if (result.success && result.processed > 0) {
                console.log(`Successfully synced ${result.processed} pending orders`);
                frappe.show_alert({
                    message: __(`${result.processed} offline orders synchronized`),
                    indicator: 'green'
                });
            }
        }
    } catch (error) {
        console.error('Error syncing pending orders on startup:', error);
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
