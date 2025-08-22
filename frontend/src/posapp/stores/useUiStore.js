import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'light',
    drawer: false,
    dialogs: {},
    networkOnline: true,
    serverOnline: true,
    loading: false,
  }),
  getters: {
    isDark: (state) => state.theme === 'dark',
    isOnline: (state) => state.networkOnline && state.serverOnline,
  },
  actions: {
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
    },
    setDrawer(val) {
      this.drawer = val;
    },
    setDialog(name, val) {
      this.dialogs[name] = val;
    },
    updateNetwork({ network, server }) {
      if (typeof network !== 'undefined') this.networkOnline = network;
      if (typeof server !== 'undefined') this.serverOnline = server;
    },
    setLoading(val) {
      this.loading = val;
    },
  },
  persist: {
    paths: ['theme', 'networkOnline', 'serverOnline'],
  },
});
