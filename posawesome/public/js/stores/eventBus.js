import { defineStore } from 'pinia';
import mitt from 'mitt';

const emitter = mitt();

export const useEventBus = defineStore('eventBus', () => {
  const emit = (type, event) => emitter.emit(type, event);
  const on = (type, handler) => emitter.on(type, handler);
  const off = (type, handler) => emitter.off(type, handler);
  return { emit, on, off };
});
