import { ref, computed, reactive } from "vue";
import { storeToRefs } from "pinia";
import { useNetworkStore } from "../../stores/networkStore.js";
import { useSettingsStore } from "../../stores/settingsStore.js";

export function useNavbar() {
	// State
	const drawer = ref(false);
	const mini = ref(true);
	const showAboutDialog = ref(false);
	const showOfflineInvoices = ref(false);
	const activeItem = ref(0);

        // Settings store for cache usage
        const settingsStore = useSettingsStore();
        const { cacheUsage, cacheUsageLoading, cacheUsageDetails } = storeToRefs(settingsStore);

        // Network store
        const networkStore = useNetworkStore();
        const { networkOnline, serverOnline, serverConnecting } = storeToRefs(networkStore);

        // Status state
        const statusState = reactive({
                syncTotals: {
                        pending: 0,
                        synced: 0,
                        drafted: 0,
                },
        });

	// Actions
	const toggleDrawer = () => {
		drawer.value = !drawer.value;
	};

	const openAboutDialog = () => {
		showAboutDialog.value = true;
	};

	const closeAboutDialog = () => {
		showAboutDialog.value = false;
	};

	const openOfflineInvoices = () => {
		showOfflineInvoices.value = true;
	};

	const closeOfflineInvoices = () => {
		showOfflineInvoices.value = false;
	};

        const updateCacheUsage = () => {
                settingsStore.refreshCacheUsage();
        };

        const updateSyncTotals = (totals) => {
                Object.assign(statusState.syncTotals, totals);
        };

	// Computed
        const isOnline = computed(() => {
                return networkOnline.value && serverOnline.value;
        });

        const cacheUsageColor = computed(() => {
                if (cacheUsage.value < 50) return "success";
                if (cacheUsage.value < 80) return "warning";
                return "error";
        });

	return {
		// State
		drawer,
		mini,
		showAboutDialog,
		showOfflineInvoices,
		activeItem,
                cacheUsage,
                cacheUsageLoading,
                cacheUsageDetails,
                statusState,
                networkOnline,
                serverOnline,
                serverConnecting,

                // Actions
                toggleDrawer,
                openAboutDialog,
                closeAboutDialog,
                openOfflineInvoices,
                closeOfflineInvoices,
                updateCacheUsage,
                updateSyncTotals,

                // Computed
                isOnline,
                cacheUsageColor,
        };
}
