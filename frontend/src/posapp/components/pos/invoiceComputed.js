export default {
	// Calculate total quantity of all items
        total_qty() {
                this.close_payments();
                return this.flt(this.cart.totalQty, this.float_precision);
        },
	// Calculate total amount for all items (handles returns)
        Total() {
                let sum = 0;
                this.cart.items.forEach((item) => {
                        const qty = this.isReturnInvoice ? Math.abs(flt(item.qty)) : flt(item.qty);
                        const rate = flt(item.rate);
                        sum += qty * rate;
                });
                return this.flt(sum, this.currency_precision);
        },
	// Calculate subtotal after discounts and delivery charges
        subtotal() {
                this.close_payments();
                return this.flt(this.cart.subtotal, this.currency_precision);
        },
	// Calculate total discount amount for all items
        total_items_discount_amount() {
                const sum = this.cart.totalItemsDiscountAmount;
                return this.flt(sum, this.float_precision);
        },
	// Format posting_date for display as DD-MM-YYYY
	formatted_posting_date: {
		get() {
			if (!this.posting_date) return "";
			const parts = this.posting_date.split("-");
			if (parts.length === 3) {
				return `${parts[2]}-${parts[1]}-${parts[0]}`;
			}
			return this.posting_date;
		},
		set(val) {
			const parts = val.split("-");
			if (parts.length === 3) {
				this.posting_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
			} else {
				this.posting_date = val;
			}
		},
	},
	// Get currency symbol for display
	currencySymbol() {
		return (currency) => {
			return get_currency_symbol(currency || this.selected_currency || this.pos_profile.currency);
		};
	},
	// Get display currency
	displayCurrency() {
		return this.selected_currency || this.pos_profile.currency;
	},
	// Determine if current invoice is a return
	isReturnInvoice() {
		return this.invoiceType === "Return" || (this.invoice_doc && this.invoice_doc.is_return);
	},
	// Table headers for item table (for another table if needed)
	itemTableHeaders() {
		return [
			{
				text: __("Item"),
				value: "item_name",
				width: "35%",
			},
			{
				text: __("Qty"),
				value: "qty",
				width: "15%",
			},
			{
				text: __(`Rate (${this.displayCurrency})`),
				value: "rate",
				width: "20%",
			},
			{
				text: __(`Amount (${this.displayCurrency})`),
				value: "amount",
				width: "20%",
			},
			{
				text: __("Action"),
				value: "actions",
				sortable: false,
				width: "10%",
			},
		];
	},
};
