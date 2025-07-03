<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="400px">
    <v-card>
      <v-card-title class="text-h6 pa-4 d-flex align-center">
        <span>{{ __('Item Selector Settings') }}</span>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" density="compact" @click="$emit('update:modelValue', false)"></v-btn>
      </v-card-title>
      <v-divider></v-divider>
      <v-card-text class="pa-4">
        <v-switch v-model="temp_hide_qty_decimals" :label="__('Hide quantity decimals')" hide-details
          density="compact" color="primary" class="mb-2"></v-switch>
        <v-switch v-model="temp_hide_zero_rate_items" :label="__('Hide zero rated items')" hide-details
          density="compact" color="primary"></v-switch>
      </v-card-text>
      <v-card-actions class="pa-4 pt-0">
        <v-btn color="error" variant="text" @click="cancel">{{ __('Cancel') }}</v-btn>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="tonal" @click="apply">{{ __('Apply') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'ItemSettingsDialog',
  props: {
    modelValue: Boolean,
    hideQtyDecimals: Boolean,
    hideZeroRateItems: Boolean
  },
  emits: ['update:modelValue','update:hideQtyDecimals','update:hideZeroRateItems','apply','cancel'],
  data() {
    return {
      temp_hide_qty_decimals: this.hideQtyDecimals,
      temp_hide_zero_rate_items: this.hideZeroRateItems
    };
  },
  watch: {
    modelValue(val) {
      if (val) {
        this.temp_hide_qty_decimals = this.hideQtyDecimals;
        this.temp_hide_zero_rate_items = this.hideZeroRateItems;
      }
    }
  },
  methods: {
    cancel() {
      this.$emit('cancel');
      this.$emit('update:modelValue', false);
    },
    apply() {
      this.$emit('update:hideQtyDecimals', this.temp_hide_qty_decimals);
      this.$emit('update:hideZeroRateItems', this.temp_hide_zero_rate_items);
      this.$emit('apply');
      this.$emit('update:modelValue', false);
    }
  }
};
</script>
