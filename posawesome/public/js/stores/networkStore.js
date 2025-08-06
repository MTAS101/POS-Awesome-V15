import { defineStore } from "pinia";

export const useNetworkStore = defineStore("network", {
    state: () => ({
        networkOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
        serverOnline: false,
        serverConnecting: false,
        internetReachable: false,
    }),
    persist: {
        paths: ["networkOnline", "serverOnline"],
    },
});
