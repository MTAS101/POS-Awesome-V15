import { createVuetify } from 'vuetify';
import { createApp } from 'vue';
import eventBus from './bus';
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import Home from './Home.vue';
import UpdateNotification from './components/pwa/UpdateNotification.vue';
import ConnectivityStatus from './components/pwa/ConnectivityStatus.vue';
import { initDB, isOnline, processPendingInvoices } from './offline_db';

frappe.provide('frappe.PosApp');

// Initialize application in proper sequence to ensure reliable offline functionality
async function initializeApp() {
    try {
        console.log('POS Awesome initializing...');
        
        // Step 1: Initialize IndexedDB first - wait for it to complete
        console.log('Initializing IndexedDB...');
        await initDB();
        console.log('IndexedDB initialization complete');
        
        // Step 2: Register service worker only after storage is initialized
        if ('serviceWorker' in navigator) {
            console.log('Registering service worker...');
            registerServiceWorker();
        } else {
            console.warn('Service Worker is not supported in this browser');
        }
        
        // Step 3: Setup network event listeners
        console.log('Setting up network listeners...');
        setupNetworkListeners();
        
        // Step 4: Try to sync any pending offline data
        console.log('Checking for pending offline data...');
        syncOfflineData();
        
    } catch (error) {
        console.error('Error during POS Awesome initialization:', error);
        // Continue with app initialization even if there's an error
        // This ensures the app remains usable even with offline features disabled
    }
}

// Register service worker with improved reliability
function registerServiceWorker() {
    // Use a more reliable pattern for service worker registration
    navigator.serviceWorker.register('/assets/posawesome/sw.js')
        .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
            
            // Handle updates
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
                    console.log('Service Worker state changed:', newWorker.state);
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker is available (update ready)
                        window.dispatchEvent(new CustomEvent('sw-updated', { 
                            detail: { worker: newWorker } 
                        }));
                    }
                });
            });
            
            // Setup message listener for service worker
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'OFFLINE_QUEUE_COUNT') {
                    // Dispatch event with queue count for components
                    window.dispatchEvent(new CustomEvent('offline-queue-updated', { 
                        detail: { count: event.data.count } 
                    }));
                }
            });
            
            // After registration, check if we need to sync offline data
            if (isOnline()) {
                syncOfflineData();
            }
        })
        .catch(error => {
            console.error('Service Worker registration failed:', error);
            // Still allow app to function without service worker
        });
}

// Setup network event listeners with debounce to avoid rapid firing
function setupNetworkListeners() {
    let onlineDebounceTimer = null;
    let offlineDebounceTimer = null;
    
    // More reliable online detector using multiple checks
    const checkOnlineStatus = () => {
        // Use both navigator.onLine and a fetch test for reliability
        const navigatorOnline = navigator.onLine;
        
        if (navigatorOnline) {
            console.log('Network connection detected');
            // Dispatch event
            window.dispatchEvent(new CustomEvent('app-online'));
            
            // Try to sync offline data when we come back online
            syncOfflineData();
        } else {
            console.log('Network connection lost');
            // Dispatch event
            window.dispatchEvent(new CustomEvent('app-offline'));
            
            // Show notification
            frappe.show_alert({
                message: __('You are now offline. Your changes will be saved locally.'),
                indicator: 'orange'
            }, 5);
        }
    };
    
    // Handle online event with debounce
    window.addEventListener('online', () => {
        if (onlineDebounceTimer) clearTimeout(onlineDebounceTimer);
        onlineDebounceTimer = setTimeout(() => {
            console.log('Online event triggered');
            checkOnlineStatus();
        }, 1000); // Debounce for 1 second
    });
    
    // Handle offline event with debounce
    window.addEventListener('offline', () => {
        if (offlineDebounceTimer) clearTimeout(offlineDebounceTimer);
        offlineDebounceTimer = setTimeout(() => {
            console.log('Offline event triggered');
            checkOnlineStatus();
        }, 1000); // Debounce for 1 second
    });
    
    // Perform initial check
    checkOnlineStatus();
}

// Sync offline data with improved reliability
async function syncOfflineData(retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 10000; // 10 seconds
    
    try {
        // Skip sync if we're offline
        if (!isOnline()) {
            console.log('Cannot sync offline data - currently offline');
            return;
        }
        
        console.log('Attempting to sync offline data...');
        const result = await processPendingInvoices();
        
        if (result.success && result.processed > 0) {
            console.log(`Successfully synced ${result.processed} pending orders`);
            frappe.show_alert({
                message: __(`${result.processed} offline orders synchronized`),
                indicator: 'green'
            });
        } else if (result.failed > 0) {
            console.warn(`Failed to sync ${result.failed} orders, will retry later`);
            
            // Schedule retry if we haven't exceeded max retries
            if (retryCount < MAX_RETRIES) {
                console.log(`Scheduling retry ${retryCount + 1} of ${MAX_RETRIES} in ${RETRY_DELAY/1000}s`);
                setTimeout(() => syncOfflineData(retryCount + 1), RETRY_DELAY);
            }
        }
    } catch (error) {
        console.error('Error syncing pending orders:', error);
        
        // Schedule retry if we haven't exceeded max retries
        if (retryCount < MAX_RETRIES) {
            console.log(`Scheduling retry ${retryCount + 1} of ${MAX_RETRIES} in ${RETRY_DELAY/1000}s`);
            setTimeout(() => syncOfflineData(retryCount + 1), RETRY_DELAY);
        }
    }
}

// Start initialization process when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // If DOMContentLoaded already fired, run immediately
    initializeApp();
}

// POS App class definition
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
