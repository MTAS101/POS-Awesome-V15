import { defineStore } from 'pinia'

export const useInvoiceStore = defineStore('invoice', {
  state: () => ({
    customer: null,
    items: [],
    selectedColumns: [],
    itemSelectorSettings: {
      hide_qty_decimals: false,
      hide_zero_rate_items: false,
      new_line: false,
    },
  }),
  actions: {
    setCustomer(customer) {
      this.customer = customer
    },
    addItem(item) {
      this.items.push(item)
    },
    setItems(items) {
      this.items = items
    },
    setSelectedColumns(columns) {
      this.selectedColumns = columns
    },
    setItemSelectorSettings(opts) {
      this.itemSelectorSettings = { ...this.itemSelectorSettings, ...opts }
    },
    setNewLine(val) {
      this.itemSelectorSettings.new_line = val
    },
  }
})
