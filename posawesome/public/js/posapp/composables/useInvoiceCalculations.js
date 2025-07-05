import { computed } from 'vue';

export function useInvoiceCalculations() {
  const setupCalculations = (componentInstance) => {
    // Calculate total quantity of all items
    const total_qty = computed(() => {
      componentInstance.close_payments();
      let qty = 0;
      componentInstance.items.forEach((item) => {
        qty += flt(item.qty);
      });
      return componentInstance.flt(qty, componentInstance.float_precision);
    });

    // Calculate total amount for all items (handles returns)
    const Total = computed(() => {
      let sum = 0;
      componentInstance.items.forEach((item) => {
        // For returns, use absolute value for correct calculation
        const qty = componentInstance.isReturnInvoice ? Math.abs(flt(item.qty)) : flt(item.qty);
        const rate = flt(item.rate);
        sum += qty * rate;
      });
      return componentInstance.flt(sum, componentInstance.currency_precision);
    });

    // Calculate subtotal after discounts and delivery charges
    const subtotal = computed(() => {
      componentInstance.close_payments();
      let sum = 0;
      componentInstance.items.forEach((item) => {
        // For returns, use absolute value for correct calculation
        const qty = componentInstance.isReturnInvoice ? Math.abs(flt(item.qty)) : flt(item.qty);
        const rate = flt(item.rate);
        sum += qty * rate;
      });

      // Subtract additional discount
      const additional_discount = componentInstance.flt(componentInstance.additional_discount);
      sum -= additional_discount;

      // Add delivery charges
      const delivery_charges = componentInstance.flt(componentInstance.delivery_charges_rate);
      sum += delivery_charges;

      return componentInstance.flt(sum, componentInstance.currency_precision);
    });

    // Calculate total discount amount for all items
    const total_items_discount_amount = computed(() => {
      let sum = 0;
      componentInstance.items.forEach((item) => {
        // For returns, use absolute value for correct calculation
        if (componentInstance.isReturnInvoice) {
          sum += Math.abs(flt(item.qty)) * flt(item.discount_amount);
        } else {
          sum += flt(item.qty) * flt(item.discount_amount);
        }
      });
      return componentInstance.flt(sum, componentInstance.float_precision);
    });

    // Format posting_date for display as DD-MM-YYYY
    const formatted_posting_date = computed({
      get() {
        if (!componentInstance.posting_date) return '';
        const parts = componentInstance.posting_date.split('-');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return componentInstance.posting_date;
      },
      set(val) {
        const parts = val.split('-');
        if (parts.length === 3) {
          componentInstance.posting_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
          componentInstance.posting_date = val;
        }
      }
    });

    // Get currency symbol for display
    const currencySymbol = computed(() => {
      return (currency) => {
        return get_currency_symbol(currency || componentInstance.selected_currency || componentInstance.pos_profile.currency);
      };
    });

    // Get display currency
    const displayCurrency = computed(() => {
      return componentInstance.selected_currency || componentInstance.pos_profile.currency;
    });

    // Determine if current invoice is a return
    const isReturnInvoice = computed(() => {
      return componentInstance.invoiceType === 'Return' || (componentInstance.invoice_doc && componentInstance.invoice_doc.is_return);
    });

    // Table headers for item table
    const itemTableHeaders = computed(() => {
      return [
        {
          text: __('Item'),
          value: 'item_name',
          width: '35%',
        },
        {
          text: __('Qty'),
          value: 'qty',
          width: '15%',
        },
        {
          text: __(`Rate (${displayCurrency.value})`),
          value: 'rate',
          width: '20%',
        },
        {
          text: __(`Amount (${displayCurrency.value})`),
          value: 'amount',
          width: '20%',
        },
        {
          text: __('Action'),
          value: 'actions',
          sortable: false,
          width: '10%',
        },
      ];
    });

    return {
      total_qty,
      Total,
      subtotal,
      total_items_discount_amount,
      formatted_posting_date,
      currencySymbol,
      displayCurrency,
      isReturnInvoice,
      itemTableHeaders
    };
  };

  return {
    setupCalculations
  };
}