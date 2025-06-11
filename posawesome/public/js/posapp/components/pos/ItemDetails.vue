<!-- eslint-disable vue/no-mutating-props -->
<template>
  <td :colspan="headersLength" class="ma-0 pa-2">
    <!-- Expanded Item Action Buttons Row -->
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

    <!-- Expanded Item Details Form Row -->
    <v-row dense class="item-details-form mb-2">
      <!-- First Row -->
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

      <!-- Second Row -->
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

      <!-- Third Row -->
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

      <!-- Fourth Row -->
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

      <!-- Serial Number Fields (if enabled) -->
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

      <!-- Batch Number Fields (if enabled) -->
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

      <!-- Delivery Date (if sales order and order type) -->
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

<script>
export default {
  props: {
    item: Object,
    headersLength: Number,
    pos_profile: Object,
    invoice_doc: Object,
    invoiceType: String,
    expanded: Array,
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
    isReturnInvoice: Boolean
  }
};
</script>
