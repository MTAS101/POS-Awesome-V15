<template>
  <!-- Main navigation container -->
  <nav>

    <!-- Top App Bar: application header with nav toggle, logo, title, and actions -->

    <v-app-bar app flat height="64" color="white" class="navbar-enhanced elevation-2">
      <v-app-bar-nav-icon ref="navIcon" @click="handleNavClick" class="text-secondary nav-icon" />

      <v-img src="/assets/posawesome/js/posapp/components/pos/pos.png" alt="POS Awesome" max-width="32" class="mx-3" />

      <v-toolbar-title @click="goDesk" class="text-h6 font-weight-bold text-primary" style="cursor: pointer;">
        <span class="font-weight-light">POS</span><span>Awesome</span>
      </v-toolbar-title>

      <v-spacer />

      <!-- Enhanced connectivity status indicator - Always visible -->
      <div class="status-section-enhanced">
        <v-badge :content="pendingInvoices" :model-value="pendingInvoices > 0" color="red" overlap offset-x="4"
          offset-y="4">
          <v-btn icon :title="statusText" class="status-btn-enhanced" :color="statusColor">
            <v-icon :color="statusColor">{{ statusIcon }}</v-icon>
          </v-btn>
        </v-badge>
        <div class="status-info-always-visible">
          <div class="status-title-inline"
            :class="{ 'status-connected': statusColor === 'green', 'status-offline': statusColor === 'red' }">{{
            statusText }}</div>
          <div class="status-detail-inline">{{ syncInfoText }}</div>
        </div>
      </div>

      <div class="profile-section">
        <v-chip color="primary" variant="outlined" class="profile-chip">
          <v-icon start>mdi-account-circle</v-icon>
          {{ posProfile.name }}
        </v-chip>
      </div>

      <v-menu offset-y offset-x :min-width="200">
        <template #activator="{ props }">
          <v-btn v-bind="props" color="primary" variant="elevated" class="menu-btn-enhanced">
            {{ __('Menu') }}
            <v-icon right>mdi-menu-down</v-icon>
          </v-btn>
        </template>
        <v-card class="menu-card-enhanced" elevation="8">
          <v-list density="compact" class="menu-list-enhanced">
            <v-list-item v-if="!posProfile.posa_hide_closing_shift" @click="openCloseShift" class="menu-item-enhanced">
              <template v-slot:prepend>
                <v-icon color="primary" size="20">mdi-content-save-move-outline</v-icon>
              </template>
              <v-list-item-title>{{ __('Close Shift') }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="posProfile.posa_allow_print_last_invoice && lastInvoiceId" @click="printLastInvoice"
              class="menu-item-enhanced">
              <template v-slot:prepend>
                <v-icon color="primary" size="20">mdi-printer</v-icon>
              </template>
              <v-list-item-title>{{ __('Print Last Invoice') }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="syncPendingInvoices" class="menu-item-enhanced">
              <template v-slot:prepend>
                <v-icon color="primary" size="20">mdi-sync</v-icon>
              </template>
              <v-list-item-title>{{ __('Sync Offline Invoices') }}</v-list-item-title>
            </v-list-item>
            <v-divider />
            <v-list-item @click="logOut" class="menu-item-enhanced logout-item">
              <template v-slot:prepend>
                <v-icon color="error" size="20">mdi-logout</v-icon>
              </template>
              <v-list-item-title>{{ __('Logout') }}</v-list-item-title>
            </v-list-item>
            <v-list-item @click="goAbout" class="menu-item-enhanced">
              <template v-slot:prepend>
                <v-icon color="info" size="20">mdi-information-outline</v-icon>
              </template>
              <v-list-item-title>{{ __('About') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <!-- This drawer slides out from the left, providing additional navigation options.
         It can be in a mini-variant (collapsed) or expanded state. -->
    <v-navigation-drawer app v-model="drawer" :mini-variant="mini" expand-on-hover width="220" class="drawer-custom"
      @mouseleave="handleMouseLeave">
      <div v-if="!mini" class="drawer-header">
        <v-avatar size="40"><v-img :src="companyImg" alt="Company logo" /></v-avatar>
        <span class="drawer-company">{{ company }}</span>
        <v-btn icon @click.stop="mini = true"><v-icon>mdi-chevron-left</v-icon></v-btn>
      </div>
      <div v-else class="drawer-header-mini">
        <v-avatar size="40"><v-img :src="companyImg" alt="Company logo" /></v-avatar>
      </div>

      <v-divider />

      <v-list dense nav>
        <v-list-item-group v-model="item" active-class="active-item">
          <v-list-item v-for="i in items" :key="i.text" @click="changePage(i.text)" class="drawer-item">
            <v-list-item-icon><v-icon class="drawer-icon">{{ i.icon }}</v-icon></v-list-item-icon>
            <v-list-item-content v-if="!mini">
              <v-list-item-title class="drawer-item-title">{{ i.text }}</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-navigation-drawer>

    <v-snackbar v-model="snack" :timeout="5000" :color="snackColor" location="top right">
      {{ snackText }}
    </v-snackbar>

    <v-dialog v-model="freeze" persistent max-width="290">
      <v-card>
        <v-card-title class="text-h5">{{ freezeTitle }}</v-card-title>
        <v-card-text>{{ freezeMsg }}</v-card-text>
      </v-card>
    </v-dialog>
  </nav>
</template>

<script>
// Import the Socket.IO client library for real-time server status monitoring.
// This import is crucial for the server connectivity indicator.
import { io } from 'socket.io-client';
import { getPendingOfflineInvoiceCount, syncOfflineInvoices, isOffline, getLastSyncTotals } from '../../offline.js';

export default {
  name: 'NavBar', // Component name
  data() {
    return {
      drawer: false, // Controls the visibility of the side navigation drawer (true for open, false for closed)
      mini: true, // Controls the mini-variant (collapsed) state of the drawer (true for collapsed, false for expanded)
      item: 0, // Index of the currently selected item in the drawer list, used for active styling
      items: [{ text: 'POS', icon: 'mdi-network-pos' }], // Array of navigation items for the drawer. Each item has text and a Material Design Icon.
      company: 'POS Awesome', // Default company name, used if not fetched from Frappe boot data
      companyImg: '/assets/erpnext/images/erpnext-logo.svg', // Default path to the company logo image
      posProfile: {}, // Object to store the current POS profile data, fetched from the backend
      lastInvoiceId: null, // Stores the ID of the last generated sales invoice, used for re-printing
      snack: false, // Controls the visibility of the snackbar (true for visible, false for hidden)
      snackColor: '', // Color of the snackbar (e.g., 'success', 'error', 'info')
      snackText: '', // Text content displayed within the snackbar
      freeze: false, // Controls the visibility of the freeze dialog (true for visible, false for hidden)
      freezeTitle: '', // Title text for the freeze dialog
      freezeMsg: '', // Message text for the freeze dialog
      // --- PENDING OFFLINE INVOICES ---
      pendingInvoices: 0, // Number of invoices saved locally while offline
      syncTotals: getLastSyncTotals(),
      // --- SIGNAL INDICATOR STATES ---
      networkOnline: navigator.onLine, // Boolean: Reflects the browser's current network connectivity (true if online, false if offline)
      serverOnline: false,             // Boolean: Reflects the real-time server health via WebSocket (true if connected, false if disconnected)
      serverConnecting: false,         // Boolean: Indicates if the client is currently attempting to establish a connection to the server via WebSocket
      socket: null,                    // Instance of the Socket.IO client, used for real-time communication with the server
      offlineMessageShown: false       // Flag to avoid repeating offline warnings
    };
  },
  computed: {
    /**
     * Determines the color of the status icon based on current network and server connectivity.
     * @returns {string} A Vuetify color string ('green', 'red').
     */
    statusColor() {
      // Simplified: Green when connected to server, Red when offline
      if (this.networkOnline && this.serverOnline) return 'green'; // Green when connected to server
      return 'red'; // Red for any offline state (no internet or server offline)
    },
    /**
     * Determines the Material Design Icon to display based on network and server status.
     * @returns {string} A Material Design Icon class string.
     */
    statusIcon() {
      // Note: 'mdi-loading' is conceptually here, but `v-progress-circular` handles the visual loading state.
      if (this.networkOnline && this.serverOnline) return 'mdi-wifi'; // Wi-Fi icon when connected to server
      if (this.networkOnline && !this.serverOnline) return 'mdi-wifi-strength-alert-outline'; // Wi-Fi with alert for server offline
      return 'mdi-wifi-off'; // Wi-Fi off icon when no internet connection
    },
    /**
     * Provides a descriptive text for the tooltip that appears when hovering over the status icon.
     * This text is also used for the `title` attribute of the button.
     * @returns {string} A localized status message.
     */
    statusText() {
      if (this.serverConnecting) return this.__('Connecting to server...'); // Message when connecting
      if (!this.networkOnline) return this.__('No Internet Connection'); // Message when no internet
      return this.serverOnline ? this.__('Connected to Server') : this.__('Server Offline'); // Messages for server status
    },
    /**
     * Returns a short string summarizing the last offline invoice sync results.
     */
    syncInfoText() {
      const { pending, synced, drafted } = this.syncTotals;

      // Ensure we have valid numbers
      const pendingCount = pending || 0;
      const syncedCount = synced || 0;
      const draftedCount = drafted || 0;

      if (!this.networkOnline) {
        // In offline mode, show all available information
        if (pendingCount > 0 || syncedCount > 0 || draftedCount > 0) {
          return `Pending: ${pendingCount} | Synced: ${syncedCount} | Draft: ${draftedCount}`;
        } else {
          return 'Offline Mode';
        }
      }

      // Online mode - show full status
      return `To Sync: ${pendingCount} | Synced: ${syncedCount} | Draft: ${draftedCount}`;
    }
  },
  created() {
    // --- LOAD COMPANY INFO FROM FRAPPE BOOT ---
    // Attempts to get the company name from Frappe's boot data.
    const bootCompany = frappe?.boot?.user_info?.company;
    this.company = bootCompany || this.company; // Use boot company or default 'POS Awesome'
    console.log('Fetched company:', this.company);
    window.serverOnline = this.serverOnline;

    // If a specific company name is found (not the default), fetch its logo from Frappe.
    if (this.company !== 'POS Awesome') {
      frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Company', name: this.company },
        callback: r => {
          if (r.message?.company_logo) this.companyImg = r.message.company_logo;
        },
        error: err => console.warn('Company lookup failed', err)
      });
    }

    // --- EVENT BUS HANDLERS FOR POS INFO/STATE ---
    // Register event listeners on the global event bus. These listeners react to events
    // emitted from other parts of the application to update the NavBar's state.
    this.$nextTick(() => {
      // Initialize pending invoices count
      this.updatePendingInvoices();

      // Initialize sync totals from localStorage
      this.syncTotals = getLastSyncTotals();

      // Only sync if online
      if (this.networkOnline) {
        this.syncPendingInvoices();
      }

      // Listen for changes in pending invoices from other components
      this.eventBus.on('pending_invoices_changed', this.updatePendingInvoices);
      this.eventBus.on('show_message', this.showMessage); // Listens for requests to show a snackbar message
      this.eventBus.on('set_company', data => { // Listens for updates to company details (name, logo)
        this.company = data.name || this.company;
        this.companyImg = data.company_logo || this.companyImg;
      });
      this.eventBus.on('register_pos_profile', data => { // Listens for the POS profile data
        this.posProfile = data.pos_profile;
        const paymentsItem = { text: 'Payments', icon: 'mdi-cash-register' };
        // Conditionally adds a 'Payments' navigation item if allowed by the POS profile and not already present
        if (this.posProfile.posa_use_pos_awesome_payments && !this.items.some(i => i.text === 'Payments')) {
          this.items.push(paymentsItem);
        }
      });
      this.eventBus.on('set_last_invoice', data => { this.lastInvoiceId = data; }); // Listens for the ID of the last processed invoice
      this.eventBus.on('freeze', data => { // Listens for requests to display a freeze dialog (e.g., during long operations)
        this.freeze = true;
        this.freezeTitle = data.title;
        this.freezeMsg = data.msg;
      });
      this.eventBus.on('unfreeze', () => { // Listens for requests to hide the freeze dialog
        this.freeze = false;
        this.freezeTitle = '';
        this.freezeMsg = '';
      });
    });
  },
  mounted() {
    // --- NETWORK ONLINE/OFFLINE EVENTS ---
    // Attach event listeners to the window object to detect changes in the browser's network status.
    window.addEventListener('online', this.handleOnline); // Fires when the browser regains network connectivity
    window.addEventListener('offline', this.handleOffline); // Fires when the browser loses network connectivity

    // --- SOCKET CONNECTION FOR SERVER STATUS ---
    // Initiates the WebSocket connection to monitor server health.
    this.initSocketConnection();
  },
  beforeDestroy() {
    // --- REMOVE NETWORK LISTENERS ---
    // Crucial cleanup: Remove event listeners from the window to prevent memory leaks
    // when the component is destroyed (e.g., navigating away from the page).
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    // Remove event bus listener for pending invoices
    this.eventBus.off('pending_invoices_changed', this.updatePendingInvoices);
    // --- CLOSE SOCKET ---
    // Disconnect and clean up Socket.IO listeners to ensure proper resource management.
    if (this.socket) {
      this.socket.off('connect'); // Remove 'connect' listener
      this.socket.off('disconnect'); // Remove 'disconnect' listener
      this.socket.off('connect_error'); // Remove 'connect_error' listener
      this.socket.close(); // Close the Socket.IO connection
      this.socket = null; // Clear the socket instance to prevent stale references
    }
  },
  methods: {

    /**
     * Initializes a Socket.IO connection, adapting the URL based on the environment:
     * - Development: localhost / 127.0.0.1
     * - Production: domain names (not IP addresses)
     * - Fallback: IP addresses (e.g., 192.168.x.x), default to port 9000
     */

    initSocketConnection() {
      this.serverConnecting = true;
      this.serverOnline = false;

      try {
        const { protocol, hostname: host, port: currentPort } = window.location;

        /**
         * Checks if the host is a local development address.
         */
        const isLocalhost = () => ['localhost', '127.0.0.1'].includes(host);

        /**
         * Checks if the host is a valid IPv4 address.
         */
        const isIpAddress = (hostname) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);

        /**
         * Determine the environment:
         * - Development: localhost or 127.0.0.1
         * - Production: not an IP address
         * - Fallback: IP address (not localhost)
         */
        const isDevelopment = isLocalhost();
        const isProduction = !isDevelopment && !isIpAddress(host);
        const isFallback = !isDevelopment && isIpAddress(host);

        /**
         * Returns the appropriate Socket.IO URL based on environment.
         */
        const getSocketUrl = () => {
          if (isProduction) {
            // Production: use current port or default for protocol
            const port = currentPort || (protocol === 'https:' ? '443' : '80');
            const url = `${protocol}//${host}:${port}`;
            console.log('Production environment detected, using:', url);
            return url;
          }

          if (isDevelopment) {
            // Development: use dev socket port (9000 or Frappe-configured)
            const socketPort = window.frappe?.boot?.socketio_port || '9000';
            const url = `${protocol}//${host}:${socketPort}`;
            console.log('Development environment detected, using:', url);
            return url;
          }

          if (isFallback) {
            // Fallback: IP addresses (e.g., 192.168.x.x), default to port 9000
            const fallbackUrl = `${protocol}//${host}:9000`;
            console.log('IP-based host detected, using fallback:', fallbackUrl);
            return fallbackUrl;
          }

          // As a final fallback, use port 9000
          const defaultFallbackUrl = `${protocol}//${host}:9000`;
          console.log('Unknown environment, using fallback:', defaultFallbackUrl);
          return defaultFallbackUrl;
        };

        // Create the Socket.IO client with connection options
        this.socket = io(getSocketUrl(), {
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          forceNew: true
        });

        /**
         * Event: Successfully connected
         */
        this.socket.on('connect', () => {
          this.serverOnline = true;
          window.serverOnline = true;
          this.serverConnecting = false;
          this.offlineMessageShown = false; // reset offline warning flag
          console.log('Socket.IO: Connected to server');
          this.eventBus.emit('server-online');
        });

        /**
         * Event: Disconnected from server
         */
        this.socket.on('disconnect', (reason) => {
          this.serverOnline = false;
          window.serverOnline = false;
          this.serverConnecting = false;
          console.warn('Socket.IO: Disconnected from server. Reason:', reason);

          this.eventBus.emit('server-offline');

          if (!this.offlineMessageShown) {
            this.showMessage({
              color: 'error',
              title: this.__('Server connection lost. Please check your internet connection.')
            });
            this.offlineMessageShown = true;
          }
        });

        /**
         * Event: Connection error
         */
        this.socket.on('connect_error', (error) => {
          this.serverOnline = false;
          window.serverOnline = false;
          this.serverConnecting = false;
          console.error('Socket.IO: Connection error:', error.message);
          this.eventBus.emit('server-offline');

          if (!this.offlineMessageShown) {
            this.showMessage({
              color: 'error',
              title: this.__('Unable to connect to server. Please try again later.')
            });
            this.offlineMessageShown = true;
          }
        });
      } catch (err) {
        this.serverOnline = false;
        window.serverOnline = false;
        this.serverConnecting = false;
        console.error('Failed to initialize Socket.IO connection:', err);

        this.showMessage({
          color: 'error',
          title: this.__('Failed to initialize server connection.')
        });
      }
    },

    // --- SIGNAL ONLINE/OFFLINE EVENTS ---
    /**
     * Handles the browser's native 'online' event.
     * When the browser regains network connectivity, it updates the `networkOnline` status
     * and attempts to reconnect to the server if not already connected.
     */
    handleOnline() {
      this.networkOnline = true; // Browser is now online
      console.log('Browser is online');
      this.offlineMessageShown = false; // allow future offline warnings
      this.eventBus.emit('network-online');
      this.syncPendingInvoices();
      window.serverOnline = this.serverOnline;
      // If the server is not online and not currently connecting, and a socket instance exists,
      // explicitly try to connect the socket. This helps in re-establishing server connection
      // immediately after internet recovery.
      if (!this.serverOnline && !this.serverConnecting && this.socket) {
        this.socket.connect();
      } else if (!this.socket) {
        // If for some reason the socket instance is null, re-initialize it.
        this.initSocketConnection();
      }
    },
    /**
     * Handles the browser's native 'offline' event.
     * When the browser loses network connectivity, it updates all relevant status flags
     * and disconnects the Socket.IO connection as the server will be unreachable.
     */
    handleOffline() {
      this.networkOnline = false; // Browser is now offline
      this.serverOnline = false; // Server is considered unreachable if there's no internet
      window.serverOnline = false;
      this.serverConnecting = false; // Stop any ongoing connection attempts
      console.log('Browser is offline');
      this.eventBus.emit('network-offline');
      // Disconnect the socket gracefully if the network goes offline.
      if (this.socket) {
        this.socket.disconnect();
      }
    },
    // --- NAVIGATION AND POS ACTIONS ---
    /**
     * Toggles the visibility and mini-variant state of the side navigation drawer.
     */
    handleNavClick() {
      this.drawer = true; // Open the drawer
      this.mini = false; // Ensure it's in expanded mode
    },
    /**
     * Handles the mouse leaving the navigation drawer area.
     * If the drawer is open, it sets a timeout to collapse it back to mini-variant.
     */
    handleMouseLeave() {
      if (!this.drawer) return; // Do nothing if the drawer is already closed
      clearTimeout(this._closeTimeout); // Clear any previous timeout to prevent conflicts
      this._closeTimeout = setTimeout(() => {
        this.drawer = false; // Close the drawer
        this.mini = true; // Set it to mini-variant
      }, 250); // Delay for 250 milliseconds
    },
    /**
     * Emits a 'changePage' event to the parent component, signaling a request to navigate to a new page.
     * @param {string} key - The identifier for the page to navigate to (e.g., 'POS', 'Payments').
     */
    changePage(key) {
      this.$emit('changePage', key);
    },
    /**
     * Navigates the user back to the main Frappe desk view and reloads the page.
     */
    goDesk() {
      frappe.set_route('/'); // Set Frappe route to home
      location.reload(); // Reload the entire page
    },
    /**
     * Emits an 'open_closing_dialog' event to the event bus, typically to trigger
     * the display of a dialog for closing the POS shift.
     */
    openCloseShift() {
      this.eventBus.emit('open_closing_dialog');
    },
    /**
     * Prints the last generated sales invoice.
     * It constructs a print URL using the invoice ID and POS profile settings,
     * then opens it in a new window and triggers the print command.
     */
    printLastInvoice() {
      if (!this.lastInvoiceId) return; // Exit if no invoice ID is available
      // Determine the print format to use
      const pf = this.posProfile.print_format_for_online || this.posProfile.print_format;
      // Determine if letterhead should be excluded
      const noLetterHead = this.posProfile.letter_head || 0;
      // Construct the full print URL for the Sales Invoice
      const url = `${frappe.urllib.get_base_url()}/printview?doctype=Sales%20Invoice&name=${this.lastInvoiceId}` +
        `&trigger_print=1&format=${pf}&no_letterhead=${noLetterHead}`;
      const win = window.open(url, '_blank'); // Open the URL in a new browser tab/window
      // Add a one-time event listener to the new window to trigger print once it's loaded
      win.addEventListener('load', () => win.print(), { once: true });
    },
    /**
     * Fetches and displays information about all installed applications from the Frappe backend.
     * It presents this information in a formatted table within a Frappe message dialog.
     */
    goAbout() {
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_app_info', // API method to call
        callback: r => {
          if (Array.isArray(r.message.apps)) {
            // Build an HTML table string dynamically from the fetched app data
            let html = `
              <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                  <tr><th style="padding:8px;">${__('Application')}</th>
                      <th style="padding:8px;">${__('Version')}</th></tr>
                </thead><tbody>
            `;
            r.message.apps.forEach(app => {
              html += `
                <tr>
                  <td style="padding:8px;"><strong>${app.app_name}</strong></td>
                  <td style="padding:8px;">${app.installed_version}</td>
                </tr>
              `;
            });
            html += `</tbody></table>`;

            // Display the generated HTML table in a Frappe message print dialog
            frappe.msgprint({
              title: __('Installed Applications'),
              indicator: 'blue', // Blue indicator for informational message
              message: html
            });
          }
        },
        error: () => frappe.msgprint({ // Error callback if API call fails
          title: __('Error'),
          indicator: 'red', // Red indicator for error message
          message: __('Failed to retrieve app info')
        })
      });
    },
    /**
     * Logs out the current user from the Frappe system.
     * Upon successful logout, it redirects the user to the Frappe home page and reloads.
     */
    logOut() {
      frappe.call({
        method: 'logout', // Frappe API method for logout
        callback: r => {
          if (!r.exc) { // If no exception occurred during logout
            frappe.set_route('/app/home'); // Set route to home
            location.reload(); // Reload the page to complete logout process
          }
        }
      });
    },

    async syncPendingInvoices() {
      const pending = getPendingOfflineInvoiceCount();
      if (pending) {
        this.showMessage({
          title: `${pending} invoice${pending > 1 ? 's' : ''} pending for sync`,
          color: 'warning'
        });
      }
      const result = await syncOfflineInvoices();
      if (result && (result.synced || result.drafted)) {
        if (result.synced) {
          this.showMessage({
            title: `${result.synced} offline invoice${result.synced > 1 ? 's' : ''} synced`,
            color: 'success'
          });
        }
        if (result.drafted) {
          this.showMessage({
            title: `${result.drafted} offline invoice${result.drafted > 1 ? 's' : ''} saved as draft`,
            color: 'warning'
          });
        }
      }
      if (result) {
        this.syncTotals = { ...result };
      }
      this.updatePendingInvoices();
      this.eventBus.emit('pending_invoices_changed', this.pendingInvoices);
    },
    /**
     * Reads the current number of invoices stored offline and updates the badge
     * counter in the navigation bar.
     */
    updatePendingInvoices() {
      this.pendingInvoices = getPendingOfflineInvoiceCount();
    },
    /**
     * Displays a snackbar message at the top right of the screen.
     * @param {object} data - An object containing `color` (for snackbar styling) and `title` (the message text).
     */
    showMessage(data) {
      this.snack = true; // Make snackbar visible
      this.snackColor = data.color; // Set snackbar color
      this.snackText = data.title; // Set snackbar text
    },
    /**
     * A dummy translation method. In a real Frappe environment, `frappe.__` or `window.__`
     * would be used for proper internationalization. This is a placeholder for demonstration.
     * @param {string} text - The text string to be translated.
     * @returns {string} The original text (as this is a dummy implementation).
     */
    __(text) {
      // In a real Frappe environment, you would use frappe.__ or window.__
      // For this example, we'll return the text as is.
      return text;
    }
  }
};
</script>

