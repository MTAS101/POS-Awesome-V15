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

// Mock frappe for development
if (typeof window !== "undefined" && !window.frappe) {
    window.frappe = {
        provide: (name) => {
            console.log(`Providing ${name}`);
        },
        utils: {
            is_rtl: () => false,
        },
    };
}

// Expose Dexie globally for libraries that expect a global Dexie instance
if (typeof window !== "undefined" && !window.Dexie) {
    window.Dexie = Dexie;
}

frappe.provide("frappe.PosApp");

// Development initialization
const initDevApp = () => {
    const vuetify = createVuetify({
        components,
        directives,
        locale: {
            rtl: frappe.utils.is_rtl(),
        },
        theme: {
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
        },
    });

    const app = createApp(Home);
    app.component("VueDatePicker", VueDatePicker);
    app.use(eventBus);
    app.use(vuetify);
    app.use(themePlugin, { vuetify });
    app.mount("#app");
};

// Initialize when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDevApp);
} else {
    initDevApp();
}

// Export for potential use in other contexts
export { initDevApp }; 