import { defineStore } from 'pinia';

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [],
    additionalDiscount: 0,
    deliveryCharges: 0,
  }),
  getters: {
    totalQty: (state) => state.items.reduce((sum, item) => sum + (item.qty || 0), 0),
    subtotal: (state) => state.items.reduce((sum, item) => sum + (item.rate * (item.qty || 0)), 0) + state.deliveryCharges - state.additionalDiscount,
    totalItemsDiscountAmount: (state) => state.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0),
  },
  actions: {
    addItem(item) {
      this.items.push(item);
    },
    updateItem(idx, payload) {
      Object.assign(this.items[idx], payload);
    },
    removeItem(idx) {
      this.items.splice(idx, 1);
    },
    clear() {
      this.items = [];
      this.additionalDiscount = 0;
      this.deliveryCharges = 0;
    },
  },
  persist: true,
});
