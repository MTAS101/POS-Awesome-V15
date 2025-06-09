<template>
  <v-row justify="center">
    <v-dialog v-model="closingDialog" max-width="900px">
      <v-card>
        <v-card-title>
          <span class="text-h5 text-primary">{{
            __('Closing POS Shift')
          }}</span>
        </v-card-title>
        <v-card-text class="pa-0">
          <v-container>
            <v-row>
              <v-col cols="12" class="pa-1">
                <v-data-table :headers="headers" :items="dialog_data.payment_reconciliation" item-key="mode_of_payment"
                  class="elevation-1" :items-per-page="itemsPerPage" hide-default-footer>
                  <template v-slot:item.closing_amount="props">
                    <v-text-field
                      v-model="props.item.closing_amount"
                      :rules="[max25chars]"
                      :label="frappe._('Edit')"
                      single-line
                      counter
                      type="number"
                      density="compact"
                      variant="outlined"
                      color="primary"
                      bg-color="white"
                      hide-details
                      :prefix="currencySymbol(pos_profile.currency)"
                    ></v-text-field>
                  </template>
                  <template v-slot:item.difference="{ item }">
                    {{ currencySymbol(pos_profile.currency) }}
                    {{
                      (item.difference = formatCurrency(
                        item.expected_amount - item.closing_amount
                      ))
                    }}</template>
                  <template v-slot:item.opening_amount="{ item }">
                    {{ currencySymbol(pos_profile.currency) }}
                    {{ formatCurrency(item.opening_amount) }}</template>
                  <template v-slot:item.expected_amount="{ item }">
                    {{ currencySymbol(pos_profile.currency) }}
                    {{ formatCurrency(item.expected_amount) }}</template>
                </v-data-table>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions class="dialog-actions-container">
          <v-btn
            color="error"
            theme="dark"
            @click="close_dialog"
            class="pos-action-btn cancel-action-btn"
            size="large"
            elevation="2"
          >
            <v-icon start>mdi-close-circle-outline</v-icon>
            <span>{{ __('Close') }}</span>
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn
            color="success"
            theme="dark"
            @click="submit_dialog"
            class="pos-action-btn submit-action-btn"
            size="large"
            elevation="2"
          >
            <v-icon start>mdi-check-circle-outline</v-icon>
            <span>{{ __('Submit') }}</span>
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>

import format from '../../format';
export default {
  mixins: [format],
  data: () => ({
    closingDialog: false,
    itemsPerPage: 20,
    dialog_data: {},
    pos_profile: '',
    headers: [
      {
        title: __('Mode of Payment'),
        value: 'mode_of_payment',
        align: 'start',
        sortable: true,
      },
      {
        title: __('Opening Amount'),
        align: 'end',
        sortable: true,
        value: 'opening_amount',
      },
      {
        title: __('Closing Amount'),
        value: 'closing_amount',
        align: 'end',
        sortable: true,
      },
    ],
    max25chars: (v) => v.length <= 20 || 'Input too long!', // TODO : should validate as number
    pagination: {},
  }),
  watch: {},

  methods: {
    close_dialog() {
      this.closingDialog = false;
    },
    submit_dialog() {
      this.eventBus.emit('submit_closing_pos', this.dialog_data);
      this.closingDialog = false;
    },
  },

  created: function () {
    this.eventBus.on('open_ClosingDialog', (data) => {
      this.closingDialog = true;
      this.dialog_data = data;
    });
    this.eventBus.on('register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
      if (!this.pos_profile.hide_expected_amount) {
        this.headers.push({
          title: __('Expected Amount'),
          value: 'expected_amount',
          align: 'end',
          sortable: false,
        });
        this.headers.push({
          title: __('Difference'),
          value: 'difference',
          align: 'end',
          sortable: false,
        });
      }
    });
  },
  beforeUnmount() {
    this.eventBus.off('open_ClosingDialog');
    this.eventBus.off('register_pos_profile');
  },
};
</script>

