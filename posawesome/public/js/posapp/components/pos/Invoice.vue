<template>
  <!-- Main Invoice Wrapper -->
  <div class="pa-0">
    <!-- Cancel Sale Confirmation Dialog -->
    <CancelSaleDialog v-model="cancel_dialog" @confirm="cancel_invoice" />

    <!-- Main Invoice Card (contains all invoice content) -->
    <v-card :style="{ height: 'var(--container-height)', maxHeight: 'var(--container-height)' }"
      :class="['cards my-0 py-0 mt-3 bg-grey-lighten-5', { 'return-mode': isReturnInvoice }]">

      <!-- Dynamic padding wrapper -->
      <div class="dynamic-padding">
        <!-- Top Row: Customer Selection and Invoice Type -->
        <v-row align="center" class="items px-3 py-2">
          <v-col :cols="pos_profile.posa_allow_sales_order ? 9 : 12" class="pb-0 pr-0">
            <!-- Customer selection component -->
            <Customer />
          </v-col>
          <!-- Invoice Type Selection (Only shown if sales orders are allowed) -->
          <v-col v-if="pos_profile.posa_allow_sales_order" cols="3" class="pb-0">
            <v-select density="compact" hide-details variant="outlined" color="primary" bg-color="white"
              :items="invoiceTypes" :label="frappe._('Type')" v-model="invoiceType"
              :disabled="invoiceType == 'Return'"></v-select>
          </v-col>
        </v-row>

        <!-- Delivery Charges Section (Only if enabled in POS profile) -->
        <DeliveryCharges
          :pos_profile="pos_profile"
          :delivery_charges="delivery_charges"
          :selected_delivery_charge="selected_delivery_charge"
          :delivery_charges_rate="delivery_charges_rate"
          :deliveryChargesFilter="deliveryChargesFilter"
          :formatCurrency="formatCurrency"
          :currencySymbol="currencySymbol"
          :readonly="readonly"
          @update:selected_delivery_charge="(val) => { selected_delivery_charge = val; update_delivery_charges(); }"
        />

        <!-- Posting Date and Customer Balance Section -->
        <PostingDateRow
          :pos_profile="pos_profile"
          :posting_date_display="posting_date_display"
          :customer_balance="customer_balance"
          :formatCurrency="formatCurrency"
          @update:posting_date_display="(val) => { posting_date_display = val; }"
        />

        <!-- Multi-Currency Section (Only if enabled in POS profile) -->
        <MultiCurrencyRow
          :pos_profile="pos_profile"
          :selected_currency="selected_currency"
          :exchange_rate="exchange_rate"
          :available_currencies="available_currencies"
          :isNumber="isNumber"
          @update:selected_currency="(val) => { selected_currency = val; update_currency(val); }"
          @update:exchange_rate="(val) => { exchange_rate = val; update_exchange_rate(); }"
        />

        <!-- Items Table Section (Main items list for invoice) -->
        <ItemsTable
          :headers="items_headers"
          :items="items"
          :expanded="expanded"
          :itemsPerPage="itemsPerPage"
          :itemSearch="itemSearch"
          :pos_profile="pos_profile"
          :invoice_doc="invoice_doc"
          :invoiceType="invoiceType"
          :displayCurrency="displayCurrency"
          :formatFloat="formatFloat"
          :formatCurrency="formatCurrency"
          :currencySymbol="currencySymbol"
          :isNumber="isNumber"
          :setFormatedQty="setFormatedQty"
          :calcStockQty="calc_stock_qty"
          :setFormatedCurrency="setFormatedCurrency"
          :calcPrices="calc_prices"
          :calcUom="calc_uom"
          :setSerialNo="set_serial_no"
          :setBatchQty="set_batch_qty"
          :validateDueDate="validate_due_date"
          :removeItem="remove_item"
          :subtractOne="subtract_one"
          :addOne="add_one"
          :isReturnInvoice="isReturnInvoice"
          :toggleOffer="toggleOffer"
          @update:expanded="handleExpandedUpdate"
        />
      </div>
    </v-card>
    <!-- Payment Section -->
    <InvoiceSummary
      :pos_profile="pos_profile"
      :total_qty="total_qty"
      :additional_discount="additional_discount"
      :additional_discount_percentage="additional_discount_percentage"
      :total_items_discount_amount="total_items_discount_amount"
      :subtotal="subtotal"
      :displayCurrency="displayCurrency"
      :formatFloat="formatFloat"
      :formatCurrency="formatCurrency"
      :currencySymbol="currencySymbol"
      :discount_percentage_offer_name="discount_percentage_offer_name"
      :isNumber="isNumber"
      @update:additional_discount="val => additional_discount = val"
      @update:additional_discount_percentage="val => additional_discount_percentage = val"
      @update_discount_umount="update_discount_umount"
      @save-and-clear="save_and_clear_invoice"
      @load-drafts="get_draft_invoices"
      @select-order="get_draft_orders"
      @cancel-sale="cancel_dialog = true"
      @open-returns="open_returns"
      @print-draft="print_draft_invoice"
      @show-payment="show_payment"
    />
  </div>
