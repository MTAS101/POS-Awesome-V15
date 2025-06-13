<template>
  <div class="my-0 py-0 overflow-y-auto" :style="{ height: 'calc(var(--container-height) - 80px)', maxHeight: 'calc(var(--container-height) - 80px)' }">
    <v-data-table
      :headers="headers"
      :items="items"
      :theme="$theme.current"
      :expanded="expanded"
      show-expand
      item-value="posa_row_id"
      class="enhanced-table-items elevation-2"
      :items-per-page="itemsPerPage"
      expand-on-click
      density="compact"
      hide-default-footer
      :single-expand="true"
      @update:expanded="$emit('update:expanded', $event)"
      :search="itemSearch"
    >
      <template v-slot:item.qty="{ item }">
        <div class="amount-value">{{ formatFloat(item.qty) }}</div>
      </template>

      <template v-slot:item.rate="{ item }">
        <div class="currency-display">
          <span class="currency-symbol">{{ currencySymbol(displayCurrency) }}</span>
          <span class="amount-value">{{ formatCurrency(item.rate) }}</span>
        </div>
      </template>

      <template v-slot:item.amount="{ item }">
        <div class="currency-display">
          <span class="currency-symbol">{{ currencySymbol(displayCurrency) }}</span>
          <span class="amount-value">{{ formatCurrency(item.qty * item.rate) }}</span>
        </div>
      </template>

      <template v-slot:item.discount_value="{ item }">
        <div v-if="item.discount_percentage" class="amount-value">
          {{ formatFloat(item.discount_percentage) }}%
        </div>
        <div v-else class="currency-display">
          <span class="currency-symbol">{{ currencySymbol(displayCurrency) }}</span>
          <span class="amount-value">{{ formatCurrency(item.discount_amount) }}</span>
        </div>
      </template>

      <template v-slot:item.price_list_rate="{ item }">
        <div class="currency-display">
          <span class="currency-symbol">{{ currencySymbol(displayCurrency) }}</span>
          <span class="amount-value">{{ formatCurrency(item.price_list_rate) }}</span>
        </div>
      </template>

      <template v-slot:item.posa_is_offer="{ item }">
        <v-checkbox-btn v-model="item.posa_is_offer" class="center" @change="toggleOffer(item)"></v-checkbox-btn>
      </template>

      <template v-slot:expanded-row="{ columns: headers, item }">
        <td :colspan="headers.length" class="ma-0 pa-2">
          <v-row class="mb-3" dense>
            <v-col cols="auto">
              <v-btn :disabled="!!item.posa_is_replace" icon="mdi-trash-can-outline" size="large" color="error"
                variant="tonal" class="item-action-btn delete-btn mr-2" @click.stop="removeItem(item)">
                <v-icon size="large">mdi-trash-can-outline</v-icon>
              </v-btn>
            </v-col>
            <v-spacer></v-spacer>
            <v-col cols="auto">
              <v-btn :disabled="!!item.posa_is_replace" size="large" color="error" variant="tonal"
                class="item-action-btn minus-btn mr-2" @click.stop="subtractOne(item)">
                <v-icon size="large">mdi-minus-circle-outline</v-icon>
              </v-btn>
              <v-btn :disabled="!!item.posa_is_replace" size="large" color="success" variant="tonal"
                class="item-action-btn plus-btn ml-2" @click.stop="addOne(item)">
                <v-icon size="large">mdi-plus-circle-outline</v-icon>
              </v-btn>
            </v-col>
          </v-row>

          <v-row dense class="item-details-form mb-2">
            <v-col cols="12" sm="4" class="field-with-icon">
              <v-text-field density="compact" variant="outlined" color="primary" :label="frappe._('Item Code')"
                bg-color="white" hide-details v-model="item.item_code" disabled
                prepend-inner-icon="mdi-barcode"></v-text-field>
            </v-col>
            <v-col cols="12" sm="4" class="field-with-icon">
              <v-text-field density="compact" variant="outlined" color="primary" :label="frappe._('QTY')"
                bg-color="white" hide-details :model-value="formatFloat(item.qty)" @change="[
                  setFormatedQty(item, 'qty', null, false, $event.target.value),
                  calcStockQty(item, item.qty),
                ]" :rules="[isNumber]" :disabled="!!item.posa_is_replace"
                prepend-inner-icon="mdi-numeric"></v-text-field>
            </v-col>
            <v-col cols="12" sm="4" class="field-with-icon">
              <v-select density="compact" bg-color="white" :label="frappe._('UOM')" v-model="item.uom"
                :items="item.item_uoms" variant="outlined" item-title="uom" item-value="uom" hide-details
                @update:model-value="calcUom(item, $event)"
                :disabled="!!item.posa_is_replace || (isReturnInvoice && invoice_doc.return_against)"
                prepend-inner-icon="mdi-weight"></v-select>
            </v-col>

            <v-col cols="12" sm="4">
              <v-text-field density="compact" variant="outlined" color="primary" :label="frappe._('Rate')"
                bg-color="white" hide-details :prefix="currencySymbol(pos_profile.currency)"
                :model-value="formatCurrency(item.rate)" @change="[
                  setFormatedCurrency(item, 'rate', null, false, $event),
                  calcPrices(item, $event.target.value, $event),
                ]" :rules="[isNumber]" id="rate" :disabled="!!item.posa_is_replace ||
                  !!item.posa_offer_applied ||
                  !pos_profile.posa_allow_user_to_edit_rate ||
                  (isReturnInvoice && invoice_doc.return_against)"></v-text-field>
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field density="compact" variant="outlined" color="primary" :label="frappe._('Discount %')"
                bg-color="white" hide-details :model-value="formatFloat(item.discount_percentage)" @change="[
                  setFormatedCurrency(item, 'discount_percentage', null, true, $event),
                  calcPrices(item, $event.target.value, $event),
                ]" :rules="[isNumber]" id="discount_percentage" :disabled="!!item.posa_is_replace ||
                  item.posa_offer_applied ||
                  !pos_profile.posa_allow_user_to_edit_item_discount ||
                  (isReturnInvoice && invoice_doc.return_against)" suffix="%"></v-text-field>
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field density="compact" variant="outlined" color="primary"
                :label="frappe._('Discount Amount')" bg-color="white" hide-details
                :model-value="formatCurrency(item.discount_amount || 0)" ref="discount"
                @change="(event) => { if (expanded && expanded.length === 1 && expanded[0] === item.posa_row_id) { calcPrices(item, event.target.value, { target: { id: 'discount_amount' } }); } }"
                :rules="['isNumber']" id="discount_amount"
                :disabled="!!item.posa_is_replace || item.posa_offer_applied || !pos_profile.posa_allow_user_to_edit_item_discount || (isReturnInvoice && invoice_doc.return_against)"
                :prefix="currencySymbol(pos_profile.currency)"></v-text-field>
            </v-col>

            <v-col cols="12" sm="4">
              <v-text-field density="compact" variant="outlined" color="primary"
                :label="frappe._('Price list Rate')" bg-color="white" hide-details
                :model-value="formatCurrency(item.price_list_rate)" disabled
                :prefix="currencySymbol(pos_profile.currency)"></v-text-field>
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field density="compact" variant="outlined" color="primary"
                :label="frappe._('Available QTY')" bg-color="white" hide-details
                :model-value="formatFloat(item.actual_qty)" disabled></v-text-field>
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field density="compact" variant="outlined" color="primary" :label="frappe._('Group')"
                bg-color="white" hide-details v-model="item.item_group" disabled></v-text-field>
            </v-col>

            <v-col cols="12" sm="4">
              <v-text-field density="compact" variant="outlined" color="primary" :label="frappe._('Stock QTY')"
                bg-color="white" hide-details :model-value="formatFloat(item.stock_qty)" disabled></v-text-field>
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field density="compact" variant="outlined" color="primary" :label="frappe._('Stock UOM')"
                bg-color="white" hide-details v-model="item.stock_uom" disabled></v-text-field>
            </v-col>
            <v-col cols="12" sm="4" v-if="item.posa_offer_applied">
              <v-checkbox density="compact" :label="frappe._('Offer Applied')" v-model="item.posa_offer_applied"
                readonly hide-details class="mt-1"></v-checkbox>
            </v-col>

            <template v-if="item.has_serial_no == 1 || item.serial_no">
              <v-col cols="12" sm="4">
                <v-text-field density="compact" variant="outlined" color="primary"
                  :label="frappe._('Serial No QTY')" bg-color="white" hide-details
                  v-model="item.serial_no_selected_count" type="number" disabled></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-autocomplete v-model="item.serial_no_selected" :items="item.serial_no_data"
                  item-title="serial_no" variant="outlined" density="compact" chips color="primary"
                  :label="frappe._('Serial No')" multiple
                  @update:model-value="setSerialNo(item)"></v-autocomplete>
              </v-col>
            </template>

            <template v-if="item.has_batch_no == 1 || item.batch_no">
              <v-col cols="12" sm="4">
                <v-text-field density="compact" variant="outlined" color="primary"
                  :label="frappe._('Batch No. Available QTY')" bg-color="white" hide-details
                  :model-value="formatFloat(item.actual_batch_qty)" disabled></v-text-field>
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field density="compact" variant="outlined" color="primary"
                  :label="frappe._('Batch No Expiry Date')" bg-color="white" hide-details
                  v-model="item.batch_no_expiry_date" disabled></v-text-field>
              </v-col>
              <v-col cols="12" sm="4">
                <v-autocomplete v-model="item.batch_no" :items="item.batch_no_data" item-title="batch_no"
                  variant="outlined" density="compact" color="primary" :label="frappe._('Batch No')"
                  @update:model-value="setBatchQty(item, $event)" hide-details>
                  <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props">
                      <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
                      <v-list-item-title v-html="item.raw.batch_no"></v-list-item-title>
                      <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
                      <v-list-item-subtitle v-html="`Available QTY  '${item.raw.batch_qty}' - Expiry Date ${item.raw.expiry_date}`"></v-list-item-subtitle>
                    </v-list-item>
                  </template>
                </v-autocomplete>
              </v-col>
            </template>

            <v-col cols="12" sm="4" v-if="pos_profile.posa_allow_sales_order && invoiceType == 'Order'">
              <VueDatePicker
                v-model="item.posa_delivery_date"
                model-type="format"
                format="dd-MM-yyyy"
                :min-date="new Date()"
                auto-apply
                @update:model-value="validateDueDate(item)"
              />
            </v-col>
          </v-row>
        </td>
      </template>
    </v-data-table>
  </div>
