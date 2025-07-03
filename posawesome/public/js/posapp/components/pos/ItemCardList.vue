<template>
  <div class="items-grid dynamic-scroll" ref="itemsContainer" :style="{ maxHeight: computedHeight }">
    <v-card v-for="item in items" :key="item.item_code" hover class="dynamic-item-card" :draggable="true"
      @dragstart="$emit('drag-start', $event, item)" @dragend="$emit('drag-end')" @click="$emit('add-item', item)">
      <v-img :src="item.image || '/assets/posawesome/js/posapp/components/pos/placeholder-image.png'"
        class="text-white align-end" gradient="to bottom, rgba(0,0,0,0), rgba(0,0,0,0.4)" height="100px">
        <v-card-text class="text-caption px-1 pb-0 truncate">{{ item.item_name }}</v-card-text>
      </v-img>
      <v-card-text class="text--primary pa-1">
        <div class="text-caption text-primary truncate">
          {{ currencySymbol(item.currency || pos_profile.currency) || '' }}
          {{ format_currency(item.rate, item.currency || pos_profile.currency, ratePrecision(item.rate)) }}
        </div>
        <div v-if="pos_profile.posa_allow_multi_currency && selected_currency !== pos_profile.currency"
          class="text-caption text-success truncate">
          {{ currencySymbol(selected_currency) || '' }}
          {{ format_currency(getConvertedRate(item), selected_currency, ratePrecision(getConvertedRate(item))) }}
        </div>
        <div class="text-caption golden--text truncate">
          {{ format_number(item.actual_qty, hide_qty_decimals ? 0 : 4) || 0 }}
          {{ item.stock_uom || '' }}
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
export default {
  name: 'ItemCardList',
  props: {
    items: Array,
    pos_profile: Object,
    selected_currency: String,
    hide_qty_decimals: Boolean,
    responsiveStyles: Object,
    currencySymbol: Function,
    format_currency: Function,
    getConvertedRate: Function,
    ratePrecision: Function,
    format_number: Function
  },
  emits: ['add-item','drag-start','drag-end'],
  computed: {
    computedHeight() {
      return 'calc(' + this.responsiveStyles['--container-height'] + ' - 80px)';
    }
  }
};
</script>