</template>

<script>

import format from "../../format";
import Customer from "./Customer.vue";
import DeliveryCharges from "./DeliveryCharges.vue";
import PostingDateRow from "./PostingDateRow.vue";
import MultiCurrencyRow from "./MultiCurrencyRow.vue";
import CancelSaleDialog from "./CancelSaleDialog.vue";
import InvoiceSummary from "./InvoiceSummary.vue";
import ItemsTable from "./ItemsTable.vue";
import invoiceComputed from "./invoiceComputed";
import invoiceWatchers from "./invoiceWatchers";
import { isOffline, saveCustomerBalance, getCachedCustomerBalance } from "../../../offline";

import itemMethods from "./methods/items";
import offerMethods from "./methods/offers";
import utilMethods from "./methods/utils";
export default {
  name: 'POSInvoice',
  mixins: [format],
  data() {
    return {
      // POS profile settings
      pos_profile: "",
      pos_opening_shift: "",
      stock_settings: "",
      invoice_doc: "",
      return_doc: "",
      customer: "",
      customer_info: "",
      customer_balance: 0,
      discount_amount: 0,
      additional_discount: 0,
      additional_discount_percentage: 0,
      total_tax: 0,
      items: [], // List of invoice items
      posOffers: [], // All available offers
      posa_offers: [], // Offers applied to this invoice
      posa_coupons: [], // Coupons applied
      allItems: [], // All items for offer logic
      discount_percentage_offer_name: null, // Track which offer is applied
      invoiceTypes: ["Invoice", "Order"], // Types of invoices
      invoiceType: "Invoice", // Current invoice type
      itemsPerPage: 1000, // Items per page in table
      expanded: [], // Array of expanded row IDs
      singleExpand: true, // Only one row expanded at a time
      cancel_dialog: false, // Cancel dialog visibility
      float_precision: 6, // Float precision for calculations
      currency_precision: 6, // Currency precision for display
      new_line: false, // Add new line for item
      delivery_charges: [], // List of delivery charges
      delivery_charges_rate: 0, // Selected delivery charge rate
      selected_delivery_charge: "", // Selected delivery charge object
      invoice_posting_date: false, // Posting date dialog
      posting_date: frappe.datetime.nowdate(), // Invoice posting date
      posting_date_display: '', // Display value for date picker
      items_headers: [
        // Table headers for items
        {
          title: __("Name"),
          align: "start",
          sortable: true,
          key: "item_name",
        },
        { title: __("QTY"), key: "qty", align: "center" },
        { title: __("UOM"), key: "uom", align: "center" },
        { title: __("Rate"), key: "rate", align: "center" },
        { title: __("Amount"), key: "amount", align: "center" },
        { title: __("Offer?"), key: "posa_is_offer", align: "center" },
      ],
      selected_currency: "", // Currently selected currency
      exchange_rate: 1, // Current exchange rate
      available_currencies: [], // List of available currencies
    };
  },

  components: {
    Customer,
    DeliveryCharges,
    PostingDateRow,
    MultiCurrencyRow,
    InvoiceSummary,
    CancelSaleDialog,
    ItemsTable,
  },
  computed: invoiceComputed,
  methods: {
    ...itemMethods,
    ...offerMethods,
    ...utilMethods,
  },


  mounted() {
    // Register event listeners for POS profile, items, customer, offers, etc.
    this.eventBus.on("register_pos_profile", (data) => {
      this.pos_profile = data.pos_profile;
      this.customer = data.pos_profile.customer;
      this.pos_opening_shift = data.pos_opening_shift;
      this.stock_settings = data.stock_settings;
      // Increase precision for better handling of small amounts
      this.float_precision = 6;  // Changed from 2 to 6
      this.currency_precision = 6;  // Changed from 2 to 6
      this.invoiceType = this.pos_profile.posa_default_sales_order
        ? "Order"
        : "Invoice";

      // Add this block to handle currency initialization
      if (this.pos_profile.posa_allow_multi_currency) {
        this.fetch_available_currencies().then(() => {
          // Set default currency after currencies are loaded
          this.selected_currency = this.pos_profile.currency;
          this.exchange_rate = 1;
        }).catch(error => {
          console.error("Error initializing currencies:", error);
          this.eventBus.emit("show_message", {
            title: __("Error loading currencies"),
            color: "error"
          });
        });
      }
    });
    this.eventBus.on("add_item", this.add_item);
    this.eventBus.on("update_customer", (customer) => {
      this.customer = customer;
    });
    this.eventBus.on("fetch_customer_details", () => {
      this.fetch_customer_details();
    });
    this.eventBus.on("clear_invoice", () => {
      this.clear_invoice();
    });
    this.eventBus.on("load_invoice", (data) => {
      this.load_invoice(data);
    });
    this.eventBus.on("load_order", (data) => {
      this.new_order(data);
      // this.eventBus.emit("set_pos_coupons", data.posa_coupons);
    });
    this.eventBus.on("set_offers", (data) => {
      this.posOffers = data;
    });
    this.eventBus.on("update_invoice_offers", (data) => {
      this.updateInvoiceOffers(data);
    });
    this.eventBus.on("update_invoice_coupons", (data) => {
      this.posa_coupons = data;
      this.handelOffers();
    });
    this.eventBus.on("set_all_items", (data) => {
      this.allItems = data;
      this.items.forEach((item) => {
        this.update_item_detail(item);
      });
    });
    this.eventBus.on("load_return_invoice", (data) => {
      // Handle loading of return invoice and set all related fields
      console.log("Invoice component received load_return_invoice event with data:", data);
      this.load_invoice(data.invoice_doc);
      // Explicitly mark as return invoice
      this.invoiceType = "Return";
      this.invoiceTypes = ["Return"];
      this.invoice_doc.is_return = 1;
      // Ensure negative values for returns
      if (this.items && this.items.length) {
        this.items.forEach(item => {
          // Ensure item quantities are negative
          if (item.qty > 0) item.qty = -Math.abs(item.qty);
          if (item.stock_qty > 0) item.stock_qty = -Math.abs(item.stock_qty);
        });
      }
      if (data.return_doc) {
        console.log("Return against existing invoice:", data.return_doc.name);
        // Ensure negative discount amounts
        this.discount_amount = data.return_doc.discount_amount > 0 ?
          -Math.abs(data.return_doc.discount_amount) :
          data.return_doc.discount_amount;
        this.additional_discount_percentage = data.return_doc.additional_discount_percentage > 0 ?
          -Math.abs(data.return_doc.additional_discount_percentage) :
          data.return_doc.additional_discount_percentage;
        this.return_doc = data.return_doc;
        // Set return_against reference
        this.invoice_doc.return_against = data.return_doc.name;
      } else {
        console.log("Return without invoice reference");
        // For return without invoice, reset discount values
        this.discount_amount = 0;
        this.additional_discount_percentage = 0;
      }
      console.log("Invoice state after loading return:", {
        invoiceType: this.invoiceType,
        is_return: this.invoice_doc.is_return,
        items: this.items.length,
        customer: this.customer
      });
    });
    this.eventBus.on("set_new_line", (data) => {
      this.new_line = data;
    });
    if (this.pos_profile.posa_allow_multi_currency) {
      this.fetch_available_currencies();
    }
    // Listen for reset_posting_date to reset posting date after invoice submission
    this.eventBus.on("reset_posting_date", () => {
      this.posting_date = frappe.datetime.nowdate();
    });
    this.eventBus.on("open_variants_model", this.open_variants_model);
    this.eventBus.on("calc_uom", this.calc_uom);
  },
  // Cleanup event listeners before component is destroyed
  beforeUnmount() {
    // Existing cleanup
    this.eventBus.off("register_pos_profile");
    this.eventBus.off("add_item");
    this.eventBus.off("update_customer");
    this.eventBus.off("fetch_customer_details");
    this.eventBus.off("clear_invoice");
    // Cleanup reset_posting_date listener
    this.eventBus.off("reset_posting_date");
  },
  // Register global keyboard shortcuts when component is created
  created() {
    document.addEventListener("keydown", this.shortOpenPayment.bind(this));
    document.addEventListener("keydown", this.shortDeleteFirstItem.bind(this));
    document.addEventListener("keydown", this.shortOpenFirstItem.bind(this));
    document.addEventListener("keydown", this.shortSelectDiscount.bind(this));
  },
  // Remove global keyboard shortcuts when component is unmounted
  unmounted() {
    document.removeEventListener("keydown", this.shortOpenPayment);
    document.removeEventListener("keydown", this.shortDeleteFirstItem);
    document.removeEventListener("keydown", this.shortOpenFirstItem);
    document.removeEventListener("keydown", this.shortSelectDiscount);
  },
  watch: invoiceWatchers,
};
</script>

