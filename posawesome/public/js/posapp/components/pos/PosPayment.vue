// Method to check if we're offline
isOffline() {
  return !navigator.onLine;
},

// Method to handle offline payment submission
handleOfflineSubmission() {
  console.log('Processing offline payment submission');
  
  // For offline mode, show a success message and clear without redirect
  this.show_message(
    "Invoice saved offline and will be processed when online",
    "success"
  );
  
  // Close the payment dialog
  this.close_dialog();
  
  // Clear the invoice view without trying to navigate
  this.eventBus.emit("clear_invoice");
},

// Update the submit_dialog method to handle offline mode
async submit_dialog() {
  // Validation checks
  if (!this.customer) {
    this.show_message(
      "Select A Customer",
      "error"
    );
    return;
  }

  if (this.balance != 0) {
    this.show_message(
      "There is a pending amount to be paid",
      "error"
    );
    return;
  }

  // Check if we're in offline mode
  if (this.invoice_doc && this.invoice_doc.offline_mode) {
    this.handleOfflineSubmission();
    return;
  }

  // For online mode, proceed with regular submission
  const res = await this.submit_invoice();
  if (res) {
    this.close_dialog();
    this.show_print(res);
  }
},

async submit_invoice(print) {
  if (!this.validate_payments()) {
    return;
  }

  try {
    this.saving = true;
    
    // Prepare invoice data
    const invoice = JSON.stringify(this.invoice_doc);
    const payments = this.process_payments();
    
    const data = {
      invoice: invoice,
      data: {
        payments: payments,
        redeemed_customer_credit: this.redeemed_customer_credit,
        customer_credit_dict: this.customer_credit_dict,
        credit_change: this.credit_change,
        paid_change: this.paid_change,
        is_credit_sale: this.is_credit_sale,
        is_write_off_change: this.is_write_off_change,
        is_cashback: this.is_cashback
      }
    };

    const result = await apiCall({
      method: API_METHODS.SUBMIT_INVOICE,
      args: data,
      isInvoice: true
    });

    if (result.message) {
      if (result.message.status === 1) {
        this.invoiceDialog = false;
        this.dialog = false;
        this.eventBus.emit("clear_invoice");
        if (print) {
          this.load_print_page(result.message.name);
        }
        this.saving = false;
        
        this.eventBus.emit('payment_completed', {
          success: true,
          offline: false,
          invoice_id: result.message.name
        });
      } else {
        const draft = await apiCall({
          method: "frappe.client.get",
          args: {
            doctype: "Sales Invoice",
            name: result.message.name,
          }
        });

        if (draft.message) {
          this.invoiceDialog = false;
          this.dialog = false;
          this.eventBus.emit("clear_invoice");
          this.eventBus.emit("load_invoice", draft.message);
          this.saving = false;
          
          this.eventBus.emit('payment_completed', {
            success: true,
            offline: false,
            invoice_id: draft.message.name,
            draft: true
          });
        }
      }
    }
  } catch (error) {
    console.error('Error submitting invoice:', error);
    this.eventBus.emit('show_message', {
      title: __('Error submitting invoice'),
      color: 'error',
      message: error.message
    });
    this.saving = false;
  }
},

async request_payment(payment) {
  this.phone_dialog = false;
  const vm = this;
  if (!this.invoice_doc.contact_mobile) {
    this.eventBus.emit("show_message", {
      title: __("Please set the customer's mobile number"),
      color: "error",
    });
    this.eventBus.emit("open_edit_customer");
    this.back_to_invoice();
    return;
  }
  this.eventBus.emit("freeze", { title: __("Waiting for payment...") });
  this.invoice_doc.payments.forEach((payment) => {
    payment.amount = this.flt(payment.amount);
  });
  let formData = { ...this.invoice_doc };
  formData["total_change"] = !this.invoice_doc.is_return ? -this.diff_payment : 0;
  formData["paid_change"] = !this.invoice_doc.is_return ? this.paid_change : 0;
  formData["credit_change"] = -this.credit_change;
  formData["redeemed_customer_credit"] = this.redeemed_customer_credit;
  formData["customer_credit_dict"] = this.customer_credit_dict;
  formData["is_cashback"] = this.is_cashback;

  try {
    const updateResult = await apiCall({
      method: API_METHODS.UPDATE_INVOICE,
      args: { data: formData },
      isInvoice: true
    });

    if (updateResult.message) {
      vm.invoice_doc = updateResult.message;
      
      const paymentResult = await apiCall({
        method: API_METHODS.CREATE_PAYMENT_REQUEST,
        args: { doc: vm.invoice_doc },
        isInvoice: true
      });

      const payment_request_name = paymentResult.message.name;
      
      setTimeout(async () => {
        const statusResult = await apiCall({
          method: "frappe.db.get_value",
          args: {
            doctype: "Payment Request",
            filters: { name: payment_request_name },
            fieldname: ["status", "grand_total"]
          }
        });

        if (statusResult.message.status !== "Paid") {
          vm.eventBus.emit("unfreeze");
          vm.eventBus.emit("show_message", {
            title: __("Payment Request took too long to respond. Please try requesting for payment again"),
            color: "error",
          });
        } else {
          vm.eventBus.emit("unfreeze");
          vm.eventBus.emit("show_message", {
            title: __("Payment of {0} received successfully.", [
              vm.formatCurrency(statusResult.message.grand_total, vm.invoice_doc.currency, 0),
            ]),
            color: "success",
          });

          const docResult = await apiCall({
            method: "frappe.db.get_doc",
            args: {
              doctype: "Sales Invoice",
              name: vm.invoice_doc.name
            }
          });

          vm.invoice_doc = docResult;
          vm.submit(null, true);
        }
      }, 30000);
    }
  } catch (error) {
    vm.eventBus.emit("unfreeze");
    vm.eventBus.emit("show_message", {
      title: __("Payment request failed"),
      color: "error",
    });
  }
}, 