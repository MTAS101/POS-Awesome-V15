import { syncOfflineInvoices } from './offline_db';

class ConnectivityService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  // Add listener for connectivity changes
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Handle online event
  async handleOnline() {
    console.log('App is online');
    this.isOnline = true;
    this.notifyListeners('online');
    
    try {
      // Try to sync pending invoices
      await syncOfflineInvoices();
    } catch (error) {
      console.error('Error syncing offline invoices:', error);
      frappe.show_alert({
        message: __('Error syncing offline invoices. Will retry later.'),
        indicator: 'red'
      });
    }
  }

  // Handle offline event
  handleOffline() {
    console.log('App is offline');
    this.isOnline = false;
    this.notifyListeners('offline');
    
    frappe.show_alert({
      message: __('You are now offline. Invoices will be saved locally.'),
      indicator: 'orange'
    });
  }

  // Notify all listeners of connectivity change
  notifyListeners(status) {
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in connectivity listener:', error);
      }
    });
  }

  // Check current online status
  getStatus() {
    return {
      online: this.isOnline,
      timestamp: Date.now()
    };
  }
}

// Create and export singleton instance
export const connectivityService = new ConnectivityService(); 