<style scoped>
/* --- App Bar and Drawer Styling --- */
/* Styles related to the main application bar and the side navigation drawer. */

/* Adds a subtle bottom border to the app bar for visual separation. */
.border-bottom {
  border-bottom: 1px solid #e0e0e0;
}

/* Sets a secondary text color, typically a lighter shade of black. */
.text-secondary {
  color: rgba(0, 0, 0, 0.6) !important;
}

/* Custom styling for the navigation drawer, including background and transition effects. */
.drawer-custom {
  background-color: #fafafa;
  transition: all 0.3s ease-out;
}

/* Styling for the header section of the expanded navigation drawer. */
.drawer-header {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 16px;
}

/* Styling for the header section of the mini (collapsed) navigation drawer. */
.drawer-header-mini {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 64px;
}

/* Styling for the company name text within the drawer header. */
.drawer-company {
  margin-left: 12px;
  flex: 1;
  font-weight: 500;
  font-size: 1rem;
  color: #424242;
}

/* Styling for icons within the navigation drawer list items. */
.drawer-icon {
  font-size: 24px;
  color: #1976d2;
}

/* Styling for the title text of navigation drawer list items. */
.drawer-item-title {
  margin-left: 8px;
  font-weight: 500;
  color: #424242;
}

/* Hover effect for all list items in the navigation drawer. */
.v-list-item:hover {
  background-color: rgba(25, 118, 210, 0.1) !important;
}