<style scoped>
/* Header Section - White Background with Blue Text */
.opening-dialog-header {
  background: white;
  color: #1976d2;
  padding: 16px 24px;
  border-bottom: 2px solid rgba(25, 118, 210, 0.1);
  flex-shrink: 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-wrapper {
  background: rgba(25, 118, 210, 0.1);
  border-radius: 50%;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.header-icon {
  font-size: 20px;
  color: #1976d2;
}

.header-text {
  flex: 1;
}

.header-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.2;
  color: #1976d2;
}

.header-subtitle {
  font-size: 0.85rem;
  opacity: 0.8;
  margin: 2px 0 0 0;
  line-height: 1.3;
  color: #1976d2;
}

/* Content Section - Optimized for minimal scrolling */
.opening-dialog-content {
  padding: 20px 24px;
  background: white;
  flex: 1;
  overflow-y: auto;
}

.section-header-compact {
  margin-bottom: 12px;
}

.section-title-compact {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 1rem;
  font-weight: 600;
  color: #1976d2;
  margin-bottom: 0;
}

.section-icon {
  color: #1976d2;
  font-size: 18px;
}

/* Enhanced Table - Compact */
.enhanced-table-compact {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(25, 118, 210, 0.1);
}

.enhanced-table-compact :deep(.v-data-table__wrapper) {
  border-radius: 8px;
}

.enhanced-table-compact :deep(th) {
  background: linear-gradient(135deg, #f8f9fa 0%, #e3f2fd 100%);
  color: #1976d2;
  font-weight: 600;
  border-bottom: 1px solid rgba(25, 118, 210, 0.1);
  padding: 8px 12px;
}

.enhanced-table-compact :deep(td) {
  padding: 6px 12px;
}

.enhanced-table-compact :deep(tr:hover) {
  background: rgba(25, 118, 210, 0.04);
}

/* Amount Editor - Compact */
.amount-editor {
  width: 100%;
}

.amount-display-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(25, 118, 210, 0.05);
  border-radius: 6px;
  transition: all 0.3s ease;
  cursor: pointer;
  min-height: 32px;
}

.amount-display-compact:hover {
  background: rgba(25, 118, 210, 0.1);
  transform: scale(1.01);
}

.currency-symbol {
  font-weight: 600;
  color: #1976d2;
  font-size: 0.9rem;
}

.amount-value {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
}

.amount-input {
  margin-top: 4px;
}

/* Action buttons with improved naming and styling */
.dialog-actions-container {
  padding: 24px 32px;
  display: flex;
  gap: 16px;
}

.pos-action-btn {
  padding: 8px 24px;
  border-radius: 6px;
  font-weight: 500;
  text-transform: none;
  transition: all 0.2s ease;
  min-width: 110px;
  font-size: 1rem;
  letter-spacing: 0.5px;
}

/* Force white text color for all button elements */
.pos-action-btn,
.pos-action-btn .v-icon,
.pos-action-btn span,
.pos-action-btn :deep(.v-btn__content) {
  color: white !important;
}

.cancel-action-btn {
  background-color: #f44336 !important;
  border: 1px solid #d32f2f;
}

.cancel-action-btn:hover {
  background-color: #d32f2f !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.submit-action-btn {
  background-color: #4caf50 !important;
  border: 1px solid #388e3c;
}

.submit-action-btn:hover {
  background-color: #388e3c !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.submit-action-btn:disabled {
  opacity: 0.7;
  background-color: #9e9e9e !important;
  border-color: #757575;
}

/* Animation Effects */
@keyframes slideInFromTop {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.opening-dialog-card {
  animation: slideInFromTop 0.4s ease-out;
}

/* Responsive Design */
@media (max-width: 768px) {
  .opening-dialog-header {
    padding: 12px 16px;
  }
  
  .header-content {
    gap: 8px;
  }
  
  .header-title {
    font-size: 1.2rem;
  }
  
  .opening-dialog-content {
    padding: 16px;
  }
  
  .dialog-actions-container {
    padding: 12px 16px;
  }
  
  .pos-action-btn {
    padding: 6px 12px;
    min-width: 70px;
  }
}

@media (max-width: 480px) {
  .header-content {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }
  
  .opening-dialog-content {
    padding: 12px;
  }
  
  .pos-action-btn {
    margin-left: 4px;
    padding: 6px 10px;
    min-width: 60px;
  }
}
</style>
