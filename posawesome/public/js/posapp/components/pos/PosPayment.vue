// Method to check if we're offline
isOffline() {
  return !navigator.onLine;
},

// Method to handle offline payment submission
async handleOfflineSubmission() {
  try {
    console.log('Processing offline payment submission');
    
    // Validate payment data
    if (!this.validate_payments()) {
      return false;
    }
    
    // Process the payment for offline storage
    const result = await this.process_offline();
    
    if (result) {
      // Close the payment dialog
      this.dialog = false;
      
      // Clear the invoice view
      this.eventBus.emit("clear_invoice");
      
      // Show success message
      this.eventBus.emit("show_message", {
        title: __("Invoice saved offline and will be processed when online"),
        color: "success"
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in offline submission:', error);
    this.eventBus.emit("show_message", {
      title: __("Error processing offline payment"),
      color: "error",
      message: error.message
    });
    return false;
  }
},

// Update the submit_dialog method to handle offline mode
async submit_dialog() {
  try {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    
    // Validation checks
    if (!this.customer) {
      this.eventBus.emit("show_message", {
        title: __("Select A Customer"),
        color: "error"
      });
      return;
    }

    if (this.balance != 0) {
      this.eventBus.emit("show_message", {
        title: __("There is a pending amount to be paid"),
        color: "error"
      });
      return;
    }

    // Check if we're in offline mode
    if (this.invoice_doc && this.invoice_doc.offline_mode) {
      const success = await this.handleOfflineSubmission();
      if (success) {
        this.eventBus.emit("payment_completed", {
          success: true,
          offline: true
        });
      }
      return;
    }

    // For online mode, proceed with regular submission
    const res = await this.submit_invoice();
    if (res) {
      this.dialog = false;
      this.eventBus.emit("payment_completed", {
        success: true,
        offline: false,
        invoice_id: res.name
      });
      if (this.should_print) {
        this.show_print(res);
      }
    }
  } catch (error) {
    console.error('Error in submit_dialog:', error);
    this.eventBus.emit("show_message", {
      title: __("Error submitting payment"),
      color: "error",
      message: error.message
    });
  } finally {
    this.isSubmitting = false;
  }
}, 