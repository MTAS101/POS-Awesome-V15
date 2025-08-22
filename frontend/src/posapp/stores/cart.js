import { defineStore } from "pinia";

export const useCartStore = defineStore("cart", {
        state: () => ({
                items: [],
                discountAmount: 0,
                additionalDiscount: 0,
                customer: null,
                taxTotal: 0,
        }),
        getters: {
                subtotal: (state) =>
                        state.items.reduce(
                                (sum, item) => sum + (item.amount || item.net_amount || 0),
                                0
                        ),
                grandTotal() {
                        return (
                                this.subtotal +
                                this.taxTotal -
                                this.discountAmount -
                                this.additionalDiscount
                        );
                },
                itemCount: (state) => state.items.length,
        },
        actions: {
                addItem(item) {
                        this.items.push(item);
                },
                updateItem(rowId, patch) {
                        const index = this.items.findIndex((i) => i.row_id === rowId);
                        if (index !== -1) {
                                this.items[index] = { ...this.items[index], ...patch };
                        }
                },
                removeItem(rowId) {
                        this.items = this.items.filter((i) => i.row_id !== rowId);
                },
                clear() {
                        this.items = [];
                        this.discountAmount = 0;
                        this.additionalDiscount = 0;
                        this.customer = null;
                        this.taxTotal = 0;
                },
                async loadDraft(id) {
                        if (typeof frappe === "undefined") return;
                        const { message } = await frappe.call({
                                method: "frappe.client.get",
                                args: { doctype: "POS Invoice", name: id },
                        });
                        if (message) {
                                this.items = message.items || [];
                                this.discountAmount = message.discount_amount || 0;
                                this.additionalDiscount = message.additional_discount || 0;
                                this.customer = message.customer || null;
                                this.taxTotal = message.taxes?.reduce(
                                        (sum, tax) => sum + (tax.tax_amount || 0),
                                        0
                                ) || 0;
                        }
                },
                async validate() {
                        if (typeof frappe === "undefined") return;
                        return frappe.call({
                                method: "posawesome.posawesome.api.invoices.validate_cart_items",
                                args: { items: JSON.stringify(this.items) },
                        });
                },
        },
        persist: {
                key: "posa_cart",
                paths: ["items", "discountAmount", "additionalDiscount"],
        },
});