<style scoped>
/* Style for selected checkbox button */
.v-checkbox-btn.v-selected {
  background-color: #4CAF50 !important;
  color: white;
}

/* Bottom border for elements */
.border_line_bottom {
  border-bottom: 1px solid lightgray;
}

/* Disable pointer events for elements */
.disable-events {
  pointer-events: none;
}

/* Style for customer balance field */
.balance-field {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* Style for balance value text */
.balance-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #d32f2f;
  margin-left: 5px;
}

/* Styles for date picker buttons */
.v-date-picker .v-btn {
  min-width: 80px !important;
  margin: 0 4px !important;
  text-transform: none !important;
  font-weight: 500 !important;
}

/* Style for text variant date picker button */
.v-date-picker .v-btn--variant-text {
  padding: 0 12px !important;
}

/* Spacer inside date picker */
.v-date-picker .v-spacer {
  flex: 1 1 auto !important;
}

/* Updated style for date picker action buttons */
.date-action-btn {
  min-width: 64px !important;
  height: 36px !important;
  margin: 4px !important;
  padding: 0 16px !important;
  text-transform: none !important;
  font-weight: 500 !important;
  font-size: 14px !important;
  letter-spacing: 0.25px !important;
}

/* Card style for date picker */
.v-date-picker {
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
}

