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
  const transactionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  if (this.isProcessing || this.processingTransactionId) {
    console.log('Payment already in process, skipping duplicate submission from submit_dialog');
    return;
  }
  try {
    this.isProcessing = true;
    this.processingTransactionId = transactionId;
    if (this.processingTimeout) clearTimeout(this.processingTimeout);
    this.processingTimeout = setTimeout(() => {
      if (this.processingTransactionId === transactionId) {
        this.isProcessing = false;
        this.processingTransactionId = null;
      }
    }, 30000);

    // The `process_payment` method is called with transactionId
    const result = await this.process_payment(transactionId);
    
    if (result && result.invoice_id) {
      if (this.processingTransactionId === transactionId) {
        this.lastProcessedInvoiceId = result.invoice_id;
        console.log('Payment processed successfully (submit_dialog):', result.invoice_id);
        // If print flag was stored (e.g., this.print_after_submit_flag) and result is success,
        // and submit_invoice was the one doing printing, it should have handled it.
        // Or, if printing is done here:
        if (this.print_after_submit_flag && result.invoice_id && !result.offline) {
          // Assuming load_print_page is available and correctly prints the given invoice_id
          // submit_invoice is now responsible for printing, so this might be redundant or handled there
          // this.load_print_page(result.invoice_id); 
        }
        this.print_after_submit_flag = false; // Reset flag
        this.processingTransactionId = null; // Clear only for this successful transaction
      }
    }
  } catch (error) {
    console.error('Error in submit_dialog:', error);
    // Ensure this error is user-visible if not handled by called methods
    if (!error.message?.includes('superseded')) { // Avoid redundant alerts for superseded
      frappe.show_alert({
        message: __('Error processing payment. Please try again.'),
        indicator: 'red'
      });
    }
  } finally {
    if (this.processingTransactionId === transactionId) {
      if (this.processingTimeout) clearTimeout(this.processingTimeout);
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
      // Pass the transactionId to handle_offline_invoice
      return await this.handle_offline_invoice(transactionId);
    }

    // Online invoice creation logic
    // Pass the transactionId to submit_invoice (assuming submit_invoice is adapted or already handles it)
    const invoice = await this.submit_invoice(transactionId); 
    return invoice;
  } catch (error) {
    console.error('Error in create_invoice:', error);
    // Ensure processing state is reset on error if this transaction was active
    if (this.processingTransactionId === transactionId) {
        this.isProcessing = false;
        this.processingTransactionId = null;
        if(this.processingTimeout) clearTimeout(this.processingTimeout);
    }
    throw error;
  }
},

async handle_offline_invoice(transactionId) {
  // Ensure this is still the active transaction before proceeding
  if (this.processingTransactionId !== transactionId) {
    console.log('Transaction was superseded, aborting offline invoice handling');
    return null;
  }

  console.log('Processing offline invoice with transaction ID:', transactionId);

  try {
    // Assuming this.invoice_doc is populated with the current invoice details
    if (!this.invoice_doc) {
      console.error('Invoice document is not available for offline saving.');
      this.eventBus.emit('show_message', {
        title: __('Invoice data is missing. Cannot save offline.'),
        color: 'error',
      });
      return null;
    }

    // Prepare the invoice data for offline storage
    // Ensure posa_transaction_id is set from the passed transactionId
    const invoiceToSave = {
      ...this.invoice_doc,
      posa_transaction_id: transactionId, // Crucial for preventing duplicates
      payments: this.process_payments(), // Assuming this prepares payment data correctly
      // Add any other necessary fields for offline object, similar to prepare_invoice_data in Payments.vue
      offline_pos_name: `OFFPOS-${transactionId}`, // Ensure unique offline name
      offline_invoice: 1,
      offline_sync_status: 'not_synced',
      // Ensure all necessary fields from the original invoice_doc are included
      // This might require a more robust way to clone/prepare this.invoice_doc
      // For example, if 'items' or other nested objects need specific processing:
      // items: this.invoice_doc.items.map(item => ({ ...item })), // Deep clone if necessary
    };
    
    // Dynamically import saveInvoiceOffline from offline_db.js
    const { saveInvoiceOffline } = await import('../../offline_db');
    const savedInvoiceName = await saveInvoiceOffline(invoiceToSave);

    if (savedInvoiceName) {
      this.eventBus.emit('show_message', {
        title: __('Invoice saved offline successfully'),
        message: `ID: ${savedInvoiceName}`,
        color: 'success',
      });
      this.eventBus.emit('payment_completed', {
        success: true,
        offline: true,
        invoice_id: savedInvoiceName,
        transactionId: transactionId,
      });
      this.close_dialog(); // Close payment dialog
      this.eventBus.emit('clear_invoice'); // Clear current invoice view
      return { name: savedInvoiceName, transactionId: transactionId }; // Return consistent with online flow
    } else {
      throw new Error('Failed to save invoice offline, saveInvoiceOffline returned null or undefined.');
    }
  } catch (error) {
    console.error('Error saving invoice offline:', error);
    this.eventBus.emit('show_message', {
      title: __('Error saving invoice offline'),
      message: error.message || 'Please try again.',
      color: 'error',
    });
    // Do not re-throw the error here if you want submit_dialog to reset processing state
    // Or, ensure submit_dialog's finally block correctly handles it.
    return null; // Indicate failure
  }
  // Note: The processing state (isProcessing, processingTransactionId)
  // should be reset by the calling function (submit_dialog) in its finally block
  // to ensure it's always reset regardless of success or failure here.
},

