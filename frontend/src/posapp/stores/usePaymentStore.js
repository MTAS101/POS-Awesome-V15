import { defineStore } from 'pinia';
import Dexie from 'dexie';

export const usePaymentStore = defineStore('payment', {
  state: () => ({
    payments: [],
    customer: null,
    currencyRate: 1,
    invoiceTotal: 0,
  }),
  getters: {
    totalPaid: (state) => state.payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    changeDue: (state) => {
      const paid = state.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      return Math.max(paid - (state.invoiceTotal || 0), 0);
    },
  },
  actions: {
    addTender(tender) {
      this.payments.push(tender);
    },
    finalizePayment(invoice) {
      // Placeholder for posting payment against invoice
    },
    async syncPending() {
      // Placeholder for Dexie queue sync
    },
    clear() {
      this.payments = [];
      this.customer = null;
      this.currencyRate = 1;
    },
  },
  persist: true,
});
