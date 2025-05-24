<template>
  <div class="connectivity-status">
    <!-- Offline notification -->
    <v-snackbar
      v-model="showOfflineNotification"
      color="error"
      timeout="-1"
      location="bottom"
    >
      <div class="d-flex align-center">
        <v-icon icon="mdi-wifi-off" class="mr-2"></v-icon>
        {{ __("You are offline. Your changes will be saved locally.") }}
      </div>
    </v-snackbar>
    
    <!-- Back online notification -->
    <v-snackbar
      v-model="showBackOnlineNotification"
      color="success"
      :timeout="5000"
      location="bottom"
    >
      <div class="d-flex align-center">
        <v-icon icon="mdi-wifi" class="mr-2"></v-icon>
        {{ __("You are back online.") }}
      </div>
    </v-snackbar>
    
    <!-- Sync success notification -->
    <v-snackbar
      v-model="showSyncSuccessNotification"
      color="success"
      :timeout="5000"
      location="bottom"
    >
      <div class="d-flex align-center">
        <v-icon icon="mdi-sync" class="mr-2"></v-icon>
        {{ syncSuccessMessage }}
      </div>
    </v-snackbar>
    
    <!-- Sync error notification -->
    <v-snackbar
      v-model="showSyncErrorNotification"
      color="warning"
      :timeout="5000"
      location="bottom"
    >
      <div class="d-flex align-center">
        <v-icon icon="mdi-sync-alert" class="mr-2"></v-icon>
        {{ syncErrorMessage }}
      </div>
    </v-snackbar>
    
    <!-- Fixed offline indicator that stays visible when offline -->
    <v-fade-transition>
      <div v-if="isOffline" class="offline-indicator">
        <v-chip color="error" variant="elevated" size="small">
          <v-icon icon="mdi-wifi-off" size="small" class="mr-1"></v-icon>
          {{ __("Offline") }}
        </v-chip>
      </div>
    </v-fade-transition>
  </div>
</template>

<script>
import { isOnline, setupConnectivityListeners, processPendingInvoices } from '../../offline_db';

export default {
  data() {
    return {
      isOffline: false,
      showOfflineNotification: false,
      showBackOnlineNotification: false,
      showSyncSuccessNotification: false,
      showSyncErrorNotification: false,
      syncSuccessMessage: '',
      syncErrorMessage: '',
      cleanupFn: null,
      syncInProgress: false
    };
  },
  methods: {
    // Initial connectivity check
    checkConnectivity() {
      const online = isOnline();
      this.isOffline = !online;
      this.showOfflineNotification = !online;
      
      if (online) {
        this.syncPendingOrders();
      }
    },
    
    // Handle device going offline
    handleOffline() {
      console.log('ConnectivityStatus: Device went offline');
      this.isOffline = true;
      this.showOfflineNotification = true;
      
      // Hide other notifications when offline
      this.showBackOnlineNotification = false;
      this.showSyncSuccessNotification = false;
      this.showSyncErrorNotification = false;
    },
    
    // Handle device coming back online
    async handleOnline() {
      console.log('ConnectivityStatus: Device back online');
      this.isOffline = false;
      this.showOfflineNotification = false;
      this.showBackOnlineNotification = true;
      
      // Sync pending orders with slight delay to ensure connectivity is stable
      setTimeout(() => this.syncPendingOrders(), 2000);
    },
    
    // Sync pending orders with the server
    async syncPendingOrders() {
      // Prevent multiple sync attempts
      if (this.syncInProgress) {
        console.log('Sync already in progress, skipping');
        return;
      }
      
      try {
        this.syncInProgress = true;
        
        // Verify we're online before attempting sync
        if (!isOnline()) {
          console.log('Cannot sync - device is offline');
          this.syncInProgress = false;
          return;
        }
        
        console.log('Syncing pending orders...');
        const result = await processPendingInvoices();
        
        if (result.processed > 0) {
          this.syncSuccessMessage = __(`Successfully synced ${result.processed} offline order(s).`);
          this.showSyncSuccessNotification = true;
          
          // Emit an event that other components can listen to
          this.eventBus.emit('orders_synced', {
            count: result.processed,
            success: true
          });
        }
        
        if (result.failed > 0) {
          this.syncErrorMessage = __(`Failed to sync ${result.failed} offline order(s). Will retry automatically.`);
          this.showSyncErrorNotification = true;
          
          // Schedule retry after a delay
          setTimeout(() => {
            this.syncInProgress = false;
            this.syncPendingOrders();
          }, 30000); // Retry after 30 seconds
        } else {
          this.syncInProgress = false;
        }
      } catch (error) {
        console.error('Error syncing pending orders:', error);
        this.syncErrorMessage = __('Error syncing offline orders. Will retry automatically.');
        this.showSyncErrorNotification = true;
        this.syncInProgress = false;
        
        // Schedule retry after a delay
        setTimeout(() => this.syncPendingOrders(), 60000); // Retry after 1 minute
      }
    }
  },
  mounted() {
    // Check initial connectivity
    this.checkConnectivity();
    
    // Set up listeners for app-level online/offline events
    window.addEventListener('app-online', this.handleOnline);
    window.addEventListener('app-offline', this.handleOffline);
    
    // Set up network status listeners as backup
    this.cleanupFn = setupConnectivityListeners({
      onOnline: this.handleOnline,
      onOffline: this.handleOffline
    });
    
    // Listen for direct sync requests from other components
    this.eventBus.on('request_sync', this.syncPendingOrders);
  },
  beforeUnmount() {
    // Clean up all event listeners
    window.removeEventListener('app-online', this.handleOnline);
    window.removeEventListener('app-offline', this.handleOffline);
    
    this.eventBus.off('request_sync', this.syncPendingOrders);
    
    // Clean up connectivity listeners
    if (this.cleanupFn) {
      this.cleanupFn();
    }
  }
}
</script>

<style scoped>
.connectivity-status {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 999;
  pointer-events: none;
}

.offline-indicator {
  position: fixed;
  bottom: 10px;
  right: 10px;
  z-index: 1000;
  pointer-events: none;
}
</style> 