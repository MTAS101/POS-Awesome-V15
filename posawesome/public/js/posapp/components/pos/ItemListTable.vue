<template>
  <v-data-table-virtual :headers="headers" :items="items" class="sleek-data-table overflow-y-auto"
    :style="{ maxHeight: computedHeight }" item-key="item_code" @click:row="$emit('row-click', $event)">
    <template v-slot:item="{ item }">
      <tr :draggable="true" @dragstart="$emit('drag-start', $event, item)" @dragend="$emit('drag-end')" @click="$emit('row-click', $event, { item })">
        <td v-for="header in headers" :key="header.key">
          <template v-if="header.key === 'rate'">
            <div>
              <div class="text-primary">{{ currencySymbol(item.currency || pos_profile.currency) }}
                {{ format_currency(item.rate, item.currency || pos_profile.currency, ratePrecision(item.rate)) }}</div>
              <div v-if="pos_profile.posa_allow_multi_currency && selected_currency !== pos_profile.currency" class="text-success">
                {{ currencySymbol(selected_currency) }}
                {{ format_currency(getConvertedRate(item), selected_currency, ratePrecision(getConvertedRate(item))) }}
              </div>
            </div>
          </template>
          <template v-else-if="header.key === 'actual_qty'">
            <span class="golden--text">{{ format_number(item.actual_qty, hide_qty_decimals ? 0 : 4) }}</span>
          </template>
          <template v-else>
            {{ item[header.key] }}
          </template>
        </td>
      </tr>
    </template>
  </v-data-table-virtual>
</template>

<script>
export default {
  name: 'ItemListTable',
  props: {
    headers: Array,
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
  emits: ['row-click','drag-start','drag-end'],
  computed: {
    computedHeight() {
      return 'calc(' + this.responsiveStyles['--container-height'] + ' - 80px)';
    }
  }
};
</script>