</template>

<script>
export default {
  name: 'ItemsTable',
  props: {
    headers: Array,
    items: Array,
    expanded: Array,
    itemsPerPage: Number,
    itemSearch: String,
    pos_profile: Object,
    invoice_doc: Object,
    invoiceType: String,
    displayCurrency: String,
    formatFloat: Function,
    formatCurrency: Function,
    currencySymbol: Function,
    isNumber: Function,
    setFormatedQty: Function,
    calcStockQty: Function,
    setFormatedCurrency: Function,
    calcPrices: Function,
    calcUom: Function,
    setSerialNo: Function,
    setBatchQty: Function,
    validateDueDate: Function,
    removeItem: Function,
    subtractOne: Function,
    addOne: Function,
    isReturnInvoice: Boolean,
    toggleOffer: Function,
  },
};
</script>

<style scoped>
.enhanced-table-items {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.09);
  margin-bottom: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.enhanced-table-items :deep(.v-data-table__wrapper),
.enhanced-table-items :deep(.v-table__wrapper) {
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
}

.enhanced-table-items :deep(th) {
  background: #ffffff;
  color: #424242;
  font-weight: 600;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  padding: 14px 18px;
  font-size: 0.95rem;
}

.enhanced-table-items :deep(td) {
  padding: 14px 18px;
  height: 64px;
  vertical-align: middle;
}

