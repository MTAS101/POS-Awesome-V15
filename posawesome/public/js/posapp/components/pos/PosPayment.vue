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

    // Generate unique offline_pos_name
    this.invoice_doc.offline_pos_name = `OFFPOS${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.invoice_doc.offline_mode = true;
    this.invoice_doc.offline_sync_status = 'not_synced';
    this.invoice_doc.offline_submit = true;

    // Import offline_db functions
    const { saveInvoiceOffline } = await import('../../offline_db');
    
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
  // Prevent duplicate submissions
  if (this.submissionLock || this.processingPayment) {
    console.log('Payment submission locked or already processing');
    return;
  }

  try {
    this.submissionLock = true;
    this.processingPayment = true;
    
    // Add a small delay to prevent rapid double clicks
    if (this.lastSubmissionTime && Date.now() - this.lastSubmissionTime < 2000) {
      console.log('Preventing rapid resubmission');
      return;
    }
    
    this.lastSubmissionTime = Date.now();

    // Clear any existing timeout
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }

    // Set a timeout to reset processing state after 30 seconds
    this.processingTimeout = setTimeout(() => {
      this.processingPayment = false;
      this.submissionLock = false;
    }, 30000);

    // Check if we're offline
    if (!navigator.onLine) {
      await this.handleOfflineSubmission();
      return;
    }

    // Validate payments before submission
    if (!this.validatePayments()) {
      this.eventBus.emit('show_message', {
        title: __('Please enter valid payment amounts'),
        color: 'error'
      });
      return;
    }

    const result = await this.process_payment();
    
    if (result && result.invoice_id) {
      // Store the last processed invoice ID to prevent duplicates
      this.lastProcessedInvoiceId = result.invoice_id;
      console.log('Payment processed successfully:', result.invoice_id);
    }
  } catch (error) {
    console.error('Error in submit_dialog:', error);
    this.eventBus.emit('show_message', {
      title: __('Error processing payment. Please try again.'),
      color: 'error'
    });
  } finally {
    // Clear timeout and reset states
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
    setTimeout(() => {
      this.processingPayment = false;
      this.submissionLock = false;
    }, 2000); // Add delay before allowing new submission
  }
},

// Validate payments before submission
validatePayments() {
  if (!this.invoice_doc || !this.invoice_doc.payments) {
    return false;
  }

  // Check if any payment method has an amount
  const hasPayment = this.invoice_doc.payments.some(payment => 
    payment.amount && parseFloat(payment.amount) > 0
  );

  if (!hasPayment) {
    return false;
  }

  // Additional validation logic can be added here
  return true;
},

data() {
  return {
    isProcessing: false,
    processingTimeout: null,
    lastProcessedInvoiceId: null,
    isOffline: !navigator.onLine,
    offlineListener: null,
    submissionLock: false,
    lastSubmissionTime: null,
    processingPayment: false
  };
},

created() {
  // Add offline/online event listeners
  this.offlineListener = () => {
    this.isOffline = !navigator.onLine;
    if (!navigator.onLine) {
      this.handleOfflineMode();
    }
  };
  window.addEventListener('online', this.offlineListener);
  window.addEventListener('offline', this.offlineListener);
},

beforeUnmount() {
  // Remove event listeners
  if (this.offlineListener) {
    window.removeEventListener('online', this.offlineListener);
    window.removeEventListener('offline', this.offlineListener);
  }
  
  // Clear any pending timeouts
  if (this.processingTimeout) {
    clearTimeout(this.processingTimeout);
  }
},

methods: {
  handleOfflineMode() {
    console.log('Handling offline mode in payment');
    this.eventBus.emit('show_message', {
      title: __('You are offline. Payment will be processed locally.'),
      color: 'warning'
    });
  },

  // Method to handle pay button click
  handlePayClick() {
    // Show payment dialog first without submitting
    this.eventBus.emit("show_payment", true);
    this.eventBus.emit("set_customer_readonly", true);
  },

  // ... existing code ...
} 