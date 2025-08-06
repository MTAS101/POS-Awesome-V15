import { defineStore } from "pinia";
import { watch } from "vue";

export const useThemeStore = defineStore("theme", {
    state: () => ({
        current: typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme-mode") || "light" : "light",
    }),
    actions: {
        init(vuetify) {
            const root = document.documentElement;
            const applyTheme = (val) => {
                vuetify.theme.global.name.value = val;
                root.setAttribute("data-theme-mode", val);
                if (window.frappe?.ui?.set_theme) {
                    window.frappe.ui.set_theme(val);
                } else {
                    root.setAttribute("data-theme", val);
                }
            };
            applyTheme(this.current);
            watch(
                () => this.current,
                (val) => applyTheme(val)
            );
        },
        toggle() {
            const newMode = this.current === "dark" ? "light" : "dark";
            const root = document.documentElement;
            root.setAttribute("data-theme-mode", newMode);
            if (window.frappe?.ui?.set_theme) {
                window.frappe.ui.set_theme(newMode);
            } else {
                root.setAttribute("data-theme", newMode);
            }
            if (window.frappe?.xcall) {
                window.frappe
                    .xcall("frappe.core.doctype.user.user.switch_theme", {
                        theme: newMode.charAt(0).toUpperCase() + newMode.slice(1),
                    })
                    .catch(() => {});
            }
            this.current = newMode;
        },
    },
    persist: {
        paths: ["current"],
    },
});
