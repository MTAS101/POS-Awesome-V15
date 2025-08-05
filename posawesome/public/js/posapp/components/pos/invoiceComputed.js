export default {
	// Calculate total quantity of all items
        total_qty() {
                this.close_payments();
                const qty = this.items.reduce((sum, item) => sum + flt(item.qty), 0);
                return this.flt(qty, this.float_precision);
        },
        // Calculate total amount for all items (handles returns)
        Total() {
                const sum = this.items.reduce((acc, item) => {
                        // For returns, use absolute value for correct calculation
                        const qty = this.isReturnInvoice ? Math.abs(flt(item.qty)) : flt(item.qty);
                        return acc + qty * flt(item.rate);
                }, 0);
                return this.flt(sum, this.currency_precision);
        },
        // Calculate subtotal after discounts and delivery charges
        subtotal() {
                this.close_payments();
                let sum = this.items.reduce((acc, item) => {
                        const qty = this.isReturnInvoice ? Math.abs(flt(item.qty)) : flt(item.qty);
                        return acc + qty * flt(item.rate);
                }, 0);

                // Subtract additional discount
                sum -= this.flt(this.additional_discount);

                // Add delivery charges
                sum += this.flt(this.delivery_charges_rate);

                return this.flt(sum, this.currency_precision);
        },
        // Calculate total discount amount for all items
        total_items_discount_amount() {
                const sum = this.items.reduce((acc, item) => {
                        const qty = this.isReturnInvoice ? Math.abs(flt(item.qty)) : flt(item.qty);
                        return acc + qty * flt(item.discount_amount);
                }, 0);
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
