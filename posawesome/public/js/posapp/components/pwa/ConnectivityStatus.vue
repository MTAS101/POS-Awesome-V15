<template>
  <div class="connectivity-status">
    <v-snackbar
      v-model="showOfflineNotification"
      :timeout="-1"
      color="warning"
      position="bottom"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-wifi-off</v-icon>
        {{ __("You are offline. Orders will be saved locally and synced when you're back online.") }}
      </div>
    </v-snackbar>
    
    <v-snackbar
      v-model="showBackOnlineNotification"
      :timeout="5000"
      color="success"
      position="bottom"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-wifi</v-icon>
        {{ __("You're back online! Syncing pending orders...") }}
      </div>
    </v-snackbar>
    
    <v-snackbar
      v-model="showSyncSuccessNotification"
      :timeout="3000"
      color="success"
      position="bottom"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-check-circle</v-icon>
        {{ syncSuccessMessage }}
      </div>
    </v-snackbar>
    
    <v-snackbar
      v-model="showSyncErrorNotification"
      :timeout="5000"
      color="error"
      position="bottom"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-alert-circle</v-icon>
        {{ syncErrorMessage }}
      </div>
    </v-snackbar>
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
      cleanupFn: null
    };
  },
  methods: {
    checkConnectivity() {
      const online = isOnline();
      this.isOffline = !online;
      this.showOfflineNotification = !online;
      
      if (online) {
        this.syncPendingOrders();
      }
    },
    
    handleOffline() {
      this.isOffline = true;
      this.showOfflineNotification = true;
    },
    
    async handleOnline() {
      this.isOffline = false;
      this.showOfflineNotification = false;
      this.showBackOnlineNotification = true;
      
      // Sync pending orders
      await this.syncPendingOrders();
    },
    
    async syncPendingOrders() {
      try {
        const result = await processPendingInvoices();
        
        if (result.processed > 0) {
          this.syncSuccessMessage = __(`Successfully synced ${result.processed} offline order(s).`);
          this.showSyncSuccessNotification = true;
        }
        
        if (result.failed > 0) {
          this.syncErrorMessage = __(`Failed to sync ${result.failed} offline order(s). Will retry automatically.`);
          this.showSyncErrorNotification = true;
        }
      } catch (error) {
        console.error('Error syncing pending orders:', error);
        this.syncErrorMessage = __('Error syncing offline orders. Will retry automatically.');
        this.showSyncErrorNotification = true;
      }
    }
  },
  mounted() {
    // Check initial connectivity
    this.checkConnectivity();
    
    // Setup listeners for online/offline events
    this.cleanupFn = setupConnectivityListeners({
      onOnline: this.handleOnline,
      onOffline: this.handleOffline
    });
  },
  beforeUnmount() {
    // Clean up listeners
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
</style> 