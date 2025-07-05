import { watch } from 'vue';
import { clearPriceListCache } from "../../offline/index.js";

export function useInvoiceWatchers(props, context) {
    const setupWatchers = (componentInstance) => {
        // Watch for customer change and update related data
        watch(() => componentInstance.customer, () => {
            componentInstance.close_payments();
            componentInstance.eventBus.emit("set_customer", componentInstance.customer);
            componentInstance.fetch_customer_details();
            componentInstance.fetch_customer_balance();
            componentInstance.set_delivery_charges();
        });

        // Watch for customer_info change and emit to edit form
        watch(() => componentInstance.customer_info, () => {
            componentInstance.eventBus.emit("set_customer_info_to_edit", componentInstance.customer_info);
        });

        // Watch for expanded row change and update item detail
        watch(() => componentInstance.expanded, (data_value) => {
            if (data_value.length > 0) {
                componentInstance.update_item_detail(data_value[0]);
            }
        });

        // Watch for discount offer name change and emit
        watch(() => componentInstance.discount_percentage_offer_name, () => {
            componentInstance.eventBus.emit("update_discount_percentage_offer_name", {
                value: componentInstance.discount_percentage_offer_name,
            });
        });

        // Watch for items array changes (deep) and re-handle offers
        watch(() => componentInstance.items, (items) => {
            componentInstance.handelOffers();
            componentInstance.$forceUpdate();
        }, { deep: true });

        // Watch for invoice type change and emit
        watch(() => componentInstance.invoiceType, () => {
            componentInstance.eventBus.emit("update_invoice_type", componentInstance.invoiceType);
        });

        // Watch for additional discount and update percentage accordingly
        watch(() => componentInstance.additional_discount, () => {
            if (!componentInstance.additional_discount || componentInstance.additional_discount == 0) {
                componentInstance.additional_discount_percentage = 0;
            } else if (componentInstance.pos_profile.posa_use_percentage_discount) {
                // Prevent division by zero which causes NaN
                if (componentInstance.Total && componentInstance.Total !== 0) {
                    componentInstance.additional_discount_percentage =
                        (componentInstance.additional_discount / componentInstance.Total) * 100;
                } else {
                    componentInstance.additional_discount_percentage = 0;
                }
            } else {
                componentInstance.additional_discount_percentage = 0;
            }
        });

        // Keep display date in sync with posting_date
        watch(() => componentInstance.posting_date, (newVal) => {
            componentInstance.posting_date_display = componentInstance.formatDateForDisplay(newVal);
        }, { immediate: true });

        // Update posting_date when user changes the display value
        watch(() => componentInstance.posting_date_display, (newVal) => {
            componentInstance.posting_date = componentInstance.formatDateForBackend(newVal);
        });

        watch(() => componentInstance.selected_price_list, (newVal) => {
            // Clear cached price list items to avoid mixing rates
            clearPriceListCache();

            const price_list = newVal === componentInstance.pos_profile.selling_price_list ? null : newVal;
            componentInstance.eventBus.emit("update_customer_price_list", price_list);
            const applied = newVal || componentInstance.pos_profile.selling_price_list;
            componentInstance.apply_cached_price_list(applied);

            // If multi-currency is enabled, sync currency with the price list currency
            if (componentInstance.pos_profile.posa_allow_multi_currency && applied) {
                frappe.call({
                    method: "posawesome.posawesome.api.invoices.get_price_list_currency",
                    args: { price_list: applied },
                    callback: (r) => {
                        if (r.message) {
                            // Store price list currency for later use
                            componentInstance.price_list_currency = r.message;
                            // Sync invoice currency with price list currency
                            componentInstance.update_currency(r.message);
                        }
                    },
                });
            }
        });

        // Reactively update item prices when currency changes
        watch(() => componentInstance.selected_currency, () => {
            if (componentInstance.items && componentInstance.items.length) {
                componentInstance.update_item_rates();
            }
        });

        // Reactively update item prices when exchange rate changes
        watch(() => componentInstance.exchange_rate, () => {
            if (componentInstance.items && componentInstance.items.length) {
                componentInstance.update_item_rates();
            }
        });
    };

    return {
        setupWatchers
    };
}