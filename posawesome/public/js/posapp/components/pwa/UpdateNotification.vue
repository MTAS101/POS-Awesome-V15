<template>
  <v-snackbar
    v-model="showUpdateNotification"
    :timeout="-1"
    color="info"
    position="top"
    elevation="4"
  >
    {{ __("A new version is available") }}
    <template v-slot:actions>
      <v-btn
        color="white"
        variant="text"
        @click="refreshApp"
      >
        {{ __("UPDATE") }}
      </v-btn>
      <v-btn
        color="white"
        variant="text"
        @click="showUpdateNotification = false"
      >
        {{ __("DISMISS") }}
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script>
export default {
  data() {
    return {
      showUpdateNotification: false,
      waitingWorker: null,
      refreshing: false
    };
  },
  methods: {
    // Handle the new service worker ready event
    onUpdateReady(worker) {
      this.waitingWorker = worker;
      this.showUpdateNotification = true;
    },
    
    // Refresh the app to use the new service worker
    refreshApp() {
      this.refreshing = true;
      if (this.waitingWorker) {
        // Send message to service worker to skip waiting
        this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      } else {
        // Force refresh if no worker reference
        window.location.reload();
      }
    }
  },
  mounted() {
    // Register service worker update handler
    if ('serviceWorker' in navigator) {
      // Listen for controlling change events to refresh the page
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this.refreshing) return;
        this.refreshing = true;
        window.location.reload();
      });
      
      // Setup listeners for the service worker registration
      window.addEventListener('sw-updated', (event) => {
        const { worker } = event.detail;
        this.onUpdateReady(worker);
      });
      
      // Check for existing waiting worker on mount
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration?.waiting) {
          this.onUpdateReady(registration.waiting);
        }
      });
    }
  }
}
</script> 