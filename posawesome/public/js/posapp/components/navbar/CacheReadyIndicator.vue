<template>
  <div class="cache-ready-section mx-1">
    <v-tooltip location="bottom">
      <template #activator="{ props }">
        <div v-bind="props" class="cache-ready-icon">
          <v-progress-circular
            v-if="!cacheReady"
            indeterminate
            size="24"
            width="2"
            color="primary"
          />
          <v-icon v-else color="primary" size="24">mdi-check-circle</v-icon>
        </div>
      </template>
      <span>{{ cacheReady ? __("Offline cache ready") : __("Caching data...") }}</span>
    </v-tooltip>
  </div>
</template>

<script>
export default {
  name: "CacheReadyIndicator",
  props: {
    cacheReady: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<style scoped>
.cache-ready-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
