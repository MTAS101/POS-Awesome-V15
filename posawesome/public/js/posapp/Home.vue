<template>
  <v-app :class="['container1', { 'dark-mode': darkMode }]">
    <v-main>
      <Navbar :dark-mode="darkMode" @toggle-dark-mode="toggleDarkMode" @changePage="setPage($event)" />
      <component v-bind:is="page" :dark-mode="darkMode" class="mx-4 md-4"></component>
    </v-main>
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
      darkMode: localStorage.getItem('posa_dark_mode') === 'true',
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
    toggleDarkMode() {
      this.darkMode = !this.darkMode;
      localStorage.setItem('posa_dark_mode', this.darkMode);
      if (this.$vuetify && this.$vuetify.theme && this.$vuetify.theme.global) {
        this.$vuetify.theme.global.name.value = this.darkMode ? 'dark' : 'light';
      }
    },
    remove_frappe_nav() {
      this.$nextTick(function () {
        $('.page-head').remove();
        $('.navbar.navbar-default.navbar-fixed-top').remove();
      });
    },
  },
  mounted() {
    this.remove_frappe_nav();
    if (this.$vuetify && this.$vuetify.theme && this.$vuetify.theme.global) {
      this.$vuetify.theme.global.name.value = this.darkMode ? 'dark' : 'light';
    }
  },
  updated() { },
  created: function () {
    setTimeout(() => {
      this.remove_frappe_nav();
    }, 1000);
  },
};
</script>

<style scoped>
.container1 {
  margin-top: 0px;
}
.dark-mode {
  background-color: #000;
  color: #fff;
}

.dark-mode .text-primary {
  color: #1976d2 !important;
}
</style>