.enhanced-table-items :deep(tr:hover) {
  background: rgba(25, 118, 210, 0.05);
}

.enhanced-table-items :deep(.v-data-table__expanded) {
  padding: 20px 24px;
  background-color: #fafafa;
}

/* Dark mode adjustments */
:deep(.dark-theme) .enhanced-table-items,
:deep(.v-theme--dark) .enhanced-table-items,
::v-deep(.dark-theme) .enhanced-table-items,
::v-deep(.v-theme--dark) .enhanced-table-items {
  background-color: #000 !important;
}

:deep(.dark-theme) .enhanced-table-items :deep(th),
:deep(.v-theme--dark) .enhanced-table-items :deep(th),
:deep(.dark-theme) .enhanced-table-items :deep(td),
:deep(.v-theme--dark) .enhanced-table-items :deep(td),
::v-deep(.dark-theme) .enhanced-table-items th,
::v-deep(.v-theme--dark) .enhanced-table-items th,
::v-deep(.dark-theme) .enhanced-table-items td,
::v-deep(.v-theme--dark) .enhanced-table-items td {
  color: #fff !important;
  background-color: #000 !important;
  border-color: #333 !important;
}

:deep(.dark-theme) .enhanced-table-items :deep(.v-data-table__wrapper),
:deep(.v-theme--dark) .enhanced-table-items :deep(.v-data-table__wrapper),
:deep(.dark-theme) .enhanced-table-items :deep(.v-table__wrapper),
:deep(.v-theme--dark) .enhanced-table-items :deep(.v-table__wrapper),
::v-deep(.dark-theme) .enhanced-table-items .v-data-table__wrapper,
::v-deep(.v-theme--dark) .enhanced-table-items .v-data-table__wrapper,
::v-deep(.dark-theme) .enhanced-table-items .v-table__wrapper,
::v-deep(.v-theme--dark) .enhanced-table-items .v-table__wrapper {
  background-color: #000 !important;
}

