export default {
  mounted() {
    this.setupKeyboardShortcuts();
  },
  
  beforeUnmount() {
    this.removeKeyboardShortcuts();
  },
  
  methods: {
    setupKeyboardShortcuts() {
      document.addEventListener('keydown', this.handleKeyboardShortcuts);
    },
    
    removeKeyboardShortcuts() {
      document.removeEventListener('keydown', this.handleKeyboardShortcuts);
    },
    
    handleKeyboardShortcuts(event) {
      if (event.ctrlKey && event.key === '1') {
        event.preventDefault();
        this.toggleFirstItem();
      }
      
      if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
        this.openPaymentDialog();
      }
      
      if (event.key === 'Delete' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        this.deleteFirstItem();
      }
      
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        this.focusDiscountField();
      }
    },
    
    toggleFirstItem() {
      if (this.items && this.items.length > 0) {
        const firstItem = this.items[0];
        if (this.expanded.includes(firstItem.posa_row_id)) {
          this.expanded = this.expanded.filter(id => id !== firstItem.posa_row_id);
        } else {
          this.expanded = [firstItem.posa_row_id];
        }
      }
    },
    
    openPaymentDialog() {
      if (this.items && this.items.length > 0) {
        this.payment_dialog = true;
      }
    },
    
    deleteFirstItem() {
      if (this.items && this.items.length > 0) {
        this.remove_item(this.items[0]);
      }
    },
    
    focusDiscountField() {
      this.$nextTick(() => {
        const discountField = document.querySelector('[data-field="additional_discount"] input');
        if (discountField) {
          discountField.focus();
          discountField.select();
        }
      });
    }
  }
};