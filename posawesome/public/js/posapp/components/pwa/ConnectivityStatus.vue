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
        <div>
          <div>{{ __("You are offline. Orders will be saved locally.") }}</div>
          <div class="text-caption">{{ pendingOrdersCount }} {{ __("orders pending sync") }}</div>
        </div>
        <v-btn
          v-if="pendingOrdersCount > 0"
          text
          small
          class="ml-4"
          @click="showPendingOrders"
        >
          {{ __("View Orders") }}
        </v-btn>
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
        <div>
          <div>{{ __("You're back online!") }}</div>
          <div class="text-caption">{{ __("Syncing pending orders...") }}</div>
        </div>
        <v-progress-circular
          indeterminate
          size="20"
          width="2"
          class="ml-4"
        ></v-progress-circular>
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
    
    <v-dialog
      v-model="showPendingOrdersDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title>{{ __("Pending Orders") }}</v-card-title>
        <v-card-text>
          <v-list dense>
            <v-list-item
              v-for="order in pendingOrders"
              :key="order.id"
            >
              <v-list-item-content>
                <v-list-item-title>
                  {{ order.customer }} - {{ frappe.format_currency(order.grand_total, order.currency) }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ formatDate(order.timestamp) }}
                  <span v-if="order.sync_attempts" class="error--text">
                    ({{ order.sync_attempts }} {{ __("sync attempts") }})
                  </span>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-btn
                  small
                  text
                  color="primary"
                  @click="retrySync(order)"
                  :loading="syncingOrders[order.id]"
                  :disabled="!isOnline"
                >
                  {{ __("Retry") }}
                </v-btn>
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            text
            @click="showPendingOrdersDialog = false"
          >
            {{ __("Close") }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!isOnline || !pendingOrders.length"
            :loading="syncingAll"
            @click="syncAllPendingOrders"
          >
            {{ __("Sync All") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { isOnline, setupConnectivityListeners, processPendingInvoices, getPendingOrders } from '../../offline_db';

export default {
  data() {
    return {
      isOffline: !isOnline(),
      showOfflineNotification: false,
      showBackOnlineNotification: false,
      showSyncSuccessNotification: false,
      showSyncErrorNotification: false,
      showPendingOrdersDialog: false,
      syncSuccessMessage: '',
      syncErrorMessage: '',
      pendingOrders: [],
      pendingOrdersCount: 0,
      syncingOrders: {},
      syncingAll: false,
      cleanupFn: null,
      autoSyncInterval: null
    };
  },
  methods: {
    formatDate(timestamp) {
      return frappe.datetime.prettyDate(new Date(timestamp));
    },
    
    async updatePendingOrders() {
      try {
        this.pendingOrders = await getPendingOrders();
        this.pendingOrdersCount = this.pendingOrders.length;
      } catch (error) {
        console.error('Error fetching pending orders:', error);
      }
    },
    
    showPendingOrders() {
      this.showPendingOrdersDialog = true;
    },
    
    async retrySync(order) {
      if (!isOnline()) {
        frappe.show_alert({
          message: __('Cannot sync while offline'),
          indicator: 'red'
        });
        return;
      }
      
      this.$set(this.syncingOrders, order.id, true);
      
      try {
        const result = await processPendingInvoices([order]);
        if (result.processed > 0) {
          await this.updatePendingOrders();
          frappe.show_alert({
            message: __('Order synced successfully'),
            indicator: 'green'
          });
        }
      } catch (error) {
        frappe.show_alert({
          message: __('Failed to sync order: ') + error.message,
          indicator: 'red'
        });
      } finally {
        this.$set(this.syncingOrders, order.id, false);
      }
    },
    
    async syncAllPendingOrders() {
      if (!isOnline()) {
        frappe.show_alert({
          message: __('Cannot sync while offline'),
          indicator: 'red'
        });
        return;
      }
      
      this.syncingAll = true;
      
      try {
        const result = await processPendingInvoices();
        await this.updatePendingOrders();
        
        if (result.processed > 0) {
          frappe.show_alert({
            message: __(`Successfully synced ${result.processed} orders`),
            indicator: 'green'
          });
        }
        
        if (result.failed > 0) {
          frappe.show_alert({
            message: __(`Failed to sync ${result.failed} orders`),
            indicator: 'red'
          });
        }
      } catch (error) {
        frappe.show_alert({
          message: __('Error syncing orders: ') + error.message,
          indicator: 'red'
        });
      } finally {
        this.syncingAll = false;
      }
    },
    
    startAutoSync() {
      // Auto-sync every 5 minutes when online
      this.autoSyncInterval = setInterval(() => {
        if (isOnline() && this.pendingOrdersCount > 0) {
          this.syncAllPendingOrders();
        }
      }, 5 * 60 * 1000);
    },
    
    stopAutoSync() {
      if (this.autoSyncInterval) {
        clearInterval(this.autoSyncInterval);
        this.autoSyncInterval = null;
      }
    }
  },
  async mounted() {
    // Initial pending orders check
    await this.updatePendingOrders();
    
    // Setup connectivity listeners
    this.cleanupFn = setupConnectivityListeners({
      onOnline: async () => {
        this.isOffline = false;
        this.showOfflineNotification = false;
        this.showBackOnlineNotification = true;
        await this.syncAllPendingOrders();
        this.startAutoSync();
      },
      onOffline: () => {
        this.isOffline = true;
        this.showOfflineNotification = true;
        this.stopAutoSync();
      }
    });
    
    // Start auto-sync if online
    if (isOnline()) {
      this.startAutoSync();
    }
    
    // Setup periodic pending orders check
    setInterval(() => {
      this.updatePendingOrders();
    }, 30 * 1000); // Check every 30 seconds
  },
  beforeDestroy() {
    if (this.cleanupFn) {
      this.cleanupFn();
    }
    this.stopAutoSync();
  }
};
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