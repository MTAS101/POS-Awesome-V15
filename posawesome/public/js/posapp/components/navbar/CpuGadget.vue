<template>
  <div class="cpu-gadget-section mx-1">
    <v-tooltip location="bottom">
      <template #activator="{ props }">
        <div v-bind="props" class="cpu-meter-container">
          <v-progress-circular
            :model-value="cpuPercent"
            :color="cpuColor"
            :size="32"
            :width="3"
            class="cpu-meter"
          >
            <v-icon size="16">mdi-chip</v-icon>
          </v-progress-circular>
        </div>
      </template>
      <div class="cpu-tooltip-content">
        <div class="cpu-tooltip-title">{{ __("CPU Load") }}</div>
        <div class="cpu-tooltip-bar mb-2">
          <div class="cpu-bar-bg">
            <div class="cpu-bar-fill" :style="{ width: cpuPercent + '%' }"></div>
          </div>
          <span class="cpu-bar-label">{{ cpuPercent }}%</span>
        </div>
        <div class="cpu-tooltip-detail">
          {{ __("Event Loop Lag:") }} <b>{{ cpuLag.toFixed(1) }}</b> ms
        </div>
        <div v-if="cpuLag >= 80" class="cpu-tooltip-warning">
          <v-icon size="14" color="error" class="mr-1">mdi-alert</v-icon>
          {{ __("Warning: High lag may indicate heavy processing or browser slowness.") }}
        </div>
        <div class="cpu-tooltip-tip mt-2">
          <v-icon size="14" color="primary" class="mr-1">mdi-lightbulb-on-outline</v-icon>
          {{ __("Tip: Close unused tabs or apps to reduce lag.") }}
        </div>
        <div class="cpu-tooltip-explanation mt-2">
          <v-icon size="14" color="info" class="mr-1">mdi-chip"</v-icon>
          {{ __("Event-loop lag measures how busy your browser is. Lower is better.") }}
        </div>
        <div class="cpu-tooltip-action mt-2">
          <v-icon size="14" class="mr-1">mdi-refresh</v-icon>
          {{ __("Updates automatically") }}
        </div>
      </div>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { useCpuLoad } from "../../composables/useCpuLoad";

const { cpuLag } = useCpuLoad();

// i18n translation function (Vuetify/Frappe style)
const __ = inject("__", (txt: string) => txt);

// Convert lag to a percentage for the progress circle (0-100ms = 0-100%)
const cpuPercent = computed(() => Math.min(100, Math.round(cpuLag.value)));

const cpuColor = computed(() => {
  if (cpuLag.value < 40) return "success";
  if (cpuLag.value < 80) return "warning";
  return "error";
});
</script>

<style scoped>
.cpu-gadget-section {
  display: flex;
  align-items: center;
  margin: 0 8px;
}

.cpu-meter-container {
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.cpu-meter-container:hover {
  transform: scale(1.1);
}

.cpu-meter {
  transition: all 0.3s ease;
}

.cpu-tooltip-content {
  @apply p-3 min-w-[180px];
}

.cpu-tooltip-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--primary);
}

.cpu-tooltip-detail {
  font-size: 12px;
  margin-bottom: 8px;
  line-height: 1.5;
}

.cpu-tooltip-action {
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  align-items: center;
  margin-top: 8px;
  color: var(--primary);
}

.cpu-tooltip-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.cpu-bar-bg {
  width: 80px;
  height: 8px;
  background: #e3f2fd;
  border-radius: 4px;
  overflow: hidden;
  margin-right: 6px;
}
.cpu-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #7b1fa2 0%, #42a5f5 100%);
  border-radius: 4px;
  transition: width 0.3s;
}
.cpu-bar-label {
  font-size: 11px;
  color: #7b1fa2;
  font-weight: 600;
}
.cpu-tooltip-warning {
  color: #d32f2f;
  font-size: 12px;
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}
.cpu-tooltip-tip {
  color: #1976d2;
  font-size: 12px;
  display: flex;
  align-items: center;
}
.cpu-tooltip-explanation {
  color: #0288d1;
  font-size: 12px;
  display: flex;
  align-items: center;
}

/* Fix tooltip background and text color in light mode */
:deep(.v-tooltip .v-overlay__content),
:deep(.v-overlay__content) {
  background: #e3f2fd !important;
  color: #1a237e !important;
  box-shadow: 0 4px 16px rgba(25, 118, 210, 0.10) !important;
  border: 1px solid #90caf9 !important;
}

.cpu-tooltip-title,
.cpu-tooltip-action {
  color: #1a237e !important;
}

:deep(.dark-theme) .v-tooltip .v-overlay__content,
:deep(.v-theme--dark) .v-tooltip .v-overlay__content,
:deep(.dark-theme) .v-overlay__content,
:deep(.v-theme--dark) .v-overlay__content {
  background: #26344d !important;
  color: #fff !important;
  border: 1px solid #1976d2 !important;
}

:deep(.dark-theme) .cpu-tooltip-title,
:deep(.v-theme--dark) .cpu-tooltip-title,
:deep(.dark-theme) .cpu-tooltip-action,
:deep(.v-theme--dark) .cpu-tooltip-action {
  color: #fff !important;
}
</style> 