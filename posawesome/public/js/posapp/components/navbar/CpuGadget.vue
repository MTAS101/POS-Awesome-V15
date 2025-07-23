<template>
  <div class="cpu-gadget-section mx-1">
    <v-tooltip location="bottom">
      <template #activator="{ props }">
        <div v-bind="props" class="cpu-meter-container">
          <v-icon size="22" color="success">mdi-chip</v-icon>
          <span class="cpu-current-lag">{{ cpuLag.toFixed(1) }} ms</span>
        </div>
      </template>
      <div class="cpu-tooltip-content">
        <div class="cpu-tooltip-title">{{ __("CPU Load") }}</div>
        <div class="cpu-tooltip-peak mb-1">
          <v-icon size="14" color="success" class="mr-1">mdi-arrow-up-bold</v-icon>
          {{ __("Peak:") }}
          <b>{{ peakLag.toFixed(1) }} ms</b>
          ({{ peakPercent }}%)
        </div>
        <div class="cpu-tooltip-sparkline mb-2">
          <svg :width="180" :height="40" class="cpu-sparkline-large">
            <defs>
              <linearGradient id="cpuAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#4caf50" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#4caf50" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <polyline
              :points="sparklinePointsLarge"
              fill="none"
              stroke="#4caf50"
              stroke-width="2"
            />
            <polygon
              :points="areaPointsLarge"
              fill="url(#cpuAreaGradient)"
              stroke="none"
            />
          </svg>
        </div>
        <div class="cpu-tooltip-detail">
          {{ __("Current Event Loop Lag:") }} <b>{{ cpuLag.toFixed(1) }}</b> ms
        </div>
        <div v-if="cpuLag >= 80" class="cpu-tooltip-warning">
          <v-icon size="14" color="error" class="mr-1">mdi-alert</v-icon>
          {{ __("Warning: High lag may indicate heavy processing or browser slowness.") }}
        </div>
        <div v-if="serverLoading" class="cpu-tooltip-detail">{{ __("Loading server CPU usage...") }}</div>
        <div v-else-if="serverError" class="cpu-tooltip-warning">{{ serverError }}</div>
        <div v-else class="cpu-tooltip-detail">
          {{ __("Server CPU Usage:") }} <b>{{ serverCpu !== null ? serverCpu.toFixed(1) + '%' : 'N/A' }}</b>
          <span class="ml-2">{{ __("Peak Server:") }} <b>{{ serverPeak.toFixed(1) }}%</b></span>
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
import { computed, inject, ref, onMounted, onUnmounted } from "vue";
import { useCpuLoad } from "../../composables/useCpuLoad";

const { cpuLag, history } = useCpuLoad(1000, 60);
const __ = inject("__", (txt: string) => txt);

// Server CPU usage integration
const serverCpu = ref<number | null>(null);
const serverPeak = ref<number>(0);
const serverLoading = ref(true);
const serverError = ref<string | null>(null);
let serverTimer: number | null = null;

async function fetchServerCpu() {
  serverLoading.value = true;
  serverError.value = null;
  try {
    const res = await fetch("/api/method/posawesome.posawesome.api.utilities.get_server_usage");
    const data = await res.json();
    if (data && data.message && typeof data.message.cpu_percent === 'number') {
      serverCpu.value = data.message.cpu_percent;
      if (typeof serverCpu.value === 'number' && serverCpu.value !== null && serverCpu.value > serverPeak.value) serverPeak.value = serverCpu.value;
    } else {
      serverError.value = "No data from server";
    }
  } catch (e) {
    serverError.value = (e as Error).message;
  } finally {
    serverLoading.value = false;
  }
}

onMounted(() => {
  fetchServerCpu();
  serverTimer = window.setInterval(fetchServerCpu, 10000);
});
onUnmounted(() => {
  if (serverTimer) clearInterval(serverTimer);
});

function getSparklinePoints(arr: number[], w: number, h: number) {
  if (!arr.length) return '';
  const max = Math.max(...arr, 100);
  const min = 0;
  const step = arr.length > 1 ? w / (arr.length - 1) : w;
  return arr
    .map((v, i) => `${i * step},${h - ((v - min) / (max - min || 1)) * h}`)
    .join(' ');
}

function getAreaPoints(arr: number[], w: number, h: number) {
  if (!arr.length) return '';
  const max = Math.max(...arr, 100);
  const min = 0;
  const step = arr.length > 1 ? w / (arr.length - 1) : w;
  let points = arr
    .map((v, i) => `${i * step},${h - ((v - min) / (max - min || 1)) * h}`)
    .join(' ');
  // Close the area polygon
  points += ` ${w},${h} 0,${h}`;
  return points;
}

const sparklinePointsLarge = computed(() => getSparklinePoints(history.value, 180, 40));
const areaPointsLarge = computed(() => getAreaPoints(history.value, 180, 40));

// Peak lag in ms and as a percentage (100ms = 100%)
const peakLag = computed(() => Math.max(...history.value, 0));
const peakPercent = computed(() => Math.round(Math.min(peakLag.value, 100)));
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

.cpu-sparkline-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cpu-sparkline {
  display: block;
  background: none;
}
.cpu-current-lag {
  font-size: 13px;
  font-weight: 600;
  color: #4caf50;
  min-width: 48px;
  text-align: right;
}
.cpu-tooltip-sparkline {
  width: 180px;
  height: 40px;
  margin-bottom: 8px;
}
.cpu-sparkline-large {
  display: block;
  background: none;
}

.cpu-tooltip-legend {
  font-size: 12px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
}
.legend-dot.client {
  background: #4caf50;
}
.legend-dot.server {
  background: #1976d2;
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