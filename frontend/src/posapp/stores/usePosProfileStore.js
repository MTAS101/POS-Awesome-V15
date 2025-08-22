import { defineStore } from 'pinia';

export const usePosProfileStore = defineStore('posProfile', {
  state: () => ({
    profile: null,
    company: null,
    priceList: null,
    taxTemplate: null,
    printTemplate: null,
    posOpeningShift: null,
    taxTemplateCache: {},
  }),
  getters: {
    isProfileLoaded: (state) => !!state.profile,
  },
  actions: {
    async loadProfile() {
      // Placeholder: load profile from server or Dexie cache
    },
    setProfile(profile) {
      this.profile = profile;
    },
    switchProfile(name) {
      // Placeholder: switch profile by name
    },
    async fetchOpeningShift(force = false) {
      if (this.profile && this.posOpeningShift && !force) {
        return {
          pos_profile: this.profile,
          pos_opening_shift: this.posOpeningShift,
          company: this.company,
        };
      }
      const r = await frappe.call({
        method: 'posawesome.posawesome.api.shifts.check_opening_shift',
        args: { user: frappe.session.user },
      });
      if (r.message) {
        this.profile = r.message.pos_profile;
        this.posOpeningShift = r.message.pos_opening_shift;
        this.company = r.message.company;
      }
      return r.message;
    },
    async fetchTaxTemplate(name) {
      if (this.taxTemplateCache[name]) {
        this.taxTemplate = this.taxTemplateCache[name];
        return this.taxTemplateCache[name];
      }
      const res = await frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Sales Taxes and Charges Template', name },
      });
      if (res.message) {
        this.taxTemplateCache[name] = res.message;
        this.taxTemplate = res.message;
        return res.message;
      }
      return null;
    },
    fetchTemplates() {},
  },
  persist: true,
});
