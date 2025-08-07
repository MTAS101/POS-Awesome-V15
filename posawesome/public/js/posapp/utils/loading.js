import { reactive } from 'vue';

export const loadingState = reactive({
  active: false,
  progress: 0,
  sources: {},
});

export function initLoadingSources(list) {
  loadingState.sources = {};
  list.forEach((name) => {
    loadingState.sources[name] = 0;
  });
  loadingState.progress = 0;
  loadingState.active = true;
}

export function setSourceProgress(name, value) {
  if (!(name in loadingState.sources)) return;
  loadingState.sources[name] = value;
  const total = Object.keys(loadingState.sources).length;
  const sum = Object.values(loadingState.sources).reduce((a, b) => a + b, 0);
  loadingState.progress = Math.round(sum / total);
  if (loadingState.progress >= 100) {
    loadingState.progress = 100;
    setTimeout(() => {
      loadingState.active = false;
    }, 500);
  }
}

export function markSourceLoaded(name) {
  setSourceProgress(name, 100);
}
