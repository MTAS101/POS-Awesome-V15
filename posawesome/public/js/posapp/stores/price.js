import { defineStore } from "pinia";
import { ref } from "vue";

export const usePriceStore = defineStore("price", () => {
  const cache = ref({});

  async function get_price_list({ item_code, price_list, uom }) {
    const key = `${price_list}:${item_code}:${uom}`;
    if (cache.value[key]) {
      return cache.value[key];
    }
    try {
      const r = await frappe.call({
        method: "erpnext.utilities.get_price",
        args: {
          item_code,
          price_list,
          uom,
        },
      });
      if (r.message) {
        cache.value[key] = r.message;
        return r.message;
      }
    } catch (e) {
      console.error("Failed to fetch price", e);
    }
    return null;
  }

  return { get_price_list };
});
