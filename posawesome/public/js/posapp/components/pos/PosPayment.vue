// Method to check if we're offline
isOffline() {
  return !navigator.onLine;
},

// Method to handle offline payment submission
async handleOfflineSubmission() {
  try {
    if (!this.invoice_doc) {
      this.show_message("No invoice document found", "error");
      return;
    }

    if (!this.invoice_doc.payments || !this.invoice_doc.payments.length) {
      this.show_message("Please add payment methods", "error");
      return;
    }

    const hasValidPayment = this.invoice_doc.payments.some(p => p.amount > 0);
    if (!hasValidPayment) {
      this.show_message("Please enter payment amount", "error");
      return;
    }

    // Import offline_db functions
    const { saveInvoiceOffline } = await import('../../offline_db');
    
    // Add offline flags
    this.invoice_doc.offline_pos_name = `OFFPOS${Date.now()}`;
    this.invoice_doc.offline_mode = true;
    this.invoice_doc.offline_sync_status = 'not_synced';
    this.invoice_doc.offline_submit = true;

    const result = await saveInvoiceOffline(this.invoice_doc);
    
    if (result) {
      this.show_message("Invoice saved offline successfully", "success");
      this.close_dialog();
      this.eventBus.emit("payment_completed", {
        success: true,
        offline: true,
        invoice_id: result
      });
      this.eventBus.emit("clear_invoice");
    } else {
      throw new Error("Failed to save invoice offline");
    }
  } catch (error) {
    console.error('Error in offline submission:', error);
    this.show_message(error.message || "Error saving offline invoice", "error");
  }
},

// Update the submit_dialog method to handle offline mode
async submit_dialog() {
  try {
    // Basic validation
    if (!this.customer) {
      this.show_message("Select A Customer", "error");
      return;
    }

    if (this.balance !== 0) {
      this.show_message("There is a pending amount to be paid", "error");
      return;
    }

    // Check if we're offline
    if (this.isOffline()) {
      await this.handleOfflineSubmission();
      return;
    }

    // Online submission
    const res = await this.submit_invoice();
    if (res) {
      this.close_dialog();
      this.show_print(res);
    }
  } catch (error) {
    console.error('Error in submit_dialog:', error);
    this.show_message(error.message || "Error processing payment", "error");
  }
}, 