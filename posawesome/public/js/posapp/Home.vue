<template>
  <v-app>
    <v-main>
      <!-- Show Navbar only if bootstrap is complete -->
      <Navbar v-if="bootstrapComplete" @changePage="setPage($event)"></Navbar>
      
      <!-- Show offline data loader if bootstrap is not complete -->
      <offline-data-loader 
        v-if="!bootstrapComplete && pos_profile" 
        :pos_profile="pos_profile"
        @bootstrap-complete="onBootstrapComplete"
        @bootstrap-progress="onBootstrapProgress"
      />
      
      <!-- Show main component only if bootstrap is complete -->
      <component v-if="bootstrapComplete" v-bind:is="page" class="mx-4 md-4"></component>
      
      <!-- Show loading state while waiting for POS profile -->
      <v-container v-if="!bootstrapComplete && !pos_profile" class="fill-height">
        <v-row justify="center" align="center">
          <v-col cols="12" sm="8" md="6" lg="4" class="text-center">
            <v-progress-circular
              indeterminate
              size="64"
              color="primary"
              class="mb-4"
            ></v-progress-circular>
            <h2 class="text-h5">{{ __("Loading POS Profile...") }}</h2>
          </v-col>
        </v-row>
      </v-container>
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
import OfflineDataLoader from './components/OfflineDataLoader.vue';
import { isBootstrapComplete } from './offline_bootstrap';

export default {
  data: function () {
    return {
      page: 'POS',
      bootstrapComplete: false,
      bootstrapProgress: 0,
      pos_profile: null,
    };
  },
  components: {
    Navbar,
    POS,
    Payments,
    OfflineDataLoader,
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
    async getPosProfile() {
      try {
        // Get active POS profile for this user
        const response = await frappe.call({
          method: 'posawesome.posawesome.api.posapp.check_opening_shift',
          args: { user: frappe.session.user },
          async: false
        });
        
        if (response.message && response.message.pos_profile) {
          console.log('POS Profile loaded:', response.message.pos_profile.name);
          this.pos_profile = response.message.pos_profile;
          
          // If bootstrap is already complete, update flag
          if (isBootstrapComplete()) {
            this.bootstrapComplete = true;
          }
        } else {
          console.error('No active POS profile found');
          frappe.show_alert({
            message: __('No active POS profile found. Please open a POS session first.'),
            indicator: 'red'
          });
        }
      } catch (error) {
        console.error('Error getting POS profile:', error);
      }
    },
    onBootstrapComplete() {
      console.log('Bootstrap complete, enabling POS');
      this.bootstrapComplete = true;
    },
    onBootstrapProgress(progress) {
      this.bootstrapProgress = progress;
    }
  },
  mounted() {
    this.remove_frappe_nav();
    this.getPosProfile();
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
