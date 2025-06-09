<template>
  <v-row justify="center">
    <v-dialog v-model="dialog" max-width="900px">
      <v-card>
        <v-card-title>
          <span class="text-h5 text-primary">{{ __('Offline Invoices') }}</span>
        </v-card-title>
        <v-card-text class="pa-0">
          <v-container>
            <v-row>
              <v-col cols="12" class="pa-1">
                <v-data-table
                  v-if="invoices.length"
                  :headers="headers"
                  :items="invoices"
                  class="elevation-1"
                  :items-per-page="20"
                >
                  <template #item.customer="{ item }">
                    {{ item.invoice.customer_name || item.invoice.customer }}
                  </template>
                  <template #item.posting_date="{ item }">
                    {{ item.invoice.posting_date }}
                  </template>
                  <template #item.grand_total="{ item }">
                    {{ currencySymbol(item.invoice.currency) }}
                    {{ formatCurrency(item.invoice.grand_total || item.invoice.rounded_total) }}
                  </template>
                  <template #item.actions="{ index }">
                    <v-btn icon color="error" size="small" @click="removeInvoice(index)">
                      <v-icon size="18">mdi-delete</v-icon>
                    </v-btn>
                  </template>
                </v-data-table>
                <div v-else class="text-center py-4">{{ __('No offline invoices') }}</div>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" theme="dark" @click="dialog = false">{{ __('Close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
import format from '../format';
import { getOfflineInvoices, deleteOfflineInvoice, getPendingOfflineInvoiceCount } from '../../offline.js';

export default {
  name: 'OfflineInvoicesDialog',
  mixins: [format],
  props: {
    modelValue: Boolean
  },
  emits: ['update:modelValue', 'deleted'],
  data() {
    return {
      dialog: this.modelValue,
      invoices: [],
      headers: [
        { title: this.__('Customer'), value: 'customer', align: 'start' },
        { title: this.__('Date'), value: 'posting_date', align: 'start' },
        { title: this.__('Amount'), value: 'grand_total', align: 'end' },
        { title: this.__('Actions'), value: 'actions', align: 'end' }
      ]
    };
  },
  watch: {
    modelValue(val) {
      this.dialog = val;
      if (val) {
        this.loadInvoices();
      }
    },
    dialog(val) {
      this.$emit('update:modelValue', val);
    }
  },
  methods: {
    loadInvoices() {
      this.invoices = getOfflineInvoices();
    },
    removeInvoice(index) {
      deleteOfflineInvoice(index);
      this.loadInvoices();
      this.$emit('deleted', getPendingOfflineInvoiceCount());
    }
  }
};
</script>
