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