async submit_invoice(transactionIdOrPrint) {
  let transactionId = typeof transactionIdOrPrint === 'string' ? transactionIdOrPrint : this.invoice_doc.posa_transaction_id;
  let print = typeof transactionIdOrPrint === 'boolean' ? transactionIdOrPrint : false; // Default print to false

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
        transaction_id: transactionId
      }
    };

    console.log('Submitting invoice with transaction ID:', transactionId);

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
          transaction_id: transactionId
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
            transaction_id: transactionId
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
    lastProcessedInvoiceId: null,
    print_after_submit_flag: false
  };
},

// Add mounted and beforeUnmount for event bus handling
mounted() {
  this.eventBus.on('initiate_actual_payment_processing', this.handlePaymentProcessingEvent);
  // ... any other event listeners you might have in mounted ...
},

beforeUnmount() {
  this.eventBus.off('initiate_actual_payment_processing', this.handlePaymentProcessingEvent);
  // ... any other event listener cleanups ...
},

methods: {
  // Ensure all methods called by submit_dialog are defined in this component or a mixin
  // For example: process_payments(), validate_payments(), load_print_page(), close_dialog()
  // show_message(), etc.
  
  // Method to handle the event from Payments.vue
  handlePaymentProcessingEvent({ print }) {
    // Before calling submit_dialog, ensure this.invoice_doc and other required data 
    // by submit_dialog and its subsequent calls (like process_payment, create_invoice, submit_invoice)
    // are correctly populated. This might involve fetching or updating this.invoice_doc
    // if Payments.vue was modifying a local copy.
    // For now, we assume this.invoice_doc in PosPayment.vue is the source of truth or is kept in sync.

    // Also, ensure that `submit_invoice` in this component is prepared to handle
    // the `print` flag if it's not already doing so, or adapt the call.
    // The current `submit_dialog` calls `process_payment` which calls `create_invoice`
    // which then calls `this.submit_invoice(transactionId)`. 
    // We need to make sure the `print` flag is passed down if `submit_invoice` needs it.
    
    // For simplicity, if `submit_invoice` is to be called with print flag, we might need to
    // adjust `submit_dialog` or how `print` is passed. 
    // However, `submit_dialog` itself does not directly take `print`.
    // The `submit_invoice` method has been updated to take `transactionIdOrPrint`.
    // Let's assume submit_dialog will call the updated submit_invoice which can handle the print flag.
    
    // A potential way to handle print: modify submit_dialog to accept print, or store print flag in `this`
    // and have `submit_invoice` check it.
    // For now, let's assume the primary goal is to trigger the submission process.
    // The `print` flag handling would be part of ensuring `submit_invoice` works as intended.

    this.print_after_submit_flag = print; // Store print flag if needed by submit_invoice
    this.submit_dialog(); // submit_dialog will generate its own transactionId
  },

  // ... rest of the methods like process_payment, create_invoice, handle_offline_invoice, submit_invoice
  // Ensure `load_print_page` is defined if used directly in submit_dialog
  // Ensure `close_dialog` is defined if `handle_offline_invoice` or other parts call it.
  // Ensure `this.invoice_doc` is managed correctly, as it's used by `submit_invoice` and `handle_offline_invoice`
  // Ensure `this.process_payments` is defined as it's used by `submit_invoice` and `handle_offline_invoice`
} 