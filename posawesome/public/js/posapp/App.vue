<template>
  <v-app>
    <offline-sync />
  </v-app>
</template>

<script>
import OfflineSync from './components/pos/OfflineSync.vue';

export default {
  name: 'App',
  components: {
    OfflineSync,
  },
}
</script> 