:deep(.dark-theme) .enhanced-table-items :deep(.v-data-table__expanded),
:deep(.v-theme--dark) .enhanced-table-items :deep(.v-data-table__expanded),
::v-deep(.dark-theme) .enhanced-table-items .v-data-table__expanded,
::v-deep(.v-theme--dark) .enhanced-table-items .v-data-table__expanded {
  background-color: #111 !important;
}

.currency-display {
  display: flex;
  align-items: center;
  gap: 4px;
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

/* Ensure numeric values remain visible in dark mode */
:deep(.dark-theme) .amount-value,
:deep(.v-theme--dark) .amount-value,
::v-deep(.dark-theme) .amount-value,
::v-deep(.v-theme--dark) .amount-value {
  color: #fff !important;
}

/* Ensure table headings are dark themed */
:deep(.dark-theme) .enhanced-table-items :deep(thead th),
:deep(.v-theme--dark) .enhanced-table-items :deep(thead th),
::v-deep(.dark-theme) .enhanced-table-items thead th,
::v-deep(.v-theme--dark) .enhanced-table-items thead th {
  background-color: #616161 !important;
  color: #fff !important;
}

/* Ensure thead background is dark */
:deep(.dark-theme) .enhanced-table-items :deep(thead),
:deep(.v-theme--dark) .enhanced-table-items :deep(thead),
::v-deep(.dark-theme) .enhanced-table-items thead,
::v-deep(.v-theme--dark) .enhanced-table-items thead {
  background-color: #616161 !important;
}

.item-action-btn {
  min-width: 44px !important;
  height: 44px !important;
  border-radius: 8px !important;
  transition: all 0.3s ease;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1) !important;
  margin: 0 3px !important;
  position: relative;
  overflow: hidden;
}

.item-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 12px rgba(0, 0, 0, 0.15) !important;
}

.item-action-btn .v-icon {
  font-size: 22px !important;
  position: relative;
  z-index: 2;
}

.item-action-btn.delete-btn {
  background: linear-gradient(145deg, #ffebee, #ffcdd2) !important;
}

.item-action-btn.delete-btn:hover {
  background: linear-gradient(145deg, #ffcdd2, #ef9a9a) !important;
}

.item-action-btn.minus-btn {
  background: linear-gradient(145deg, #fff8e1, #ffecb3) !important;
}

.item-action-btn.minus-btn:hover {
  background: linear-gradient(145deg, #ffecb3, #ffe082) !important;
}

.item-action-btn.plus-btn {
  background: linear-gradient(145deg, #e8f5e9, #c8e6c9) !important;
}

.item-action-btn.plus-btn:hover {
  background: linear-gradient(145deg, #c8e6c9, #a5d6a7) !important;
}

.item-details-form {
  padding: 10px 5px;
  margin-top: 5px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(25, 118, 210, 0.08);
}

.item-details-form .v-col {
  padding: 8px 12px;
}

.field-with-icon {
  position: relative;
  margin-bottom: 10px;
}

.field-with-icon :deep(.v-icon) {
  color: #1976d2 !important;
  opacity: 0.8;
}
</style>

