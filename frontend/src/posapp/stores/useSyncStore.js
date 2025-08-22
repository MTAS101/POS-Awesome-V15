import { defineStore } from 'pinia';
import Dexie from 'dexie';

export const useSyncStore = defineStore('sync', {
  state: () => ({
    offlineInvoices: [],
    offlinePayments: [],
    queueSize: 0,
    syncInProgress: false,
  }),
  actions: {
    enqueue(type, payload) {
      if (type === 'invoice') this.offlineInvoices.push(payload);
      if (type === 'payment') this.offlinePayments.push(payload);
      this.queueSize = this.offlineInvoices.length + this.offlinePayments.length;
    },
    async syncAll() {
      this.syncInProgress = true;
      // Placeholder: iterate offline data and sync via API
      this.syncInProgress = false;
    },
    clearQueue(type) {
      if (type === 'invoice') this.offlineInvoices = [];
      if (type === 'payment') this.offlinePayments = [];
      if (!type) {
        this.offlineInvoices = [];
        this.offlinePayments = [];
      }
      this.queueSize = this.offlineInvoices.length + this.offlinePayments.length;
    },
  },
  persist: true,
});
