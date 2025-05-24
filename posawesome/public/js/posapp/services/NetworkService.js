import { EventBus } from '../event_bus';
import { InvoiceQueue } from './InvoiceQueue';
import { SocketService } from './SocketService';

export class NetworkService {
  static isOnline = navigator.onLine;
  static reconnectAttempts = 0;
  static MAX_RECONNECT_ATTEMPTS = 5;
  static RECONNECT_INTERVAL = 5000;
  static reconnectTimer = null;
  static SOCKET_URL = 'wss://erp.hamrooqcosmo.com:9000';

  /**
   * Initialize network monitoring
   */
  static init() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Initialize socket connection
    SocketService.init(this.SOCKET_URL);
    
    // Initial check
    this.checkConnection();
  }

  /**
   * Handle coming online
   */
  static async handleOnline() {
    console.log('App is online');
    this.isOnline = true;
    this.reconnectAttempts = 0;
    clearTimeout(this.reconnectTimer);

    EventBus.emit('network:online');
    
    // Process any queued operations
    await InvoiceQueue.processQueue();
    
    // Reconnect socket if needed
    if (!SocketService.isConnected) {
      SocketService.attemptReconnect();
    }
    
    // Refresh critical data
    this.refreshData();
  }

  /**
   * Handle going offline
   */
  static handleOffline() {
    console.log('App is offline');
    this.isOnline = false;
    EventBus.emit('network:offline');
    
    // Start reconnection attempts
    this.attemptReconnect();
  }

  /**
   * Check current connection status
   */
  static async checkConnection() {
    try {
      // Try to make a lightweight request to server
      const response = await fetch('/api/method/ping', {
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        this.handleOnline();
      } else {
        this.handleOffline();
      }
    } catch (err) {
      this.handleOffline();
    }
  }

  /**
   * Attempt to reconnect
   */
  static attemptReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached');
      EventBus.emit('network:max_attempts');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}`);

    this.reconnectTimer = setTimeout(() => {
      this.checkConnection();
    }, this.RECONNECT_INTERVAL);
  }

  /**
   * Refresh critical app data
   */
  static async refreshData() {
    EventBus.emit('refresh:addresses');
    EventBus.emit('refresh:sales_persons');
    EventBus.emit('refresh:items');
  }

  /**
   * Get current network state
   */
  static getState() {
    return {
      isOnline: this.isOnline,
      reconnectAttempts: this.reconnectAttempts,
      socketConnected: SocketService.isConnected,
      socketTransport: SocketService.getState().transport
    };
  }

  /**
   * Clean up network monitoring
   */
  static cleanup() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    SocketService.cleanup();
  }
}

// Initialize network monitoring
NetworkService.init(); 