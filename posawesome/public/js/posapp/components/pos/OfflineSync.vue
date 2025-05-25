<template>
  <div>
    <v-snackbar
      v-model="showOfflineNotification"
      :timeout="-1"
      color="warning"
      location="top"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-wifi-off</v-icon>
        <div>
          <div>{{ __("You are offline. Invoices will be saved locally.") }}</div>
          <div class="text-caption" v-if="pendingCount > 0">
            {{ pendingCount }} {{ __("invoices pending sync") }}
          </div>
        </div>
        <v-btn
          v-if="pendingCount > 0"
          text
          small
          class="ml-4"
          @click="syncPendingInvoices"
          :loading="isSyncing"
        >
          {{ __("Sync Now") }}
        </v-btn>
      </div>
    </v-snackbar>
  </div>
</template>

<script>
export default {
  name: 'OfflineSync',
  
  data() {
    return {
      showOfflineNotification: false,
      pendingCount: 0,
      isSyncing: false
    };
  },

  created() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleConnectivityChange);
    window.addEventListener('offline', this.handleConnectivityChange);
    
    // Listen for offline queue updates
    window.addEventListener('offline-queue-updated', this.updatePendingCount);
    
    // Initial check
    this.handleConnectivityChange();
    this.updatePendingCount();
  },

  beforeDestroy() {
    window.removeEventListener('online', this.handleConnectivityChange);
    window.removeEventListener('offline', this.handleConnectivityChange);
    window.removeEventListener('offline-queue-updated', this.updatePendingCount);
  },

  methods: {
    async handleConnectivityChange() {
      this.showOfflineNotification = !navigator.onLine;
      if (navigator.onLine) {
        await this.syncPendingInvoices();
      }
    },

    async updatePendingCount() {
      try {
        const db = await this.openDB();
        const transaction = db.transaction(['invoices'], 'readonly');
        const store = transaction.objectStore('invoices');
        const request = store.count();
        
        request.onsuccess = () => {
          this.pendingCount = request.result;
        };
      } catch (error) {
        console.error('Error getting pending count:', error);
      }
    },

    openDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('POS_DB', 1);
        
        request.onerror = () => reject(new Error('Failed to open database'));
        request.onsuccess = (event) => resolve(event.target.result);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('invoices')) {
            db.createObjectStore('invoices', { keyPath: 'name' });
          }
        };
      });
    },

    async getPendingInvoices() {
      try {
        const db = await this.openDB();
        const transaction = db.transaction(['invoices'], 'readonly');
        const store = transaction.objectStore('invoices');
        
        return new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error('Failed to get pending invoices'));
        });
      } catch (error) {
        console.error('Error getting pending invoices:', error);
        return [];
      }
    },

    async removeSyncedInvoice(offlineId) {
      try {
        const db = await this.openDB();
        const transaction = db.transaction(['invoices'], 'readwrite');
        const store = transaction.objectStore('invoices');
        await store.delete(offlineId);
      } catch (error) {
        console.error('Error removing synced invoice:', error);
      }
    },

    async syncPendingInvoices() {
      if (!navigator.onLine || this.isSyncing) return;
      
      this.isSyncing = true;
      let successCount = 0;
      let failedCount = 0;
      
      try {
        const pendingInvoices = await this.getPendingInvoices();
        const submittedInvoices = JSON.parse(localStorage.getItem('submitted_offline_invoices') || '[]');
        
        for (const invoice of pendingInvoices) {
          try {
            // Skip if invoice was already submitted
            if (invoice.submitted || submittedInvoices.includes(invoice.offline_id)) {
              console.log('Skipping already submitted invoice:', invoice.offline_id);
              continue;
            }

            // Mark invoice as submitted before sending to prevent duplicates
            await this.markInvoiceAsSubmitted(invoice.offline_id);
            
            const response = await this.submitInvoice(invoice);
            if (response.message) {
              await this.removeSyncedInvoice(invoice.offline_id);
              
              // Remove from localStorage after successful sync
              const updatedSubmitted = submittedInvoices.filter(id => id !== invoice.offline_id);
              localStorage.setItem('submitted_offline_invoices', JSON.stringify(updatedSubmitted));
              
              successCount++;
            }
          } catch (error) {
            console.error('Error syncing invoice:', error);
            // Mark as not submitted if sync failed
            await this.markInvoiceAsNotSubmitted(invoice.offline_id);
            failedCount++;
          }
        }
        
        // Update UI
        await this.updatePendingCount();
        
        // Show result
        if (successCount > 0) {
          this.$root.$emit('show_message', {
            title: __("{0} invoices synced successfully", [successCount]),
            color: 'success'
          });
        }
        if (failedCount > 0) {
          this.$root.$emit('show_message', {
            title: __("{0} invoices failed to sync", [failedCount]),
            color: 'error'
          });
        }
        
      } catch (error) {
        console.error('Error in sync process:', error);
        this.$root.$emit('show_message', {
          title: __("Error syncing invoices: ") + error.message,
          color: 'error'
        });
      } finally {
        this.isSyncing = false;
      }
    },

    async markInvoiceAsSubmitted(offlineId) {
      const db = await this.openDB();
      const transaction = db.transaction(['invoices'], 'readwrite');
      const store = transaction.objectStore('invoices');
      
      return new Promise((resolve, reject) => {
        const getRequest = store.get(offlineId);
        
        getRequest.onsuccess = (e) => {
          const invoice = e.target.result;
          if (invoice) {
            invoice.submitted = true;
            store.put(invoice);
            resolve();
          } else {
            reject(new Error('Invoice not found'));
          }
        };
        
        getRequest.onerror = () => reject(new Error('Failed to mark invoice as submitted'));
      });
    },

    async markInvoiceAsNotSubmitted(offlineId) {
      const db = await this.openDB();
      const transaction = db.transaction(['invoices'], 'readwrite');
      const store = transaction.objectStore('invoices');
      
      return new Promise((resolve, reject) => {
        const getRequest = store.get(offlineId);
        
        getRequest.onsuccess = (e) => {
          const invoice = e.target.result;
          if (invoice) {
            invoice.submitted = false;
            store.put(invoice);
            resolve();
          } else {
            reject(new Error('Invoice not found'));
          }
        };
        
        getRequest.onerror = () => reject(new Error('Failed to mark invoice as not submitted'));
      });
    },

    submitInvoice(invoice) {
      return new Promise((resolve, reject) => {
        frappe.call({
          method: "posawesome.posawesome.api.posapp.submit_invoice",
          args: {
            invoice: invoice,
            data: {
              total_change: invoice.total_change,
              paid_change: invoice.paid_change,
              credit_change: invoice.credit_change,
              redeemed_customer_credit: invoice.redeemed_customer_credit,
              customer_credit_dict: invoice.customer_credit_dict,
              is_cashback: invoice.is_cashback,
            }
          },
          callback: function(r) {
            if (r.exc) {
              reject(new Error(r.exc));
            } else {
              resolve(r);
            }
          }
        });
      });
    }
  }
};
</script> 