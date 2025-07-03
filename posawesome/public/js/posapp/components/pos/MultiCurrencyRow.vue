<template>
  <v-row align="center" class="items px-3 py-2 mt-0" v-if="pos_profile.posa_allow_multi_currency">
    <v-col cols="4" class="pb-2">
      <v-select density="compact" variant="outlined" color="primary" :label="frappe._('Currency')"
        bg-color="white" hide-details v-model="internal_selected_currency" :items="available_currencies"
        @update:model-value="onCurrencyUpdate"></v-select>
    </v-col>
    <v-col cols="4" class="pb-2">
      <v-text-field density="compact" variant="outlined" color="primary" :label="exchangeRateLabel"
        bg-color="white" hide-details v-model="internal_exchange_rate" :rules="[isNumber]"
        @change="onExchangeChange"></v-text-field>
    </v-col>
  </v-row>
</template>

<script>
export default {
  props: {
    pos_profile: Object,
    selected_currency: String,
    exchange_rate: Number,
    available_currencies: Array,
    isNumber: Function,
    company_currency: String,
  },
  data() {
    return {
      internal_selected_currency: this.selected_currency,
      // Keep rate in the same orientation as provided (selected -> company)
      internal_exchange_rate: this.exchange_rate || 1,
    };
  },
  computed: {
    exchangeRateLabel() {
      return `${frappe._('Exchange Rate')} (${this.internal_selected_currency} → ${this.company_currency})`;
    }
  },
  watch: {
    selected_currency(val) {
      this.internal_selected_currency = val;
    },
    exchange_rate(val) {
      this.internal_exchange_rate = val || 1;
    },
  },
  methods: {
    onCurrencyUpdate(val) {
      this.$emit('update:selected_currency', val);
    },
    onExchangeChange() {
      const rate = this.internal_exchange_rate || 1;
      this.$emit('update:exchange_rate', rate);
    },
  },
};
</script>
