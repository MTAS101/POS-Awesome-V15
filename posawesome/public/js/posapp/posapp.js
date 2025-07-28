import { createVuetify } from "vuetify";
import { createApp } from "vue";
import Dexie from "dexie/dist/dexie.mjs";
import VueDatePicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";
import eventBus from "./bus";
import themePlugin from "./plugins/theme.js";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import Home from "./Home.vue";

// Constants
const FALLBACK_TIMEOUT = 100;
const MAX_RETRIES = 50; // 5 seconds max wait time

// Theme configuration
const THEME_CONFIG = {
	defaultTheme: "light",
	themes: {
		light: {
			colors: {
				background: "#FFFFFF",
				primary: "#0097A7",
				secondary: "#00BCD4",
				accent: "#9575CD",
				success: "#66BB6A",
				info: "#2196F3",
				warning: "#FF9800",
				error: "#E86674",
				orange: "#E65100",
				golden: "#A68C59",
				badge: "#F5528C",
				customPrimary: "#085294",
			},
		},
		dark: {
			dark: true,
			colors: {
				background: "#121212",
				surface: "#1E1E1E",
				primary: "#BB86FC",
				primaryVariant: "#985EFF",
				secondary: "#03DAC6",
				accent: "#9575CD",
				success: "#66BB6A",
				info: "#2196F3",
				warning: "#FF9800",
				error: "#CF6679",
				orange: "#FF6F00",
				golden: "#A68C59",
				badge: "#F5528C",
				customPrimary: "#4FC3F7",
				onBackground: "#FFFFFF",
				onSurface: "#FFFFFF",
				divider: "#373737",
			},
		},
	},
};

// Utility functions
const setupGlobalDependencies = () => {
	// Expose Dexie globally for libraries that expect a global Dexie instance
	if (typeof window !== "undefined" && !window.Dexie) {
		window.Dexie = Dexie;
	}
};

const createVuetifyInstance = (isRTL = false) => {
	return createVuetify({
		components,
		directives,
		locale: { rtl: isRTL },
		theme: THEME_CONFIG,
	});
};

const setupPWA = () => {
	// Add manifest link if not present
	if (!document.querySelector('link[rel="manifest"]')) {
		const link = document.createElement("link");
		link.rel = "manifest";
		link.href = "/manifest.json";
		document.head.appendChild(link);
	}

	// Register service worker
	const shouldRegisterSW =
		("serviceWorker" in navigator && window.location.protocol === "https:") ||
		window.location.hostname === "localhost" ||
		window.location.hostname === "127.0.0.1";

	if (shouldRegisterSW) {
		navigator.serviceWorker
			.register("/sw.js")
			.catch((err) => console.error("SW registration failed", err));
	}
};

const createVueApp = (vuetify, mountElement) => {
	try {
		const app = createApp(Home);
		app.component("VueDatePicker", VueDatePicker);
		app.use(eventBus);
		app.use(vuetify);
		app.use(themePlugin, { vuetify });
		app.mount(mountElement);
		return app;
	} catch (error) {
		console.error("Failed to create Vue app:", error);
		throw error;
	}
};

// Main PosApp class
class PosApp {
	constructor({ parent }) {
		if (!parent || !parent.page) {
			throw new Error("PosApp requires a valid parent with page property");
		}

		this.$parent = $(document);
		this.page = parent.page;
		this.vueApp = null;
		this.vuetify = null;

		this.make_body();
	}

	make_body() {
		try {
			this.$el = this.$parent.find(".main-section");

			if (!this.$el.length) {
				throw new Error("Could not find .main-section element");
			}

			// Create Vuetify instance
			this.vuetify = createVuetifyInstance(
				window.frappe?.utils?.is_rtl?.() || false
			);

			// Create and mount Vue app
			this.vueApp = createVueApp(this.vuetify, this.$el[0]);

			// Setup PWA features
			setupPWA();

		} catch (error) {
			console.error("Failed to initialize PosApp:", error);
			this.handleError(error);
		}
	}

	handleError(error) {
		// Display user-friendly error message
		const errorMessage = "Failed to load POS application. Please refresh the page.";
		this.$el.html(`<div class="error-message">${errorMessage}</div>`);

		// Log detailed error for debugging
		console.error("PosApp initialization error:", error);
	}

	setup_header() {
		// Header setup logic can be added here
	}

	// Cleanup method for proper disposal
	destroy() {
		if (this.vueApp) {
			this.vueApp.unmount();
			this.vueApp = null;
		}
		if (this.vuetify) {
			this.vuetify = null;
		}
	}
}

// Frappe integration
const initializeFrappeIntegration = () => {
	let retryCount = 0;

	const ensureFrappe = () => {
		if (window.frappe) {
			try {
				window.frappe.provide("frappe.PosApp");
				window.frappe.PosApp = { posapp: PosApp };
				console.log("PosAwesome bundle loaded, frappe.PosApp is available");
			} catch (error) {
				console.error("Failed to initialize Frappe integration:", error);
			}
		} else if (retryCount < MAX_RETRIES) {
			retryCount++;
			setTimeout(ensureFrappe, FALLBACK_TIMEOUT);
		} else {
			console.error("Frappe not available after maximum retries");
		}
	};

	ensureFrappe();
};

// Initialize when DOM is ready
if (typeof window !== "undefined") {
	setupGlobalDependencies();

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeFrappeIntegration);
	} else {
		initializeFrappeIntegration();
	}
}
