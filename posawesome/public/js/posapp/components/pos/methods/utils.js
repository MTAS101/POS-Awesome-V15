export default {
    validate_due_date(item) {
      const today = frappe.datetime.now_date();
      const parse_today = Date.parse(today);
      // Convert to backend format for comparison
      const backend_date = this.formatDateForBackend(item.posa_delivery_date);
      const new_date = Date.parse(backend_date);
      if (isNaN(new_date) || new_date < parse_today) {
        setTimeout(() => {
          item.posa_delivery_date = this.formatDateForDisplay(today);
        }, 0);
      } else {
        item.posa_delivery_date = this.formatDateForDisplay(backend_date);
      }
    },
    load_print_page(invoice_name) {
      const print_format =
        this.pos_profile.print_format_for_online ||
        this.pos_profile.print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url =
        frappe.urllib.get_base_url() +
        "/printview?doctype=Sales%20Invoice&name=" +
        invoice_name +
        "&trigger_print=1" +
        "&format=" +
        print_format +
        "&no_letterhead=" +
        letter_head;
      const printWindow = window.open(url, "Print");
      printWindow.addEventListener(
        "load",
        function () {
          printWindow.print();
          // printWindow.close();
          // NOTE : uncomoent this to auto closing printing window
        },
        true
      );
    },

    formatDateForBackend(date) {
      if (!date) return null;
      if (typeof date === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(date)) {
          const [d, m, y] = date.split('-');
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = (`0${d.getMonth() + 1}`).slice(-2);
        const day = (`0${d.getDate()}`).slice(-2);
        return `${year}-${month}-${day}`;
      }
      return date;
    },

    formatDateForDisplay(date) {
      if (!date) return '';
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, m, d] = date.split('-');
        return `${d}-${m}-${y}`;
      }
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = (`0${d.getMonth() + 1}`).slice(-2);
        const day = (`0${d.getDate()}`).slice(-2);
        return `${day}-${month}-${year}`;
      }
      return date;
    },

    toggleOffer(item) {
      this.$nextTick(() => {
        if (!item.posa_is_offer) {
          item.posa_offers = JSON.stringify([]);
          item.posa_offer_applied = 0;
          item.discount_percentage = 0;
          item.discount_amount = 0;
          item.rate = item.price_list_rate;
          this.calc_item_price(item);
          this.handelOffers();
        }
        // Ensure Vue reactivity
        this.$forceUpdate();
      });
    },  // Added missing comma here

    print_draft_invoice() {
      if (!this.pos_profile.posa_allow_print_draft_invoices) {
        this.eventBus.emit("show_message", {
          title: __(`You are not allowed to print draft invoices`),
          color: "error",
        });
        return;
      }
      let invoice_name = this.invoice_doc.name;
      frappe.run_serially([
        () => {
          const invoice_doc = this.save_and_clear_invoice();
          invoice_name = invoice_doc.name ? invoice_doc.name : invoice_name;
        },
        () => {
          this.load_print_page(invoice_name);
        },
      ]);
    },
    set_delivery_charges() {
      var vm = this;
      if (
        !this.pos_profile ||
        !this.customer ||
        !this.pos_profile.posa_use_delivery_charges
      ) {
        this.delivery_charges = [];
        this.delivery_charges_rate = 0;
        this.selected_delivery_charge = "";
        return;
      }
      this.delivery_charges_rate = 0;
      this.selected_delivery_charge = "";
      frappe.call({
        method:
          "posawesome.posawesome.api.posapp.get_applicable_delivery_charges",
        args: {
          company: this.pos_profile.company,
          pos_profile: this.pos_profile.name,
          customer: this.customer,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            if (r.message?.length) {
              console.log(r.message)
              vm.delivery_charges = r.message;
            }
          }
        },
      });
    },
    deliveryChargesFilter(itemText, queryText, itemRow) {
      const item = itemRow.raw;
      console.log("dl charges", item)
      const textOne = item.name.toLowerCase();
      const searchText = queryText.toLowerCase();
      return textOne.indexOf(searchText) > -1;
    },
    update_delivery_charges() {

      if (this.selected_delivery_charge) {
        this.delivery_charges_rate = this.selected_delivery_charge.rate;
      } else {
        this.delivery_charges_rate = 0;
      }
    },
    updatePostingDate(date) {
      if (!date) return;
      this.posting_date = date;
      this.$forceUpdate();
    },
    // Override setFormatedFloat for qty field to handle return mode
    setFormatedQty(item, field_name, precision, no_negative, value) {
      // Use the regular formatter method from the mixin
      let parsedValue = this.setFormatedFloat(item, field_name, precision, no_negative, value);

      // Ensure negative value for return invoices
      if (this.isReturnInvoice && parsedValue > 0) {
        parsedValue = -Math.abs(parsedValue);
        item[field_name] = parsedValue;
      }

      return parsedValue;
    },
    async fetch_available_currencies() {
      try {
        console.log("Fetching available currencies...");
        const r = await frappe.call({
          method: "posawesome.posawesome.api.posapp.get_available_currencies"
        });

        if (r.message) {
          console.log("Received currencies:", r.message);

          // Get base currency for reference
          const baseCurrency = this.pos_profile.currency;

          // Create simple currency list with just names
          this.available_currencies = r.message.map(currency => {
            return {
              value: currency.name,
              title: currency.name
            };
          });

          // Sort currencies - base currency first, then others alphabetically
          this.available_currencies.sort((a, b) => {
            if (a.value === baseCurrency) return -1;
            if (b.value === baseCurrency) return 1;
            return a.value.localeCompare(b.value);
          });

          // Set default currency if not already set
          if (!this.selected_currency) {
            this.selected_currency = baseCurrency;
          }

          return this.available_currencies;
        }

        return [];
      } catch (error) {
        console.error("Error fetching currencies:", error);
        // Set default currency as fallback
        const defaultCurrency = this.pos_profile.currency;
        this.available_currencies = [{
          value: defaultCurrency,
          title: defaultCurrency
        }];
        this.selected_currency = defaultCurrency;
        return this.available_currencies;
      }
    },

    async update_currency(currency) {
      if (!currency) return;
      if (currency === this.pos_profile.currency) {
        this.exchange_rate = 1;
        // Emit currency update
        this.eventBus.emit("update_currency", {
          currency: currency,
          exchange_rate: 1
        });

        // First ensure base rates exist for all items
        this.items.forEach(item => {
          if (!item.base_rate) {
            item.base_rate = item.rate;
            item.base_price_list_rate = item.price_list_rate;
            item.base_discount_amount = item.discount_amount || 0;
          }
        });

        // Then update all item rates
        this.update_item_rates();
        return;
      }

      try {
        console.log('Updating currency exchange rate...');
        console.log('Selected:', currency, 'Base:', this.pos_profile.currency, 'Date:', this.posting_date);

        // First ensure base rates exist for all items
        this.items.forEach(item => {
          if (!item.base_rate) {
            // Store original rates in base currency before switching
            item.base_rate = item.rate;
            item.base_price_list_rate = item.price_list_rate;
            item.base_discount_amount = item.discount_amount || 0;
            console.log(`Stored base rates for ${item.item_code}:`, {
              base_rate: item.base_rate,
              base_price_list_rate: item.base_price_list_rate
            });
          }
        });

        // Get rate from selected to base currency
        const response = await frappe.call({
          method: "erpnext.setup.utils.get_exchange_rate",
          args: {
            from_currency: currency,         // Selected currency (e.g. USD)
            to_currency: this.pos_profile.currency,  // Base currency (e.g. PKR)
            transaction_date: this.posting_date || frappe.datetime.nowdate()
          }
        });

        if (response.message) {
          const rate = response.message;
          // Store the rate directly without inverting
          this.exchange_rate = this.flt(rate, 6);
          console.log("Exchange rate updated:", this.exchange_rate);

          // Emit currency update
          this.eventBus.emit("update_currency", {
            currency: currency,
            exchange_rate: this.exchange_rate
          });

          // Update the currency title in the dropdown to show the rate
          const currencyIndex = this.available_currencies.findIndex(c => c.value === currency);
          if (currencyIndex !== -1) {
            this.available_currencies[currencyIndex].title = `${currency} (1 = ${this.flt(rate, 6)} ${this.pos_profile.currency})`;
            this.available_currencies[currencyIndex].rate = rate;
          }

          // Force update of all items immediately
          this.update_item_rates();

          // Log updated items for debugging
          console.log(`Updated all ${this.items.length} items to currency ${currency} with rate ${rate}`);

          // Show success message
          this.eventBus.emit("show_message", {
            title: __(`Exchange rate updated: 1 ${currency} = ${this.flt(rate, 6)} ${this.pos_profile.currency}`),
            color: "success"
          });
        } else {
          throw new Error("No exchange rate returned");
        }
      } catch (error) {
        console.error("Error updating exchange rate:", error);
        // Reset currency selection to base currency
        this.selected_currency = this.pos_profile.currency;
        this.exchange_rate = 1;

        // Emit currency update for reset
        this.eventBus.emit("update_currency", {
          currency: this.pos_profile.currency,
          exchange_rate: 1
        });

        // Reset the currency title in the dropdown
        const currencyIndex = this.available_currencies.findIndex(c => c.value === currency);
        if (currencyIndex !== -1) {
          this.available_currencies[currencyIndex].title = currency;
          this.available_currencies[currencyIndex].rate = null;
        }

        // Restore all items to base currency rates
        this.update_item_rates();

        this.eventBus.emit("show_message", {
          title: __(`Error: Could not fetch exchange rate from ${currency} to ${this.pos_profile.currency}. Please set up the exchange rate first.`),
          color: "error"
        });
      }
    },

    update_exchange_rate() {
      if (!this.exchange_rate || this.exchange_rate <= 0) {
        this.exchange_rate = 1;
      }

      // Emit currency update
      this.eventBus.emit("update_currency", {
        currency: this.selected_currency || this.pos_profile.currency,
        exchange_rate: this.exchange_rate
      });

      this.update_item_rates();
    },

    update_item_rates() {
      console.log('Updating item rates with exchange rate:', this.exchange_rate);

      this.items.forEach(item => {
        // Set skip flag to avoid double calculations
        item._skip_calc = true;

        // First ensure base rates exist for all items
        if (!item.base_rate) {
          console.log(`Setting base rates for ${item.item_code} for the first time`);
          if (this.selected_currency === this.pos_profile.currency) {
            // When in base currency, base rates = displayed rates
            item.base_rate = item.rate;
            item.base_price_list_rate = item.price_list_rate;
            item.base_discount_amount = item.discount_amount || 0;
          } else {
            // When in another currency, calculate base rates
            item.base_rate = item.rate * this.exchange_rate;
            item.base_price_list_rate = item.price_list_rate * this.exchange_rate;
            item.base_discount_amount = (item.discount_amount || 0) * this.exchange_rate;
          }
        }

        // Currency conversion logic
        if (this.selected_currency === this.pos_profile.currency) {
          // When switching back to default currency, restore from base rates
          console.log(`Restoring rates for ${item.item_code} from base rates`);
          item.price_list_rate = item.base_price_list_rate;
          item.rate = item.base_rate;
          item.discount_amount = item.base_discount_amount;
        } else {
          // When switching to another currency, convert from base rates
          console.log(`Converting rates for ${item.item_code} to ${this.selected_currency}`);

          // If exchange rate is 285 PKR = 1 USD
          // To convert PKR to USD: divide by exchange rate
          // Example: 100 PKR / 285 = 0.35 USD
          const converted_price = this.flt(item.base_price_list_rate / this.exchange_rate, this.currency_precision);
          const converted_rate = this.flt(item.base_rate / this.exchange_rate, this.currency_precision);
          const converted_discount = this.flt(item.base_discount_amount / this.exchange_rate, this.currency_precision);

          // Ensure we don't set values to 0 if they're just very small
          item.price_list_rate = converted_price < 0.000001 ? 0 : converted_price;
          item.rate = converted_rate < 0.000001 ? 0 : converted_rate;
          item.discount_amount = converted_discount < 0.000001 ? 0 : converted_discount;
        }

        // Always recalculate final amounts
        item.amount = this.flt(item.qty * item.rate, this.currency_precision);
        item.base_amount = this.flt(item.qty * item.base_rate, this.currency_precision);

        console.log(`Updated rates for ${item.item_code}:`, {
          price_list_rate: item.price_list_rate,
          base_price_list_rate: item.base_price_list_rate,
          rate: item.rate,
          base_rate: item.base_rate,
          discount: item.discount_amount,
          base_discount: item.base_discount_amount,
          amount: item.amount,
          base_amount: item.base_amount,
        });

        // Apply any other pricing rules if needed
        this.calc_item_price(item);
      });

      // Force UI update after all calculations
      this.$forceUpdate();
    },

    formatCurrency(value) {
      if (!value) return "0.00";

      // Convert to absolute value for comparison
      const absValue = Math.abs(value);

      // Determine precision based on value size
      let precision;
      if (absValue >= 1) {
        // Normal values use standard precision (2)
        precision = 2;
      } else if (absValue >= 0.01) {
        // Small values between 0.01 and 1 use 4 decimal places
        precision = 4;
      } else {
        // Very small values use higher precision (6)
        precision = 6;
      }

      // Format the number with determined precision
      const formattedValue = this.flt(value, precision).toFixed(precision);

      // Remove trailing zeros after decimal point while keeping at least 2 decimals
      const parts = formattedValue.split('.');
      if (parts.length === 2) {
        const decimalPart = parts[1].replace(/0+$/, '');
        if (decimalPart.length < 2) {
          return `${parts[0]}.${decimalPart.padEnd(2, '0')}`;
        }
        return `${parts[0]}.${decimalPart}`;
      }

      return formattedValue;
    },

    flt(value, precision = null) {
      // Enhanced float handling for small numbers
      if (precision === null) {
        precision = this.float_precision;
      }

      const _value = Number(value);
      if (isNaN(_value)) {
        return 0;
      }

      // Handle very small numbers to prevent them from becoming 0
      if (Math.abs(_value) < 0.000001) {
        return _value;
      }

      return Number((_value || 0).toFixed(precision));
    },

    // Update currency and exchange rate when currency is changed
    async update_currency_and_rate() {
      if (this.selected_currency) {
        const doc = this.get_invoice_doc();
        doc.currency = this.selected_currency;

        try {
          const response = await this.update_invoice(doc);
          if (response && response.conversion_rate) {
            this.exchange_rate = response.conversion_rate;
            this.sync_exchange_rate();
          }
        } catch (error) {
          console.error("Error updating currency:", error);
          this.eventBus.emit("show_message", {
            text: "Error updating currency",
            color: "error",
          });
        }
      }
    },

    async update_exchange_rate_on_server() {
      if (this.exchange_rate) {
        const doc = this.get_invoice_doc();
        doc.conversion_rate = this.exchange_rate;
        try {
          await this.update_invoice(doc);
          this.sync_exchange_rate();
        } catch (error) {
          console.error("Error updating exchange rate:", error);
          this.eventBus.emit("show_message", {
            text: "Error updating exchange rate",
            color: "error",
          });
        }
      }
    },

    sync_exchange_rate() {
      if (!this.exchange_rate || this.exchange_rate <= 0) {
        this.exchange_rate = 1;
      }

      // Emit currency update
      this.eventBus.emit("update_currency", {
        currency: this.selected_currency || this.pos_profile.currency,
        exchange_rate: this.exchange_rate
      });

      this.update_item_rates();
    },

    // Add new rounding function
    roundAmount(amount) {
      // If multi-currency is enabled and selected currency is different from base currency
      if (this.pos_profile.posa_allow_multi_currency &&
        this.selected_currency !== this.pos_profile.currency) {
        // For multi-currency, just keep 2 decimal places without rounding to nearest integer
        return this.flt(amount, 2);
      }
      // For base currency or when multi-currency is disabled, round to nearest integer
      return Math.round(amount);
    },

    // Increase quantity of an item (handles return logic)
    add_one(item) {
      // Increase quantity, return items remain negative
      item.qty++;
      if (item.qty == 0) {
        this.remove_item(item);
      }
      this.calc_stock_qty(item, item.qty);
      this.$forceUpdate();
    },

    // Decrease quantity of an item (handles return logic)
    subtract_one(item) {
      // Decrease quantity, return items remain negative
      item.qty--;
      if (item.qty == 0) {
        this.remove_item(item);
      }
      this.calc_stock_qty(item, item.qty);
      this.$forceUpdate();
    }
  }

};