/* Actions section in date picker card */
.v-date-picker .v-card-actions {
  padding: 8px !important;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

/* Red border and label for return mode card */
.return-mode {
  border: 2px solid #ff5252 !important;
  position: relative;
}

/* Label for return mode card */
.return-mode::before {
  content: 'RETURN';
  position: absolute;
  top: 0;
  right: 0;
  background-color: #ff5252;
  color: white;
  padding: 4px 12px;
  font-weight: bold;
  border-bottom-left-radius: 8px;
  z-index: 1;
}


/* Media query for responsive table height */
@media (max-height: 900px) {
  .my-2.py-0.overflow-y-auto {
    height: calc(100vh - 240px);
  }
}

@media (max-height: 700px) {
  .my-2.py-0.overflow-y-auto {
    height: calc(100vh - 220px);
  }
}

/* Dynamic padding for responsive layout */
.dynamic-padding {
  padding: var(--dynamic-xs) var(--dynamic-sm) var(--dynamic-xs) var(--dynamic-sm);
}

/* Responsive breakpoints */
@media (max-width: 768px) {
  .dynamic-padding {
    padding: var(--dynamic-xs) var(--dynamic-xs) var(--dynamic-xs) var(--dynamic-xs);
  }

  .dynamic-padding .v-row {
    margin: 0 -2px;
  }

  .dynamic-padding .v-col {
    padding: 2px 4px;
  }
}

@media (max-width: 480px) {
  .dynamic-padding {
    padding: var(--dynamic-xs) var(--dynamic-xs) var(--dynamic-xs) var(--dynamic-xs);
  }

  .dynamic-padding .v-row {
    margin: 0 -1px;
  }

  .dynamic-padding .v-col {
    padding: 1px 2px;
  }
}
</style>