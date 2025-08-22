import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    roles: [],
    token: null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    login({ user, roles, token }) {
      this.user = user;
      this.roles = roles || [];
      this.token = token;
    },
    logout() {
      this.user = null;
      this.roles = [];
      this.token = null;
    },
    refresh(payload) {
      Object.assign(this, payload);
    },
  },
  persist: {
    paths: ['user', 'roles', 'token'],
  },
});
