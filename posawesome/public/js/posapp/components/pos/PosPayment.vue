// Method to check if we're offline
isOffline() {
  return !navigator.onLine;
},

// Method to handle offline payment submission
async handleOfflineSubmission() {
  console.log('Processing offline payment submission');
  
  try {
    // Save invoice to IndexedDB
    await saveInvoiceOffline(this.invoice_doc);
    
    // For offline mode, show a success message
    this.show_message(
      "Invoice saved offline and will be processed when online",
      "success"
    );
    
    // Close the payment dialog
    this.close_dialog();
    
    // Clear the invoice view without trying to navigate
    this.eventBus.emit("clear_invoice");
    
    // Update offline queue count
    window.dispatchEvent(new CustomEvent('offline-queue-updated', {
      detail: { count: await getPendingOrdersCount() }
    }));
    
    // Cache the current page state
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_CURRENT_PAGE',
        payload: {
          url: window.location.href,
          timestamp: Date.now()
        }
      });
    }
    
  } catch (error) {
    console.error('Error in offline submission:', error);
    this.show_message(
      "Error saving invoice offline: " + error.message,
      "error"
    );
  }
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

  try {
    // Check if we're in offline mode
    if (this.invoice_doc && (this.invoice_doc.offline_mode || !navigator.onLine)) {
      await this.handleOfflineSubmission();
      return;
    }

    // For online mode, proceed with regular submission
    const res = await this.submit_invoice();
    if (res) {
      this.close_dialog();
      this.show_print(res);
    }
  } catch (error) {
    console.error('Error in submit_dialog:', error);
    this.show_message(
      "Error processing invoice: " + error.message,
      "error"
    );
  }
}, 