/* Styling for the actively selected list item in the navigation drawer. */
.active-item {
  background-color: rgba(25, 118, 210, 0.2) !important;
}

/* --- User Menu Styling --- */
/* Styles specific to the user actions dropdown menu. */

/* Styling for the main "Menu" button that activates the dropdown. */
.user-menu-btn {
  text-transform: none;
  padding: 4px 12px;
  font-weight: 500;
}

/* Styling for the card that contains the dropdown menu list. */
.user-menu-card {
  border-radius: 8px;
  overflow: hidden;
}

/* Padding for the list within the user menu card. */
.user-menu-list {
  padding-top: 8px;
  padding-bottom: 8px;
}

/* Padding for individual list items within the user menu. */
.user-menu-item {
  padding: 10px 16px;
}

/* Minimum width for icons within user menu list items to ensure alignment. */
.user-menu-item .v-list-item-icon {
  min-width: 36px;
}

/* Margin for dividers within the user menu list. */
.user-menu-card .v-divider {
  margin: 8px 0;
}

/* --- Status Indicator Styling --- */
.status-btn {
  transition: all 0.3s ease;
}

.status-btn:hover {
  transform: scale(1.1);
}

.status-tooltip {
  padding: 4px 0;
  text-align: center;
}

.status-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.status-detail {
  font-size: 0.8rem;
  opacity: 0.9;
}

