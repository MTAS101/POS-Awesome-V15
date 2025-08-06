import { defineStore } from "pinia";

export const useNetworkStore = defineStore("network", {
	state: () => ({
		networkOnline: navigator.onLine || false,
		serverOnline: false,
		serverConnecting: false,
		manualOffline: false,
	}),
});
