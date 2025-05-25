<template>
  <v-app>
    <v-main>
      <Navbar @changePage="setPage($event)"></Navbar>
      <component v-bind:is="page" class="mx-4 md-4"></component>
    </v-main>
    
    <!-- PWA Components -->
    <update-notification />
    <connectivity-status />
  </v-app>
</template>

<script>
import Navbar from './components/Navbar.vue';
import POS from './components/pos/Pos.vue';
import Payments from './components/payments/Pay.vue';

export default {
  data: function () {
    return {
      page: 'POS',
    };
  },
  components: {
    Navbar,
    POS,
    Payments,
  },
  methods: {
    setPage(page) {
      this.page = page;
    },
    remove_frappe_nav() {
      this.$nextTick(function () {
        $('.page-head').remove();
        $('.navbar.navbar-default.navbar-fixed-top').remove();
      });
    },
    handleConnectivityChange(isOnline) {
      if (isOnline) {
        console.log('Connection restored - online mode');
        this.syncPendingInvoices();
      } else {
        console.log('Connection lost - offline mode');
        frappe.show_alert({
          message: __('You are now offline. Your changes will be saved locally.'),
          indicator: 'orange'
        });
      }
    },
    async syncPendingInvoices() {
      try {
        const { processPendingInvoices } = await import('./offline_db');
        await processPendingInvoices();
      } catch (error) {
        console.error('Error syncing pending invoices:', error);
      }
    },
  },
  mounted() {
    this.remove_frappe_nav();
    window.addEventListener('online', () => this.handleConnectivityChange(true));
    window.addEventListener('offline', () => this.handleConnectivityChange(false));
  },
  updated() { },
  created: function () {
    setTimeout(() => {
      this.remove_frappe_nav();
    }, 1000);
  },
  beforeUnmount() {
    window.removeEventListener('online', () => this.handleConnectivityChange(true));
    window.removeEventListener('offline', () => this.handleConnectivityChange(false));
  },
};
</script>

<style scoped>
.container1 {
  margin-top: 0px;
}
</style>
