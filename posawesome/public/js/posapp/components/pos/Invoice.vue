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
import itemMethods from "./invoiceItemMethods";
import shortcutMethods from "./invoiceShortcuts";
import { isOffline, saveCustomerBalance, getCachedCustomerBalance } from "../../../offline";

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
    ...shortcutMethods,
    ...itemMethods,
    makeid(length) {
      let result = "";
      const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
      const charactersLength = characters.length;
      for (var i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * charactersLength)
        );
      }
      return result;
    },

    checkOfferIsAppley(item, offer) {
      let applied = false;
      const item_offers = JSON.parse(item.posa_offers);
      for (const row_id of item_offers) {
        const exist_offer = this.posa_offers.find((el) => row_id == el.row_id);
        if (exist_offer && exist_offer.offer_name == offer.name) {
          applied = true;
          break;
        }
      }
      return applied;
    },

    handelOffers() {
      const offers = [];
      this.posOffers.forEach((offer) => {
        if (offer.apply_on === "Item Code") {
          const itemOffer = this.getItemOffer(offer);
          if (itemOffer) {
            offers.push(itemOffer);
          }
        } else if (offer.apply_on === "Item Group") {
          const groupOffer = this.getGroupOffer(offer);
          if (groupOffer) {
            offers.push(groupOffer);
          }
        } else if (offer.apply_on === "Brand") {
          const brandOffer = this.getBrandOffer(offer);
          if (brandOffer) {
            offers.push(brandOffer);
          }
        } else if (offer.apply_on === "Transaction") {
          const transactionOffer = this.getTransactionOffer(offer);
          if (transactionOffer) {
            offers.push(transactionOffer);
          }
        }
      });

      this.setItemGiveOffer(offers);
      this.updatePosOffers(offers);
    },

    setItemGiveOffer(offers) {
      // Set item give offer for replace
      offers.forEach((offer) => {
        if (
          offer.apply_on == "Item Code" &&
          offer.apply_type == "Item Code" &&
          offer.replace_item
        ) {
          offer.give_item = offer.item;
          offer.apply_item_code = offer.item;
        } else if (
          offer.apply_on == "Item Group" &&
          offer.apply_type == "Item Group" &&
          offer.replace_cheapest_item
        ) {
          const offerItemCode = this.getCheapestItem(offer).item_code;
          offer.give_item = offerItemCode;
          offer.apply_item_code = offerItemCode;
        }
      });
    },

    getCheapestItem(offer) {
      let itemsRowID;
      if (typeof offer.items === "string") {
        itemsRowID = JSON.parse(offer.items);
      } else {
        itemsRowID = offer.items;
      }
      const itemsList = [];
      itemsRowID.forEach((row_id) => {
        itemsList.push(this.getItemFromRowID(row_id));
      });
      const result = itemsList.reduce(function (res, obj) {
        return !obj.posa_is_replace &&
          !obj.posa_is_offer &&
          obj.price_list_rate < res.price_list_rate
          ? obj
          : res;
      });
      return result;
    },

    getItemFromRowID(row_id) {
      const item = this.items.find((el) => el.posa_row_id == row_id);
      return item;
    },

    checkQtyAnountOffer(offer, qty, amount) {
      let min_qty = false;
      let max_qty = false;
      let min_amt = false;
      let max_amt = false;
      const applys = [];

      if (offer.min_qty || offer.min_qty == 0) {
        if (qty >= offer.min_qty) {
          min_qty = true;
        }
        applys.push(min_qty);
      }

      if (offer.max_qty > 0) {
        if (qty <= offer.max_qty) {
          max_qty = true;
        }
        applys.push(max_qty);
      }

      if (offer.min_amt > 0) {
        if (amount >= offer.min_amt) {
          min_amt = true;
        }
        applys.push(min_amt);
      }

      if (offer.max_amt > 0) {
        if (amount <= offer.max_amt) {
          max_amt = true;
        }
        applys.push(max_amt);
      }
      let apply = false;
      if (!applys.includes(false)) {
        apply = true;
      }
      const res = {
        apply: apply,
        conditions: { min_qty, max_qty, min_amt, max_amt },
      };
      return res;
    },

    checkOfferCoupon(offer) {
      if (offer.coupon_based) {
        const coupon = this.posa_coupons.find(
          (el) => offer.name == el.pos_offer
        );
        if (coupon) {
          offer.coupon = coupon.coupon;
          return true;
        } else {
          return false;
        }
      } else {
        offer.coupon = null;
        return true;
      }
    },

    getItemOffer(offer) {
      let apply_offer = null;
      if (offer.apply_on === "Item Code") {
        if (this.checkOfferCoupon(offer)) {
          this.items.forEach((item) => {
            if (!item.posa_is_offer && item.item_code === offer.item) {
              const items = [];
              if (
                offer.offer === "Item Price" &&
                item.posa_offer_applied &&
                !this.checkOfferIsAppley(item, offer)
              ) {
              } else {
                const res = this.checkQtyAnountOffer(
                  offer,
                  item.stock_qty,
                  item.stock_qty * item.price_list_rate
                );
                if (res.apply) {
                  items.push(item.posa_row_id);
                  offer.items = items;
                  apply_offer = offer;
                }
              }
            }
          });
        }
      }
      return apply_offer;
    },

    getGroupOffer(offer) {
      let apply_offer = null;
      if (offer.apply_on === "Item Group") {
        if (this.checkOfferCoupon(offer)) {
          const items = [];
          let total_count = 0;
          let total_amount = 0;
          this.items.forEach((item) => {
            if (!item.posa_is_offer && item.item_group === offer.item_group) {
              if (
                offer.offer === "Item Price" &&
                item.posa_offer_applied &&
                !this.checkOfferIsAppley(item, offer)
              ) {
              } else {
                total_count += item.stock_qty;
                total_amount += item.stock_qty * item.price_list_rate;
                items.push(item.posa_row_id);
              }
            }
          });
          if (total_count || total_amount) {
            const res = this.checkQtyAnountOffer(
              offer,
              total_count,
              total_amount
            );
            if (res.apply) {
              offer.items = items;
              apply_offer = offer;
            }
          }
        }
      }
      return apply_offer;
    },

    getBrandOffer(offer) {
      let apply_offer = null;
      if (offer.apply_on === "Brand") {
        if (this.checkOfferCoupon(offer)) {
          const items = [];
          let total_count = 0;
          let total_amount = 0;
          this.items.forEach((item) => {
            if (!item.posa_is_offer && item.brand === offer.brand) {
              if (
                offer.offer === "Item Price" &&
                item.posa_offer_applied &&
                !this.checkOfferIsAppley(item, offer)
              ) {
              } else {
                total_count += item.stock_qty;
                total_amount += item.stock_qty * item.price_list_rate;
                items.push(item.posa_row_id);
              }
            }
          });
          if (total_count || total_amount) {
            const res = this.checkQtyAnountOffer(
              offer,
              total_count,
              total_amount
            );
            if (res.apply) {
              offer.items = items;
              apply_offer = offer;
            }
          }
        }
      }
      return apply_offer;
    },
    getTransactionOffer(offer) {
      let apply_offer = null;
      if (offer.apply_on === "Transaction") {
        if (this.checkOfferCoupon(offer)) {
          let total_qty = 0;
          this.items.forEach((item) => {
            if (!item.posa_is_offer && !item.posa_is_replace) {
              total_qty += item.stock_qty;
            }
          });
          const items = [];
          const total_count = total_qty;
          const total_amount = this.Total;
          if (total_count || total_amount) {
            const res = this.checkQtyAnountOffer(
              offer,
              total_count,
              total_amount
            );
            if (res.apply) {
              this.items.forEach((item) => {
                items.push(item.posa_row_id);
              });
              offer.items = items;
              apply_offer = offer;
            }
          }
        }
      }
      return apply_offer;
    },

    updatePosOffers(offers) {
      this.eventBus.emit("update_pos_offers", offers);
    },

    updateInvoiceOffers(offers) {
      this.posa_offers.forEach((invoiceOffer) => {
        const existOffer = offers.find(
          (offer) => invoiceOffer.row_id == offer.row_id
        );
        if (!existOffer) {
          this.removeApplyOffer(invoiceOffer);
        }
      });
      offers.forEach((offer) => {
        const existOffer = this.posa_offers.find(
          (invoiceOffer) => invoiceOffer.row_id == offer.row_id
        );
        if (existOffer) {
          existOffer.items = JSON.stringify(offer.items);
          if (
            existOffer.offer === "Give Product" &&
            existOffer.give_item &&
            existOffer.give_item != offer.give_item
          ) {
            const item_to_remove = this.items.find(
              (item) => item.posa_row_id == existOffer.give_item_row_id
            );
            if (item_to_remove) {
              const updated_item_offers = offer.items.filter(
                (row_id) => row_id != item_to_remove.posa_row_id
              );
              offer.items = updated_item_offers;
              this.remove_item(item_to_remove);
              existOffer.give_item_row_id = null;
              existOffer.give_item = null;
            }
            const newItemOffer = this.ApplyOnGiveProduct(offer);
            if (offer.replace_cheapest_item) {
              const cheapestItem = this.getCheapestItem(offer);
              const oldBaseItem = this.items.find(
                (el) => el.posa_row_id == item_to_remove.posa_is_replace
              );
              newItemOffer.qty = item_to_remove.qty;
              if (oldBaseItem && !oldBaseItem.posa_is_replace) {
                oldBaseItem.qty += item_to_remove.qty;
              } else {
                const restoredItem = this.ApplyOnGiveProduct(
                  {
                    given_qty: item_to_remove.qty,
                  },
                  item_to_remove.item_code
                );
                restoredItem.posa_is_offer = 0;
                this.items.unshift(restoredItem);
              }
              newItemOffer.posa_is_offer = 0;
              newItemOffer.posa_is_replace = cheapestItem.posa_row_id;
              const diffQty = cheapestItem.qty - newItemOffer.qty;
              if (diffQty <= 0) {
                newItemOffer.qty += diffQty;
                this.remove_item(cheapestItem);
                newItemOffer.posa_row_id = cheapestItem.posa_row_id;
                newItemOffer.posa_is_replace = newItemOffer.posa_row_id;
              } else {
                cheapestItem.qty = diffQty;
              }
            }
            this.items.unshift(newItemOffer);
            existOffer.give_item_row_id = newItemOffer.posa_row_id;
            existOffer.give_item = newItemOffer.item_code;
          } else if (
            existOffer.offer === "Give Product" &&
            existOffer.give_item &&
            existOffer.give_item == offer.give_item &&
            (offer.replace_item || offer.replace_cheapest_item)
          ) {
            this.$nextTick(function () {
              const offerItem = this.getItemFromRowID(
                existOffer.give_item_row_id
              );
              const diff = offer.given_qty - offerItem.qty;
              if (diff > 0) {
                const itemsRowID = JSON.parse(existOffer.items);
                const itemsList = [];
                itemsRowID.forEach((row_id) => {
                  itemsList.push(this.getItemFromRowID(row_id));
                });
                const existItem = itemsList.find(
                  (el) =>
                    el.item_code == offerItem.item_code &&
                    el.posa_is_replace != offerItem.posa_row_id
                );
                if (existItem) {
                  const diffExistQty = existItem.qty - diff;
                  if (diffExistQty > 0) {
                    offerItem.qty += diff;
                    existItem.qty -= diff;
                  } else {
                    offerItem.qty += existItem.qty;
                    this.remove_item(existItem);
                  }
                }
              }
            });
          } else if (existOffer.offer === "Item Price") {
            this.ApplyOnPrice(offer);
          } else if (existOffer.offer === "Grand Total") {
            this.ApplyOnTotal(offer);
          }
          this.addOfferToItems(existOffer);
        } else {
          this.applyNewOffer(offer);
        }
      });
    },

    removeApplyOffer(invoiceOffer) {
      if (invoiceOffer.offer === "Item Price") {
        this.RemoveOnPrice(invoiceOffer);
        const index = this.posa_offers.findIndex(
          (el) => el.row_id === invoiceOffer.row_id
        );
        this.posa_offers.splice(index, 1);
      }
      if (invoiceOffer.offer === "Give Product") {
        const item_to_remove = this.items.find(
          (item) => item.posa_row_id == invoiceOffer.give_item_row_id
        );
        const index = this.posa_offers.findIndex(
          (el) => el.row_id === invoiceOffer.row_id
        );
        this.posa_offers.splice(index, 1);
        this.remove_item(item_to_remove);
      }
      if (invoiceOffer.offer === "Grand Total") {
        this.RemoveOnTotal(invoiceOffer);
        const index = this.posa_offers.findIndex(
          (el) => el.row_id === invoiceOffer.row_id
        );
        this.posa_offers.splice(index, 1);
      }
      if (invoiceOffer.offer === "Loyalty Point") {
        const index = this.posa_offers.findIndex(
          (el) => el.row_id === invoiceOffer.row_id
        );
        this.posa_offers.splice(index, 1);
      }
      this.deleteOfferFromItems(invoiceOffer);
    },

    applyNewOffer(offer) {
      if (offer.offer === "Item Price") {
        this.ApplyOnPrice(offer);
      }
      if (offer.offer === "Give Product") {
        let itemsRowID;
        if (typeof offer.items === "string") {
          itemsRowID = JSON.parse(offer.items);
        } else {
          itemsRowID = offer.items;
        }
        if (
          offer.apply_on == "Item Code" &&
          offer.apply_type == "Item Code" &&
          offer.replace_item
        ) {
          const item = this.ApplyOnGiveProduct(offer, offer.item);
          item.posa_is_replace = itemsRowID[0];
          const baseItem = this.items.find(
            (el) => el.posa_row_id == item.posa_is_replace
          );
          const diffQty = baseItem.qty - offer.given_qty;
          item.posa_is_offer = 0;
          if (diffQty <= 0) {
            item.qty = baseItem.qty;
            this.remove_item(baseItem);
            item.posa_row_id = item.posa_is_replace;
          } else {
            baseItem.qty = diffQty;
          }
          this.items.unshift(item);
          offer.give_item_row_id = item.posa_row_id;
        } else if (
          offer.apply_on == "Item Group" &&
          offer.apply_type == "Item Group" &&
          offer.replace_cheapest_item
        ) {
          const itemsList = [];
          itemsRowID.forEach((row_id) => {
            itemsList.push(this.getItemFromRowID(row_id));
          });
          const baseItem = itemsList.find(
            (el) => el.item_code == offer.give_item
          );
          const item = this.ApplyOnGiveProduct(offer, offer.give_item);
          item.posa_is_offer = 0;
          item.posa_is_replace = baseItem.posa_row_id;
          const diffQty = baseItem.qty - offer.given_qty;
          if (diffQty <= 0) {
            item.qty = baseItem.qty;
            this.remove_item(baseItem);
            item.posa_row_id = item.posa_is_replace;
          } else {
            baseItem.qty = diffQty;
          }
          this.items.unshift(item);
          offer.give_item_row_id = item.posa_row_id;
        } else {
          const item = this.ApplyOnGiveProduct(offer);
          this.items.unshift(item);
          if (item) {
            offer.give_item_row_id = item.posa_row_id;
          }
        }
      }
      if (offer.offer === "Grand Total") {
        this.ApplyOnTotal(offer);
      }
      if (offer.offer === "Loyalty Point") {
        this.eventBus.emit("show_message", {
          title: __("Loyalty Point Offer Applied"),
          color: "success",
        });
      }

      const newOffer = {
        offer_name: offer.name,
        row_id: offer.row_id,
        apply_on: offer.apply_on,
        offer: offer.offer,
        items: JSON.stringify(offer.items),
        give_item: offer.give_item,
        give_item_row_id: offer.give_item_row_id,
        offer_applied: offer.offer_applied,
        coupon_based: offer.coupon_based,
        coupon: offer.coupon,
      };
      this.posa_offers.push(newOffer);
      this.addOfferToItems(newOffer);
    },

    ApplyOnGiveProduct(offer, item_code) {
      if (!item_code) {
        item_code = offer.give_item;
      }
      const items = this.allItems;
      const item = items.find((item) => item.item_code == item_code);
      if (!item) {
        return;
      }
      const new_item = { ...item };
      new_item.qty = offer.given_qty;
      new_item.stock_qty = offer.given_qty;

      // Handle rate based on currency
      if (offer.discount_type === "Rate") {
        // offer.rate is always in base currency (PKR)
        new_item.base_rate = offer.rate;
        if (this.selected_currency !== this.pos_profile.currency) {
          // If exchange rate is 300 PKR = 1 USD
          // Convert PKR to USD by dividing
          new_item.rate = this.flt(offer.rate / this.exchange_rate, this.currency_precision);
        } else {
          new_item.rate = offer.rate;
        }
      } else {
        // Use item's original rate
        if (this.selected_currency !== this.pos_profile.currency) {
          new_item.base_rate = item.base_rate || (item.rate * this.exchange_rate);
          new_item.rate = item.rate;
        } else {
          new_item.base_rate = item.rate;
          new_item.rate = item.rate;
        }
      }

      // Handle discount amount based on currency
      if (offer.discount_type === "Discount Amount") {
        // offer.discount_amount is always in base currency (PKR)
        new_item.base_discount_amount = offer.discount_amount;
        if (this.selected_currency !== this.pos_profile.currency) {
          // Convert PKR to USD by dividing
          new_item.discount_amount = this.flt(offer.discount_amount / this.exchange_rate, this.currency_precision);
        } else {
          new_item.discount_amount = offer.discount_amount;
        }
      } else {
        new_item.base_discount_amount = 0;
        new_item.discount_amount = 0;
      }

      new_item.discount_percentage = offer.discount_type === "Discount Percentage" ? offer.discount_percentage : 0;
      new_item.discount_amount_per_item = 0;
      new_item.uom = item.uom ? item.uom : item.stock_uom;
      new_item.actual_batch_qty = "";
      new_item.conversion_factor = 1;
      new_item.posa_offers = JSON.stringify([]);
      new_item.posa_offer_applied = 0;
      new_item.posa_is_offer = 1;
      new_item.posa_is_replace = null;
      new_item.posa_notes = "";
      new_item.posa_delivery_date = "";

      // Handle free items
      const is_free = (offer.discount_type === "Rate" && !offer.rate) ||
        (offer.discount_type === "Discount Percentage" && offer.discount_percentage == 100);

      new_item.is_free_item = is_free ? 1 : 0;

      // Set price list rate based on currency
      if (is_free) {
        new_item.base_price_list_rate = 0;
        new_item.price_list_rate = 0;
      } else {
        // item.rate is in base currency (PKR)
        new_item.base_price_list_rate = item.rate;
        if (this.selected_currency !== this.pos_profile.currency) {
          // Convert PKR to USD by dividing
          new_item.price_list_rate = this.flt(item.rate / this.exchange_rate, this.currency_precision);
        } else {
          new_item.price_list_rate = item.rate;
        }
      }

      new_item.posa_row_id = this.makeid(20);

      if ((!this.pos_profile.posa_auto_set_batch && new_item.has_batch_no) || new_item.has_serial_no) {
        this.expanded.push(new_item);
      }

      this.update_item_detail(new_item);
      return new_item;
    },

    ApplyOnPrice(offer) {
      console.log('Applying price offer:', offer);
      if (!offer || !Array.isArray(this.items)) return;

      this.items.forEach((item) => {
        // Check if offer.items exists and is valid
        if (!item || !offer.items || !Array.isArray(offer.items)) return;

        if (offer.items.includes(item.posa_row_id)) {
          // Ensure posa_offers is initialized and valid
          const item_offers = item.posa_offers ? JSON.parse(item.posa_offers) : [];
          if (!Array.isArray(item_offers)) return;

          if (!item_offers.includes(offer.row_id)) {
            // Store original rates only if this is the first offer being applied
            if (!item.posa_offer_applied) {
              // Store original prices normalized to conversion factor 1
              const cf = flt(item.conversion_factor || 1);
              item.original_base_rate = item.base_rate / cf;
              item.original_base_price_list_rate = item.base_price_list_rate / cf;
              item.original_rate = item.rate / cf;
              item.original_price_list_rate = item.price_list_rate / cf;
              console.log('Storing original rates (normalized to conversion factor 1):', {
                original_base_rate: item.original_base_rate,
                original_base_price_list_rate: item.original_base_price_list_rate,
                original_rate: item.original_rate,
                original_price_list_rate: item.original_price_list_rate,
                conversion_factor: cf
              });
            }

            const conversion_factor = flt(item.conversion_factor || 1);

            if (offer.discount_type === "Rate") {
              // offer.rate is always in base currency (e.g. PKR)
              const base_offer_rate = flt(offer.rate * conversion_factor);

              // Set base rates first
              item.base_rate = base_offer_rate;
              item.base_price_list_rate = base_offer_rate;

              // Convert to selected currency if needed
              if (this.selected_currency !== this.pos_profile.currency) {
                // If exchange rate is 285 PKR = 1 USD
                // To convert PKR to USD: divide by exchange rate
                item.rate = this.flt(base_offer_rate / this.exchange_rate, this.currency_precision);
                item.price_list_rate = item.rate;
              } else {
                item.rate = base_offer_rate;
                item.price_list_rate = base_offer_rate;
              }

              // Reset discounts since we're setting rate directly
              item.discount_percentage = 0;
              item.discount_amount = 0;
              item.base_discount_amount = 0;

            } else if (offer.discount_type === "Discount Percentage") {
              item.discount_percentage = offer.discount_percentage;

              // Calculate discount in base currency first
              // Use normalized price * current conversion factor
              const base_price = this.flt(
                (item.original_base_price_list_rate || (item.base_price_list_rate / conversion_factor)) * conversion_factor,
                this.currency_precision
              );
              const base_discount = this.flt((base_price * offer.discount_percentage) / 100, this.currency_precision);
              item.base_discount_amount = base_discount;
              item.base_rate = this.flt(base_price - base_discount, this.currency_precision);
              item.base_price_list_rate = base_price;

              // Convert to selected currency if needed
              if (this.selected_currency !== this.pos_profile.currency) {
                item.price_list_rate = this.flt(base_price / this.exchange_rate, this.currency_precision);
                item.discount_amount = this.flt(base_discount / this.exchange_rate, this.currency_precision);
                item.rate = this.flt(item.base_rate / this.exchange_rate, this.currency_precision);
              } else {
                item.price_list_rate = base_price;
                item.discount_amount = base_discount;
                item.rate = item.base_rate;
              }
            }

            // Calculate final amounts
            item.amount = this.flt(item.qty * item.rate, this.currency_precision);
            item.base_amount = this.flt(item.qty * item.base_rate, this.currency_precision);

            console.log('Updated rates after applying offer:', {
              rate: item.rate,
              base_rate: item.base_rate,
              price_list_rate: item.price_list_rate,
              base_price_list_rate: item.base_price_list_rate,
              discount_amount: item.discount_amount,
              base_discount_amount: item.base_discount_amount,
              amount: item.amount,
              base_amount: item.base_amount
            });

            item.posa_offer_applied = 1;
            this.$forceUpdate();
          }
        }
      });
    },

    RemoveOnPrice(offer) {
      console.log('Removing price offer:', offer);
      if (!offer || !Array.isArray(this.items)) return;

      this.items.forEach((item) => {
        if (!item || !item.posa_offers) return;

        try {
          const item_offers = JSON.parse(item.posa_offers);
          if (!Array.isArray(item_offers)) return;

          if (item_offers.includes(offer.row_id)) {
            console.log('Found item with offer:', item);

            // Check if we have original rates stored
            if (!item.original_base_rate) {
              console.warn('Original rates not found, fetching from server');
              this.update_item_detail(item);
              return;
            }

            // Get current conversion factor
            const cf = flt(item.conversion_factor || 1);

            console.log('Restoring original rates with conversion factor:', {
              original_base_rate: item.original_base_rate,
              original_base_price_list_rate: item.original_base_price_list_rate,
              conversion_factor: cf
            });

            // Restore original rates adjusted for current conversion factor
            item.base_rate = this.flt(item.original_base_rate * cf, this.currency_precision);
            item.base_price_list_rate = this.flt(item.original_base_price_list_rate * cf, this.currency_precision);

            // Convert to selected currency
            if (this.selected_currency !== this.pos_profile.currency) {
              item.rate = this.flt(item.base_rate / this.exchange_rate, this.currency_precision);
              item.price_list_rate = this.flt(item.base_price_list_rate / this.exchange_rate, this.currency_precision);
            } else {
              item.rate = item.base_rate;
              item.price_list_rate = item.base_price_list_rate;
            }

            // Reset all discounts
            item.discount_percentage = 0;
            item.discount_amount = 0;
            item.base_discount_amount = 0;

            // Recalculate amounts
            item.amount = this.flt(item.qty * item.rate, this.currency_precision);
            item.base_amount = this.flt(item.qty * item.base_rate, this.currency_precision);

            // Only clear original rates if no other offers are applied
            const remaining_offers = item_offers.filter(id => id !== offer.row_id);
            if (remaining_offers.length === 0) {
              item.original_base_rate = null;
              item.original_base_price_list_rate = null;
              item.original_rate = null;
              item.original_price_list_rate = null;
              item.posa_offer_applied = 0;
            }

            // Update posa_offers
            item.posa_offers = JSON.stringify(remaining_offers);

            console.log('Updated rates after removing offer:', {
              rate: item.rate,
              base_rate: item.base_rate,
              price_list_rate: item.price_list_rate,
              base_price_list_rate: item.base_price_list_rate,
              amount: item.amount,
              base_amount: item.base_amount,
              remaining_offers: remaining_offers
            });

            // Force UI update
            this.$forceUpdate();
          }
        } catch (error) {
          console.error('Error removing price offer:', error);
          this.eventBus.emit("show_message", {
            title: __("Error removing price offer"),
            color: "error",
            message: error.message
          });
        }
      });
    },

    ApplyOnTotal(offer) {
      if (!offer.name) {
        offer = this.posOffers.find((el) => el.name == offer.offer_name);
      }
      if (
        (!this.discount_percentage_offer_name ||
          this.discount_percentage_offer_name == offer.name) &&
        offer.discount_percentage > 0 &&
        offer.discount_percentage <= 100
      ) {
        this.discount_amount = this.flt(
          (flt(this.Total) * flt(offer.discount_percentage)) / 100,
          this.currency_precision
        );
        this.discount_percentage_offer_name = offer.name;
      }
    },

    RemoveOnTotal(offer) {
      if (
        this.discount_percentage_offer_name &&
        this.discount_percentage_offer_name == offer.offer_name
      ) {
        this.discount_amount = 0;
        this.discount_percentage_offer_name = null;
      }
    },

    addOfferToItems(offer) {
      if (!offer || !offer.items || !Array.isArray(this.items)) return;

      try {
        const offer_items = typeof offer.items === 'string' ? JSON.parse(offer.items) : offer.items;
        if (!Array.isArray(offer_items)) return;

        offer_items.forEach((el) => {
          this.items.forEach((exist_item) => {
            if (!exist_item || !exist_item.posa_row_id) return;

            if (exist_item.posa_row_id == el) {
              const item_offers = exist_item.posa_offers ? JSON.parse(exist_item.posa_offers) : [];
              if (!Array.isArray(item_offers)) return;

              if (!item_offers.includes(offer.row_id)) {
                item_offers.push(offer.row_id);
                if (offer.offer === "Item Price") {
                  exist_item.posa_offer_applied = 1;
                }
              }
              exist_item.posa_offers = JSON.stringify(item_offers);
            }
          });
        });
      } catch (error) {
        console.error('Error adding offer to items:', error);
        this.eventBus.emit("show_message", {
          title: __("Error adding offer to items"),
          color: "error",
          message: error.message
        });
      }
    },

    deleteOfferFromItems(offer) {
      if (!offer || !offer.items || !Array.isArray(this.items)) return;

      try {
        const offer_items = typeof offer.items === 'string' ? JSON.parse(offer.items) : offer.items;
        if (!Array.isArray(offer_items)) return;

        offer_items.forEach((el) => {
          this.items.forEach((exist_item) => {
            if (!exist_item || !exist_item.posa_row_id) return;

            if (exist_item.posa_row_id == el) {
              const item_offers = exist_item.posa_offers ? JSON.parse(exist_item.posa_offers) : [];
              if (!Array.isArray(item_offers)) return;

              const updated_item_offers = item_offers.filter(
                (row_id) => row_id != offer.row_id
              );
              if (offer.offer === "Item Price") {
                exist_item.posa_offer_applied = 0;
              }
              exist_item.posa_offers = JSON.stringify(updated_item_offers);
            }
          });
        });
      } catch (error) {
        console.error('Error deleting offer from items:', error);
        this.eventBus.emit("show_message", {
          title: __("Error deleting offer from items"),
          color: "error",
          message: error.message
        });
      }
    },

    validate_due_date(item) {
      const today = frappe.datetime.now_date();
      const parse_today = Date.parse(today);
      // Convert to backend format for comparison
      const backend_date = this.formatDateForBackend(item.posa_delivery_date);
      const new_date = Date.parse(backend_date);
      if (isNaN(new_date) || new_date < parse_today) {
        setTimeout(() => {
          item.posa_delivery_date = this.formatDateForDisplay(today);
        }, 0);
      } else {
        item.posa_delivery_date = this.formatDateForDisplay(backend_date);
      }
    },
    load_print_page(invoice_name) {
      const print_format =
        this.pos_profile.print_format_for_online ||
        this.pos_profile.print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url =
        frappe.urllib.get_base_url() +
        "/printview?doctype=Sales%20Invoice&name=" +
        invoice_name +
        "&trigger_print=1" +
        "&format=" +
        print_format +
        "&no_letterhead=" +
        letter_head;
      const printWindow = window.open(url, "Print");
      printWindow.addEventListener(
        "load",
        function () {
          printWindow.print();
          // printWindow.close();
          // NOTE : uncomoent this to auto closing printing window
        },
        true
      );
    },

    formatDateForBackend(date) {
      if (!date) return null;
      if (typeof date === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(date)) {
          const [d, m, y] = date.split('-');
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = (`0${d.getMonth() + 1}`).slice(-2);
        const day = (`0${d.getDate()}`).slice(-2);
        return `${year}-${month}-${day}`;
      }
      return date;
    },

    formatDateForDisplay(date) {
      if (!date) return '';
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, m, d] = date.split('-');
        return `${d}-${m}-${y}`;
      }
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = (`0${d.getMonth() + 1}`).slice(-2);
        const day = (`0${d.getDate()}`).slice(-2);
        return `${day}-${month}-${year}`;
      }
      return date;
    },

    toggleOffer(item) {
      this.$nextTick(() => {
        if (!item.posa_is_offer) {
          item.posa_offers = JSON.stringify([]);
          item.posa_offer_applied = 0;
          item.discount_percentage = 0;
          item.discount_amount = 0;
          item.rate = item.price_list_rate;
          this.calc_item_price(item);
          this.handelOffers();
        }
        // Ensure Vue reactivity
        this.$forceUpdate();
      });
    },  // Added missing comma here

    print_draft_invoice() {
      if (!this.pos_profile.posa_allow_print_draft_invoices) {
        this.eventBus.emit("show_message", {
          title: __(`You are not allowed to print draft invoices`),
          color: "error",
        });
        return;
      }
      let invoice_name = this.invoice_doc.name;
      frappe.run_serially([
        () => {
          const invoice_doc = this.save_and_clear_invoice();
          invoice_name = invoice_doc.name ? invoice_doc.name : invoice_name;
        },
        () => {
          this.load_print_page(invoice_name);
        },
      ]);
    },
    set_delivery_charges() {
      var vm = this;
      if (
        !this.pos_profile ||
        !this.customer ||
        !this.pos_profile.posa_use_delivery_charges
      ) {
        this.delivery_charges = [];
        this.delivery_charges_rate = 0;
        this.selected_delivery_charge = "";
        return;
      }
      this.delivery_charges_rate = 0;
      this.selected_delivery_charge = "";
      frappe.call({
        method:
          "posawesome.posawesome.api.posapp.get_applicable_delivery_charges",
        args: {
          company: this.pos_profile.company,
          pos_profile: this.pos_profile.name,
          customer: this.customer,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            if (r.message?.length) {
              console.log(r.message)
              vm.delivery_charges = r.message;
            }
          }
        },
      });
    },
    deliveryChargesFilter(itemText, queryText, itemRow) {
      const item = itemRow.raw;
      console.log("dl charges", item)
      const textOne = item.name.toLowerCase();
      const searchText = queryText.toLowerCase();
      return textOne.indexOf(searchText) > -1;
    },
    update_delivery_charges() {

      if (this.selected_delivery_charge) {
        this.delivery_charges_rate = this.selected_delivery_charge.rate;
      } else {
        this.delivery_charges_rate = 0;
      }
    },
    updatePostingDate(date) {
      if (!date) return;
      this.posting_date = date;
      this.$forceUpdate();
    },
    // Override setFormatedFloat for qty field to handle return mode
    setFormatedQty(item, field_name, precision, no_negative, value) {
      // Use the regular formatter method from the mixin
      let parsedValue = this.setFormatedFloat(item, field_name, precision, no_negative, value);

      // Ensure negative value for return invoices
      if (this.isReturnInvoice && parsedValue > 0) {
        parsedValue = -Math.abs(parsedValue);
        item[field_name] = parsedValue;
      }

      return parsedValue;
    },
    async fetch_available_currencies() {
      try {
        console.log("Fetching available currencies...");
        const r = await frappe.call({
          method: "posawesome.posawesome.api.posapp.get_available_currencies"
        });

        if (r.message) {
          console.log("Received currencies:", r.message);

          // Get base currency for reference
          const baseCurrency = this.pos_profile.currency;

          // Create simple currency list with just names
          this.available_currencies = r.message.map(currency => {
            return {
              value: currency.name,
              title: currency.name
            };
          });

          // Sort currencies - base currency first, then others alphabetically
          this.available_currencies.sort((a, b) => {
            if (a.value === baseCurrency) return -1;
            if (b.value === baseCurrency) return 1;
            return a.value.localeCompare(b.value);
          });

          // Set default currency if not already set
          if (!this.selected_currency) {
            this.selected_currency = baseCurrency;
          }

          return this.available_currencies;
        }

        return [];
      } catch (error) {
        console.error("Error fetching currencies:", error);
        // Set default currency as fallback
        const defaultCurrency = this.pos_profile.currency;
        this.available_currencies = [{
          value: defaultCurrency,
          title: defaultCurrency
        }];
        this.selected_currency = defaultCurrency;
        return this.available_currencies;
      }
    },

    async update_currency(currency) {
      if (!currency) return;
      if (currency === this.pos_profile.currency) {
        this.exchange_rate = 1;
        // Emit currency update
        this.eventBus.emit("update_currency", {
          currency: currency,
          exchange_rate: 1
        });

        // First ensure base rates exist for all items
        this.items.forEach(item => {
          if (!item.base_rate) {
            item.base_rate = item.rate;
            item.base_price_list_rate = item.price_list_rate;
            item.base_discount_amount = item.discount_amount || 0;
          }
        });

        // Then update all item rates
        this.update_item_rates();
        return;
      }

      try {
        console.log('Updating currency exchange rate...');
        console.log('Selected:', currency, 'Base:', this.pos_profile.currency, 'Date:', this.posting_date);

        // First ensure base rates exist for all items
        this.items.forEach(item => {
          if (!item.base_rate) {
            // Store original rates in base currency before switching
            item.base_rate = item.rate;
            item.base_price_list_rate = item.price_list_rate;
            item.base_discount_amount = item.discount_amount || 0;
            console.log(`Stored base rates for ${item.item_code}:`, {
              base_rate: item.base_rate,
              base_price_list_rate: item.base_price_list_rate
            });
          }
        });

        // Get rate from selected to base currency
        const response = await frappe.call({
          method: "erpnext.setup.utils.get_exchange_rate",
          args: {
            from_currency: currency,         // Selected currency (e.g. USD)
            to_currency: this.pos_profile.currency,  // Base currency (e.g. PKR)
            transaction_date: this.posting_date || frappe.datetime.nowdate()
          }
        });

        if (response.message) {
          const rate = response.message;
          // Store the rate directly without inverting
          this.exchange_rate = this.flt(rate, 6);
          console.log("Exchange rate updated:", this.exchange_rate);

          // Emit currency update
          this.eventBus.emit("update_currency", {
            currency: currency,
            exchange_rate: this.exchange_rate
          });

          // Update the currency title in the dropdown to show the rate
          const currencyIndex = this.available_currencies.findIndex(c => c.value === currency);
          if (currencyIndex !== -1) {
            this.available_currencies[currencyIndex].title = `${currency} (1 = ${this.flt(rate, 6)} ${this.pos_profile.currency})`;
            this.available_currencies[currencyIndex].rate = rate;
          }

          // Force update of all items immediately
          this.update_item_rates();

          // Log updated items for debugging
          console.log(`Updated all ${this.items.length} items to currency ${currency} with rate ${rate}`);

          // Show success message
          this.eventBus.emit("show_message", {
            title: __(`Exchange rate updated: 1 ${currency} = ${this.flt(rate, 6)} ${this.pos_profile.currency}`),
            color: "success"
          });
        } else {
          throw new Error("No exchange rate returned");
        }
      } catch (error) {
        console.error("Error updating exchange rate:", error);
        // Reset currency selection to base currency
        this.selected_currency = this.pos_profile.currency;
        this.exchange_rate = 1;

        // Emit currency update for reset
        this.eventBus.emit("update_currency", {
          currency: this.pos_profile.currency,
          exchange_rate: 1
        });

        // Reset the currency title in the dropdown
        const currencyIndex = this.available_currencies.findIndex(c => c.value === currency);
        if (currencyIndex !== -1) {
          this.available_currencies[currencyIndex].title = currency;
          this.available_currencies[currencyIndex].rate = null;
        }

        // Restore all items to base currency rates
        this.update_item_rates();

        this.eventBus.emit("show_message", {
          title: __(`Error: Could not fetch exchange rate from ${currency} to ${this.pos_profile.currency}. Please set up the exchange rate first.`),
          color: "error"
        });
      }
    },

    update_exchange_rate() {
      if (!this.exchange_rate || this.exchange_rate <= 0) {
        this.exchange_rate = 1;
      }

      // Emit currency update
      this.eventBus.emit("update_currency", {
        currency: this.selected_currency || this.pos_profile.currency,
        exchange_rate: this.exchange_rate
      });

      this.update_item_rates();
    },

    update_item_rates() {
      console.log('Updating item rates with exchange rate:', this.exchange_rate);

      this.items.forEach(item => {
        // Set skip flag to avoid double calculations
        item._skip_calc = true;

        // First ensure base rates exist for all items
        if (!item.base_rate) {
          console.log(`Setting base rates for ${item.item_code} for the first time`);
          if (this.selected_currency === this.pos_profile.currency) {
            // When in base currency, base rates = displayed rates
            item.base_rate = item.rate;
            item.base_price_list_rate = item.price_list_rate;
            item.base_discount_amount = item.discount_amount || 0;
          } else {
            // When in another currency, calculate base rates
            item.base_rate = item.rate * this.exchange_rate;
            item.base_price_list_rate = item.price_list_rate * this.exchange_rate;
            item.base_discount_amount = (item.discount_amount || 0) * this.exchange_rate;
          }
        }

        // Currency conversion logic
        if (this.selected_currency === this.pos_profile.currency) {
          // When switching back to default currency, restore from base rates
          console.log(`Restoring rates for ${item.item_code} from base rates`);
          item.price_list_rate = item.base_price_list_rate;
          item.rate = item.base_rate;
          item.discount_amount = item.base_discount_amount;
        } else {
          // When switching to another currency, convert from base rates
          console.log(`Converting rates for ${item.item_code} to ${this.selected_currency}`);

          // If exchange rate is 285 PKR = 1 USD
          // To convert PKR to USD: divide by exchange rate
          // Example: 100 PKR / 285 = 0.35 USD
          const converted_price = this.flt(item.base_price_list_rate / this.exchange_rate, this.currency_precision);
          const converted_rate = this.flt(item.base_rate / this.exchange_rate, this.currency_precision);
          const converted_discount = this.flt(item.base_discount_amount / this.exchange_rate, this.currency_precision);

          // Ensure we don't set values to 0 if they're just very small
          item.price_list_rate = converted_price < 0.000001 ? 0 : converted_price;
          item.rate = converted_rate < 0.000001 ? 0 : converted_rate;
          item.discount_amount = converted_discount < 0.000001 ? 0 : converted_discount;
        }

        // Always recalculate final amounts
        item.amount = this.flt(item.qty * item.rate, this.currency_precision);
        item.base_amount = this.flt(item.qty * item.base_rate, this.currency_precision);

        console.log(`Updated rates for ${item.item_code}:`, {
          price_list_rate: item.price_list_rate,
          base_price_list_rate: item.base_price_list_rate,
          rate: item.rate,
          base_rate: item.base_rate,
          discount: item.discount_amount,
          base_discount: item.base_discount_amount,
          amount: item.amount,
          base_amount: item.base_amount,
        });

        // Apply any other pricing rules if needed
        this.calc_item_price(item);
      });

      // Force UI update after all calculations
      this.$forceUpdate();
    },

    formatCurrency(value) {
      if (!value) return "0.00";

      // Convert to absolute value for comparison
      const absValue = Math.abs(value);

      // Determine precision based on value size
      let precision;
      if (absValue >= 1) {
        // Normal values use standard precision (2)
        precision = 2;
      } else if (absValue >= 0.01) {
        // Small values between 0.01 and 1 use 4 decimal places
        precision = 4;
      } else {
        // Very small values use higher precision (6)
        precision = 6;
      }

      // Format the number with determined precision
      const formattedValue = this.flt(value, precision).toFixed(precision);

      // Remove trailing zeros after decimal point while keeping at least 2 decimals
      const parts = formattedValue.split('.');
      if (parts.length === 2) {
        const decimalPart = parts[1].replace(/0+$/, '');
        if (decimalPart.length < 2) {
          return `${parts[0]}.${decimalPart.padEnd(2, '0')}`;
        }
        return `${parts[0]}.${decimalPart}`;
      }

      return formattedValue;
    },

    flt(value, precision = null) {
      // Enhanced float handling for small numbers
      if (precision === null) {
        precision = this.float_precision;
      }

      const _value = Number(value);
      if (isNaN(_value)) {
        return 0;
      }

      // Handle very small numbers to prevent them from becoming 0
      if (Math.abs(_value) < 0.000001) {
        return _value;
      }

      return Number((_value || 0).toFixed(precision));
    },

    // Update currency and exchange rate when currency is changed
    async update_currency_and_rate() {
      if (this.selected_currency) {
        const doc = this.get_invoice_doc();
        doc.currency = this.selected_currency;

        try {
          const response = await this.update_invoice(doc);
          if (response && response.conversion_rate) {
            this.exchange_rate = response.conversion_rate;
            this.sync_exchange_rate();
          }
        } catch (error) {
          console.error("Error updating currency:", error);
          this.eventBus.emit("show_message", {
            text: "Error updating currency",
            color: "error",
          });
        }
      }
    },

    async update_exchange_rate_on_server() {
      if (this.exchange_rate) {
        const doc = this.get_invoice_doc();
        doc.conversion_rate = this.exchange_rate;
        try {
          await this.update_invoice(doc);
          this.sync_exchange_rate();
        } catch (error) {
          console.error("Error updating exchange rate:", error);
          this.eventBus.emit("show_message", {
            text: "Error updating exchange rate",
            color: "error",
          });
        }
      }
    },

    sync_exchange_rate() {
      if (!this.exchange_rate || this.exchange_rate <= 0) {
        this.exchange_rate = 1;
      }

      // Emit currency update
      this.eventBus.emit("update_currency", {
        currency: this.selected_currency || this.pos_profile.currency,
        exchange_rate: this.exchange_rate
      });

      this.update_item_rates();
    },

    // Add new rounding function
    roundAmount(amount) {
      // If multi-currency is enabled and selected currency is different from base currency
      if (this.pos_profile.posa_allow_multi_currency &&
        this.selected_currency !== this.pos_profile.currency) {
        // For multi-currency, just keep 2 decimal places without rounding to nearest integer
        return this.flt(amount, 2);
      }
      // For base currency or when multi-currency is disabled, round to nearest integer
      return Math.round(amount);
    },

    // Increase quantity of an item (handles return logic)
    add_one(item) {
      // Increase quantity, return items remain negative
      item.qty++;
      if (item.qty == 0) {
        this.remove_item(item);
      }
      this.calc_stock_qty(item, item.qty);
      this.$forceUpdate();
    },

    // Decrease quantity of an item (handles return logic)
    subtract_one(item) {
      // Decrease quantity, return items remain negative
      item.qty--;
      if (item.qty == 0) {
        this.remove_item(item);
      }
      this.calc_stock_qty(item, item.qty);
      this.$forceUpdate();
    },
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