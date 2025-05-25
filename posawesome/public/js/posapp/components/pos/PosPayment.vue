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
    
    // Close the payment dialog and reset form
    this.close_dialog();
    
    // Clear the invoice view and reset all forms
    this.eventBus.emit("clear_invoice");
    this.eventBus.emit("show_payment", "false");
    this.eventBus.emit("reset_posting_date");
    this.eventBus.emit("set_customer_readonly", false);
    
    // Reset local state
    this.customer = "";
    this.balance = 0;
    this.invoice_doc = null;
    
    // Force UI update
    this.$nextTick(() => {
      // Focus on customer field in the new form
      const customerField = document.querySelector('.customer-field');
      if (customerField) {
        customerField.focus();
      }
    });
    
    // Update offline queue count
    const pendingCount = await getPendingOrdersCount();
    window.dispatchEvent(new CustomEvent('offline-queue-updated', {
      detail: { count: pendingCount }
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
      
      // Request background sync
      try {
        await navigator.serviceWorker.ready;
        await navigator.serviceWorker.sync.register('sync-invoices');
      } catch (err) {
        console.warn('Background sync registration failed:', err);
      }
    }
    
    // Show success message for new form
    this.show_message(
      "New invoice form ready",
      "success"
    );
    
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
  console.log('Starting submit_dialog');
  
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
    const isOffline = !navigator.onLine || (this.invoice_doc && this.invoice_doc.offline_mode);
    console.log('Offline mode:', isOffline);
    
    if (isOffline) {
      await this.handleOfflineSubmission();
      return;
    }

    // For online mode, proceed with regular submission
    console.log('Processing online submission');
    const res = await this.submit_invoice();
    
    if (res) {
      console.log('Online submission successful');
      
      // Close payment dialog
      this.close_dialog();
      
      // Show print if needed
      if (this.should_print) {
        this.show_print(res);
      }
      
      // Clear current invoice and show new form
      this.eventBus.emit("clear_invoice");
      this.eventBus.emit("show_payment", "false");
      this.eventBus.emit("reset_posting_date");
      this.eventBus.emit("set_customer_readonly", false);
      
      // Reset local state
      this.customer = "";
      this.balance = 0;
      this.invoice_doc = null;
      
      // Force UI update
      this.$nextTick(() => {
        // Focus on customer field in the new form
        const customerField = document.querySelector('.customer-field');
        if (customerField) {
          customerField.focus();
        }
      });
      
      // Show success message
      this.show_message(
        "Invoice submitted successfully. New invoice ready.",
        "success"
      );
    }
  } catch (error) {
    console.error('Error in submit_dialog:', error);
    this.show_message(
      "Error processing invoice: " + error.message,
      "error"
    );
  }
}, 