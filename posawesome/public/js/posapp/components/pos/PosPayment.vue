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
  // Generate a unique transaction ID for this payment attempt
  const transactionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Check if payment is already being processed
  if (this.isProcessing || this.processingTransactionId) {
    console.log('Payment already in process, skipping duplicate submission');
    return;
  }

  try {
    this.isProcessing = true;
    this.processingTransactionId = transactionId;
    
    // Clear any existing timeout
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }

    // Set a timeout to reset processing state after 30 seconds
    this.processingTimeout = setTimeout(() => {
      if (this.processingTransactionId === transactionId) {
        this.isProcessing = false;
        this.processingTransactionId = null;
      }
    }, 30000);

    const result = await this.process_payment(transactionId);
    
    if (result && result.invoice_id) {
      // Only process if this is still the active transaction
      if (this.processingTransactionId === transactionId) {
        this.lastProcessedInvoiceId = result.invoice_id;
        console.log('Payment processed successfully:', result.invoice_id);
        
        // Clear the processing state for this transaction
        this.processingTransactionId = null;
      } else {
        console.log('Transaction was superseded by a newer one');
      }
    }
  } catch (error) {
    console.error('Error in submit_dialog:', error);
    frappe.show_alert({
      message: __('Error processing payment. Please try again.'),
      indicator: 'red'
    });
  } finally {
    // Only clear the processing state if this is still the active transaction
    if (this.processingTransactionId === transactionId) {
      // Clear timeout and reset state
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
      }
      this.isProcessing = false;
      this.processingTransactionId = null;
    }
  }
},

async process_payment(transactionId) {
  // Verify this is still the active transaction
  if (this.processingTransactionId !== transactionId) {
    console.log('Transaction was superseded, aborting payment processing');
    return null;
  }

  try {
    const invoice = await this.create_invoice(transactionId);
    
    if (invoice && invoice.name) {
      // Check if this invoice was already processed
      if (this.lastProcessedInvoiceId === invoice.name) {
        console.log('Invoice already processed:', invoice.name);
        return null;
      }

      // Only update if this is still the active transaction
      if (this.processingTransactionId === transactionId) {
        this.lastProcessedInvoiceId = invoice.name;
        
        // Emit payment completed event
        this.eventBus.emit('payment_completed', {
          success: true,
          invoice_id: invoice.name,
          transactionId: transactionId
        });

        return { success: true, invoice_id: invoice.name };
      } else {
        console.log('Transaction was superseded during processing');
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error in process_payment:', error);
    throw error;
  }
},

async create_invoice(transactionId) {
  // Verify this is still the active transaction
  if (this.processingTransactionId !== transactionId) {
    console.log('Transaction was superseded, aborting invoice creation');
    return null;
  }

  try {
    // Check if we're offline
    if (!navigator.onLine) {
      return await this.handle_offline_invoice(transactionId);
    }

    // Online invoice creation logic
    const invoice = await this.submit_invoice(transactionId);
    return invoice;
  } catch (error) {
    console.error('Error in create_invoice:', error);
    throw error;
  }
},

async submit_invoice(print) {
  if (!this.validate_payments()) {
    return;
  }

  // Generate unique transaction ID if not exists
  if (!this.invoice_doc.posa_transaction_id) {
    this.invoice_doc.posa_transaction_id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  try {
    if (this.isProcessing) {
      console.log('Payment already in process, skipping duplicate submission');
      return;
    }

    this.isProcessing = true;
    this.saving = true;
    
    // Clear any existing timeout
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }

    // Set timeout to reset processing state after 30 seconds
    this.processingTimeout = setTimeout(() => {
      this.isProcessing = false;
      this.saving = false;
    }, 30000);
    
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
        is_cashback: this.is_cashback,
        transaction_id: this.invoice_doc.posa_transaction_id
      }
    };

    console.log('Submitting invoice with transaction ID:', this.invoice_doc.posa_transaction_id);

    const result = await frappe.call({
      method: "posawesome.posawesome.api.posapp.submit_invoice",
      args: data
    });

    if (result.message) {
      if (result.message.status === 1) {
        this.invoiceDialog = false;
        this.dialog = false;
        this.eventBus.emit("clear_invoice");
        if (print) {
          this.load_print_page(result.message.name);
        }
        
        this.eventBus.emit('payment_completed', {
          success: true,
          offline: false,
          invoice_id: result.message.name,
          transaction_id: this.invoice_doc.posa_transaction_id
        });
      } else {
        const draft = await frappe.call({
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
          
          this.eventBus.emit('payment_completed', {
            success: true,
            offline: false,
            invoice_id: draft.message.name,
            draft: true,
            transaction_id: this.invoice_doc.posa_transaction_id
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
  } finally {
    // Clear timeout and reset states
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
    this.isProcessing = false;
    this.saving = false;
  }
},

data() {
  return {
    isProcessing: false,
    processingTimeout: null,
    processingTransactionId: null,
    lastProcessedInvoiceId: null
  };
} 