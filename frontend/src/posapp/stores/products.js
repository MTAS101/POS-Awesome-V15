import { defineStore } from "pinia";
import { saveItemDetailsCache, saveItemGroups } from "../../offline/index.js";

export const useProductsStore = defineStore("products", {
        state: () => ({
                list: [],
                detailCache: {},
                filters: {},
                itemGroups: [],
                loading: false,
        }),
        getters: {
                byCode: (state) => (code) =>
                        state.list.find((it) => it.item_code === code) || state.detailCache[code],
                filtered(state) {
                        const { group, search } = state.filters || {};
                        return state.list.filter((it) => {
                                const matchGroup = !group || it.item_group === group;
                                const matchSearch =
                                        !search ||
                                        (it.item_name &&
                                                it.item_name
                                                        .toLowerCase()
                                                        .includes(String(search).toLowerCase()));
                                return matchGroup && matchSearch;
                        });
                },
        },
        actions: {
                async fetchItems(params = {}) {
                        if (typeof frappe === "undefined") return;
                        this.loading = true;
                        try {
                                const args = { ...params };
                                if (args.pos_profile && typeof args.pos_profile !== "string") {
                                        args.pos_profile = JSON.stringify(args.pos_profile);
                                }
                                const { message } = await frappe.call({
                                        method: "posawesome.posawesome.api.items.get_items",
                                        args,
                                });
                                this.list = message || [];
                                try {
                                        const { message: groups } = await frappe.call({
                                                method: "posawesome.posawesome.api.items.get_items_groups",
                                                args,
                                        });
                                        this.itemGroups = groups || [];
                                        saveItemGroups(this.itemGroups);
                                } catch (e) {
                                        console.error("Failed to fetch item groups", e);
                                }
                        } finally {
                                this.loading = false;
                        }
                },
                async fetchItemDetails(code, options = {}) {
                        if (this.detailCache[code]) {
                                return this.detailCache[code];
                        }
                        if (typeof frappe === "undefined") return null;
                        const args = {
                                item: JSON.stringify({ item_code: code }),
                                ...options,
                        };
                        const { message } = await frappe.call({
                                method: "posawesome.posawesome.api.items.get_item_detail",
                                args,
                        });
                        if (message) {
                                this.detailCache[code] = message;
                                try {
                                        if (options.pos_profile && options.price_list) {
                                                saveItemDetailsCache(
                                                        options.pos_profile,
                                                        options.price_list,
                                                        [message]
                                                );
                                        }
                                } catch (e) {
                                        console.error("Failed to cache item details", e);
                                }
                        }
                        return message;
                },
                async fetchItemsByBarcode(barcode, params = {}) {
                        if (typeof frappe === "undefined") return null;
                        const { message } = await frappe.call({
                                method: "posawesome.posawesome.api.items.get_items_from_barcode",
                                args: { barcode, ...params },
                        });
                        return message;
                },
                async fetchItemVariants(code, params = {}) {
                        if (typeof frappe === "undefined") return { variants: [], attributes_meta: {} };
                        const args = { ...params, parent_item_code: code };
                        if (args.pos_profile && typeof args.pos_profile !== "string") {
                                args.pos_profile = JSON.stringify(args.pos_profile);
                        }
                        const { message } = await frappe.call({
                                method: "posawesome.posawesome.api.items.get_item_variants",
                                args,
                        });
                        return message;
                },
        },
        persist: {
                key: "posa_products",
                paths: ["detailCache", "itemGroups"],
        },
});
