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
      v-model="showSyncProgress"
      :timeout="-1"
      color="info"
      position="bottom"
    >
      <div class="d-flex align-center">
        <v-progress-circular
          indeterminate
          size="20"
          class="mr-2"
        ></v-progress-circular>
        {{ `${__('Syncing offline orders')}: ${syncedCount}/${totalCount}` }}
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
        <v-btn
          text
          small
          @click="retrySync"
          class="ml-2"
        >
          {{ __('Retry') }}
        </v-btn>
      </div>
    </v-snackbar>
    
    <v-snackbar
      v-model="showStorageWarning"
      :timeout="8000"
      color="warning"
      position="bottom"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-alert</v-icon>
        {{ __('Offline storage is almost full. Please sync your data.') }}
        <v-btn
          text
          small
          @click="forceSync"
          class="ml-2"
        >
          {{ __('Sync Now') }}
        </v-btn>
      </div>
    </v-snackbar>
  </div>
</template>

<script>
import { ConnectivityService, processPendingInvoices } from '../../offline_db';

export default {
  data() {
    return {
      isOffline: !ConnectivityService.isOnline,
      showOfflineNotification: false,
      showBackOnlineNotification: false,
      showSyncProgress: false,
      showSyncSuccessNotification: false,
      showSyncErrorNotification: false,
      showStorageWarning: false,
      syncSuccessMessage: '',
      syncErrorMessage: '',
      syncedCount: 0,
      totalCount: 0,
      cleanupFn: null,
      retryTimeout: null
    };
  },
  methods: {
    handleConnectivityChange(status) {
      this.isOffline = status === 'offline';
      this.showOfflineNotification = status === 'offline';
      
      if (status === 'online') {
        this.showBackOnlineNotification = true;
        this.syncPendingOrders();
      }
    },
    
    async syncPendingOrders() {
      try {
        // Reset counters
        this.syncedCount = 0;
        this.totalCount = 0;
        
        const result = await processPendingInvoices({
          onProgress: (processed, total) => {
            this.syncedCount = processed;
            this.totalCount = total;
            this.showSyncProgress = true;
          }
        });
        
        this.showSyncProgress = false;
        
        if (result.processed > 0) {
          this.syncSuccessMessage = __(`Successfully synced ${result.processed} offline order(s).`);
          this.showSyncSuccessNotification = true;
        }
        
        if (result.failed > 0) {
          this.syncErrorMessage = __(`Failed to sync ${result.failed} offline order(s). Will retry automatically.`);
          this.showSyncErrorNotification = true;
          this.scheduleRetry();
        }
      } catch (error) {
        console.error('Error syncing pending orders:', error);
        this.syncErrorMessage = __('Error syncing offline orders. Will retry automatically.');
        this.showSyncErrorNotification = true;
        this.scheduleRetry();
      } finally {
        this.showSyncProgress = false;
      }
    },
    
    scheduleRetry() {
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
      }
      
      this.retryTimeout = setTimeout(() => {
        if (ConnectivityService.isOnline) {
          this.syncPendingOrders();
        }
      }, 5 * 60 * 1000); // Retry after 5 minutes
    },
    
    async retrySync() {
      this.showSyncErrorNotification = false;
      await this.syncPendingOrders();
    },
    
    async forceSync() {
      this.showStorageWarning = false;
      await this.syncPendingOrders();
    }
  },
  mounted() {
    this.cleanupFn = ConnectivityService.addListener(this.handleConnectivityChange);
    this.handleConnectivityChange(ConnectivityService.isOnline ? 'online' : 'offline');
    
    // Listen for storage warnings
    window.addEventListener('storage-warning', () => {
      this.showStorageWarning = true;
    });
  },
  beforeUnmount() {
    if (this.cleanupFn) {
      this.cleanupFn();
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
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
}

.v-snackbar {
  margin-bottom: 8px;
}
</style> 