.status-warning {
  font-size: 0.8rem;
  color: #ff9800;
  margin-top: 4px;
}

/* --- Sync Info Styling --- */
.sync-chip {
  cursor: pointer;
  transition: all 0.3s ease;
}

.sync-chip:hover {
  transform: scale(1.05);
}

.sync-text {
  font-size: 0.75rem;
  white-space: nowrap;
}

/* Enhanced Navbar Styling */
.navbar-enhanced {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border-bottom: 2px solid #e3f2fd !important;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.navbar-enhanced:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
}

/* Logo and Brand Styling */
.logo-container {
  margin: 0 12px;
  padding: 4px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1976d2, #42a5f5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-img {
  filter: brightness(0) invert(1);
  transition: transform 0.3s ease;
}

.logo-container:hover .logo-img {
  transform: scale(1.1);
}

.brand-title {
  font-size: 1.5rem !important;
  font-weight: 700 !important;
  background: linear-gradient(135deg, #1976d2, #42a5f5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: all 0.3s ease;
}

.brand-title:hover {
  transform: scale(1.05);
}

.brand-pos {
  font-weight: 300;
}

.brand-awesome {
  font-weight: 800;
}

/* Navigation Icon */
.nav-icon {
  border-radius: 12px;
  padding: 8px;
  transition: all 0.3s ease;
}

.nav-icon:hover {
  background-color: rgba(25, 118, 210, 0.1);
  transform: scale(1.1);
}

/* Profile Section */
.profile-section {
  margin: 0 16px;
}

.profile-chip {
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.profile-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
}

/* Enhanced Status Section */
.status-section-enhanced {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 16px;
}

.status-btn-enhanced {
  background: rgba(25, 118, 210, 0.1) !important;
  border: 1px solid rgba(25, 118, 210, 0.3);
  transition: all 0.3s ease;
}

.status-btn-enhanced:hover {
  background: rgba(25, 118, 210, 0.2) !important;
  transform: scale(1.05);
}

.status-info-always-visible {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 120px;
}

.status-title-inline {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  transition: color 0.3s ease;
}

.status-title-inline.status-connected {
  color: #4caf50;
  /* Green when connected */
}

.status-title-inline.status-offline {
  color: #f44336;
  /* Red when offline */
}

.status-detail-inline {
  font-size: 11px;
  color: #666;
  line-height: 1.2;
  margin-top: 2px;
}

/* Enhanced Menu Button */
.menu-btn-enhanced {
  margin-left: 12px;
  padding: 8px 20px;
  border-radius: 20px;
  font-weight: 600;
  text-transform: none;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
  transition: all 0.3s ease;
}

.menu-btn-enhanced:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(25, 118, 210, 0.4);
}

/* Enhanced Menu Card */
.menu-card-enhanced {
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid rgba(25, 118, 210, 0.1);
}

.menu-list-enhanced {
  padding: 8px;
}

.menu-item-enhanced {
  border-radius: 12px;
  margin: 4px 0;
  padding: 12px 16px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.menu-item-enhanced:hover {
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.1), rgba(66, 165, 245, 0.1));
  transform: translateX(4px);
}

.menu-item-enhanced.logout-item:hover {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(255, 82, 82, 0.1));
}

.menu-item-enhanced .v-list-item-title {
  font-weight: 500;
}

/* Responsive Design */
@media (max-width: 768px) {
  .brand-title {
    font-size: 1.2rem !important;
  }

  .profile-section {
    margin: 0 8px;
  }

  .profile-chip {
    padding: 6px 12px;
  }

  .menu-btn-enhanced {
    padding: 6px 16px;
  }

  .status-info-always-visible {
    display: none;
  }

  .status-section-enhanced {
    margin-right: 8px;
  }
}

@media (max-width: 480px) {
  .logo-container {
    margin: 0 8px;
  }

  .brand-title {
    font-size: 1rem !important;
  }
}
</style>
