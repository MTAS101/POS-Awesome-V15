import { defineStore } from 'pinia';
import Dexie from 'dexie';

// cache TTL for price list currency (ms)
const PRICE_LIST_TTL = 1000 * 60 * 5;

export const useProductsStore = defineStore('products', {
  state: () => ({
    items: [],
    filters: {},
    itemDetailCache: {},
    priceList: null,
    priceListCurrencyCache: {},
    validationCache: { key: null, result: null },
  }),
  getters: {
    filteredItems: (state) => {
      return state.items.filter((item) => {
        if (!state.filters || !state.filters.search) return true;
        return item.item_name?.toLowerCase().includes(state.filters.search.toLowerCase());
      });
    },
    itemByCode: (state) => (code) => state.items.find((i) => i.item_code === code),
  },
  actions: {
    async fetchProducts(force = false) {
      if (this.items.length && !force) return;
      // Placeholder: actual fetch implementation should hit API and cache via Dexie
    },
    async fetchItemByCode(code) {
      return this.itemByCode(code);
    },
    applyPriceList(list) {
      this.priceList = list;
    },
    async validateCartItems(items) {
      const key = JSON.stringify(items || []);
      if (this.validationCache.key === key) {
        return this.validationCache.result;
      }
      const r = await frappe.call({
        method: 'posawesome.posawesome.api.invoices.validate_cart_items',
        args: { items: JSON.stringify(items) },
      });
      this.validationCache = { key, result: r.message };
      return r.message;
    },
    async fetchPriceListCurrency(list) {
      const cached = this.priceListCurrencyCache[list];
      const now = Date.now();
      if (cached && now - cached.ts < PRICE_LIST_TTL) {
        return cached.currency;
      }
      const r = await frappe.call({
        method: 'posawesome.posawesome.api.invoices.get_price_list_currency',
        args: { price_list: list },
      });
      this.priceListCurrencyCache[list] = { currency: r.message, ts: now };
      return r.message;
    },
  },
  persist: {
    paths: ['filters'],
  },
});
