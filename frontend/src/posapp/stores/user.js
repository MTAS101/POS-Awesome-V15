import { defineStore } from "pinia";

export const useUserStore = defineStore("user", {
    state: () => ({
        user: null,
        roles: [],
        token: null,
    }),
    getters: {
        isLoggedIn: (state) => Boolean(state.token),
        hasRole: (state) => (role) => state.roles.includes(role),
    },
    actions: {
        async login(credentials) {
            if (typeof frappe === "undefined") return;
            const { message } = await frappe.call({
                method: "login",
                type: "POST",
                args: credentials,
            });
            if (message) {
                this.user = message.user || null;
                this.roles = message.roles || [];
                this.token = message.token || null;
            }
        },
        async logout() {
            if (typeof frappe !== "undefined") {
                try {
                    await frappe.call({ method: "logout" });
                } catch (e) {
                    console.error("Logout failed", e);
                }
            }
            this.user = null;
            this.roles = [];
            this.token = null;
        },
        async refreshSession() {
            if (typeof frappe === "undefined") return;
            const { message } = await frappe.call({
                method: "frappe.auth.get_logged_user",
            });
            if (message) {
                this.user = message;
            }
        },
    },
    persist: {
        key: "posa_user",
        paths: ["token"],
        storage: sessionStorage,
    },
});
