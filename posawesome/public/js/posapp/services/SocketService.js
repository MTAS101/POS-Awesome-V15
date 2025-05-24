import { EventBus } from '../event_bus';
import { NetworkService } from './NetworkService';

export class SocketService {
  static socket = null;
  static manager = null;
  static isConnected = false;
  static reconnectAttempts = 0;
  static MAX_RECONNECT_ATTEMPTS = 5;
  static RECONNECT_INTERVAL = 5000;
  static PING_INTERVAL = 30000;
  static pingTimer = null;
  static reconnectTimer = null;

  /**
   * Initialize socket connection
   */
  static init(url) {
    if (!url) {
      console.error('Socket URL not provided');
      return;
    }

    try {
      this.socket = io(url, {
        reconnection: true,
        reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: this.RECONNECT_INTERVAL,
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      this.setupEventHandlers();
      this.startPingInterval();
      
      console.log('Socket service initialized');
    } catch (err) {
      console.error('Error initializing socket:', err);
    }
  }

  /**
   * Setup socket event handlers
   */
  static setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      EventBus.emit('socket:connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
      EventBus.emit('socket:disconnected', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, try reconnecting
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.handleConnectionError(error);
    });

    // Custom events
    this.socket.on('invoice_update', (data) => {
      EventBus.emit('invoice:updated', data);
    });

    this.socket.on('sync_status', (data) => {
      EventBus.emit('sync:status', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      EventBus.emit('socket:error', error);
    });
  }

  /**
   * Handle connection errors
   */
  static handleConnectionError(error) {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached');
      EventBus.emit('socket:max_attempts');
      return;
    }

    // Check if error is due to network
    if (error.message.includes('xhr poll error') || 
        error.message.includes('websocket error')) {
      NetworkService.handleOffline();
    }

    // Try reconnecting with polling if websocket fails
    if (error.message.includes('websocket error')) {
      this.socket.io.opts.transports = ['polling', 'websocket'];
    }

    EventBus.emit('socket:reconnecting', {
      attempt: this.reconnectAttempts,
      error: error.message
    });

    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, this.RECONNECT_INTERVAL);
  }

  /**
   * Attempt to reconnect
   */
  static attemptReconnect() {
    if (!this.socket) return;

    console.log(`Socket reconnection attempt ${this.reconnectAttempts}`);
    
    try {
      this.socket.connect();
    } catch (err) {
      console.error('Error during socket reconnection:', err);
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  static startPingInterval() {
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.socket.emit('ping');
      }
    }, this.PING_INTERVAL);
  }

  /**
   * Stop ping interval
   */
  static stopPingInterval() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Clean up socket connection
   */
  static cleanup() {
    this.stopPingInterval();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Get socket connection state
   */
  static getState() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      transport: this.socket?.io?.engine?.transport?.name
    };
  }
} 