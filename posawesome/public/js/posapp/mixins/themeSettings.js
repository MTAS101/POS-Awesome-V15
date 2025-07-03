export const themeSettingsMixin = {
  computed: {
    isDarkTheme() {
      return this.$theme?.current === 'dark';
    },
    hide_qty_decimals() {
      try {
        const saved = localStorage.getItem('posawesome_item_selector_settings');
        if (saved) {
          const opts = JSON.parse(saved);
          return !!opts.hide_qty_decimals;
        }
      } catch (e) {
        console.error('Failed to load item selector settings:', e);
      }
      return false;
    }
  }
};
