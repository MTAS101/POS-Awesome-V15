<template>
  <v-app>
    <v-main>
      <Navbar @changePage="setPage($event)"></Navbar>
      <component v-bind:is="page" class="mx-4 md-4"></component>
    </v-main>
    
    <!-- PWA Components -->
    <update-notification />
    <connectivity-status ref="connectivityStatus" />
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
    }
  },
  mounted() {
    this.remove_frappe_nav();
    
    // Listen for events that might require sync
    this.eventBus.on('sync_required', () => {
      // Delegate to connectivity status component
      if (this.$refs.connectivityStatus) {
        this.$refs.connectivityStatus.syncPendingOrders();
      }
    });
  },
  created: function () {
    setTimeout(() => {
      this.remove_frappe_nav();
    }, 1000);
  },
  beforeUnmount() {
    // Clean up event listeners
    this.eventBus.off('sync_required');
  },
};
</script>

<style scoped>
.container1 {
  margin-top: 0px;
}
</style>
