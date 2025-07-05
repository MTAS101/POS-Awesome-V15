import { silentPrint } from "../plugins/print.js";

export function useOffers() {
  
  const checkOfferIsAppley = (item, offer, posa_offers) => {
    let applied = false;
    const item_offers = JSON.parse(item.posa_offers);
    for (const row_id of item_offers) {
      const exist_offer = posa_offers.find((el) => row_id == el.row_id);
      if (exist_offer && exist_offer.offer_name == offer.name) {
        applied = true;
        break;
      }
    }
    return applied;
  };

  const handelOffers = (context) => {
    const offers = [];
    context.posOffers.forEach((offer) => {
      if (offer.apply_on === "Item Code") {
        const itemOffer = getItemOffer(offer, context);
        if (itemOffer) {
          offers.push(itemOffer);
        }
      } else if (offer.apply_on === "Item Group") {
        const groupOffer = getGroupOffer(offer, context);
        if (groupOffer) {
          offers.push(groupOffer);
        }
      } else if (offer.apply_on === "Brand") {
        const brandOffer = getBrandOffer(offer, context);
        if (brandOffer) {
          offers.push(brandOffer);
        }
      } else if (offer.apply_on === "Transaction") {
        const transactionOffer = getTransactionOffer(offer, context);
        if (transactionOffer) {
          offers.push(transactionOffer);
        }
      }
    });

    setItemGiveOffer(offers, context);
    updatePosOffers(offers, context);
  };

  const setItemGiveOffer = (offers, context) => {
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
        const offerItemCode = getCheapestItem(offer, context).item_code;
        offer.give_item = offerItemCode;
        offer.apply_item_code = offerItemCode;
      }
    });
  };

  const getCheapestItem = (offer, context) => {
    let itemsRowID;
    if (typeof offer.items === "string") {
      itemsRowID = JSON.parse(offer.items);
    } else {
      itemsRowID = offer.items;
    }
    const itemsList = [];
    itemsRowID.forEach((row_id) => {
      itemsList.push(getItemFromRowID(row_id, context));
    });
    const result = itemsList.reduce(function (res, obj) {
      return !obj.posa_is_replace &&
        !obj.posa_is_offer &&
        obj.price_list_rate < res.price_list_rate
        ? obj
        : res;
    });
    return result;
  };

  const getItemFromRowID = (row_id, context) => {
    const item = context.items.find((el) => el.posa_row_id == row_id);
    return item;
  };

  const checkQtyAnountOffer = (offer, qty, amount) => {
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
  };

  const checkOfferCoupon = (offer, posa_coupons) => {
    if (offer.coupon_based) {
      const coupon = posa_coupons.find(
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
  };

  const getItemOffer = (offer, context) => {
    let apply_offer = null;
    if (offer.apply_on === "Item Code") {
      if (checkOfferCoupon(offer, context.posa_coupons)) {
        context.items.forEach((item) => {
          if (!item.posa_is_offer && item.item_code === offer.item) {
            const items = [];
            if (
              offer.offer === "Item Price" &&
              item.posa_offer_applied &&
              !checkOfferIsAppley(item, offer, context.posa_offers)
            ) {
            } else {
              const res = checkQtyAnountOffer(
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
  };

  const getGroupOffer = (offer, context) => {
    let apply_offer = null;
    if (offer.apply_on === "Item Group") {
      if (checkOfferCoupon(offer, context.posa_coupons)) {
        const items = [];
        let total_count = 0;
        let total_amount = 0;
        context.items.forEach((item) => {
          if (!item.posa_is_offer && item.item_group === offer.item_group) {
            if (
              offer.offer === "Item Price" &&
              item.posa_offer_applied &&
              !checkOfferIsAppley(item, offer, context.posa_offers)
            ) {
            } else {
              total_count += item.stock_qty;
              total_amount += item.stock_qty * item.price_list_rate;
              items.push(item.posa_row_id);
            }
          }
        });
        if (total_count || total_amount) {
          const res = checkQtyAnountOffer(
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
  };

  const getBrandOffer = (offer, context) => {
    let apply_offer = null;
    if (offer.apply_on === "Brand") {
      if (checkOfferCoupon(offer, context.posa_coupons)) {
        const items = [];
        let total_count = 0;
        let total_amount = 0;
        context.items.forEach((item) => {
          if (!item.posa_is_offer && item.brand === offer.brand) {
            if (
              offer.offer === "Item Price" &&
              item.posa_offer_applied &&
              !checkOfferIsAppley(item, offer, context.posa_offers)
            ) {
            } else {
              total_count += item.stock_qty;
              total_amount += item.stock_qty * item.price_list_rate;
              items.push(item.posa_row_id);
            }
          }
        });
        if (total_count || total_amount) {
          const res = checkQtyAnountOffer(
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
  };

  const getTransactionOffer = (offer, context) => {
    let apply_offer = null;
    if (offer.apply_on === "Transaction") {
      if (checkOfferCoupon(offer, context.posa_coupons)) {
        let total_qty = 0;
        context.items.forEach((item) => {
          if (!item.posa_is_offer && !item.posa_is_replace) {
            total_qty += item.stock_qty;
          }
        });
        const items = [];
        const total_count = total_qty;
        const total_amount = context.Total;
        if (total_count || total_amount) {
          const res = checkQtyAnountOffer(
            offer,
            total_count,
            total_amount
          );
          if (res.apply) {
            context.items.forEach((item) => {
              items.push(item.posa_row_id);
            });
            offer.items = items;
            apply_offer = offer;
          }
        }
      }
    }
    return apply_offer;
  };

  const updatePosOffers = (offers, context) => {
    context.eventBus.emit("update_pos_offers", offers);
  };

  const updateInvoiceOffers = (offers, context) => {
    context.posa_offers.forEach((invoiceOffer) => {
      const existOffer = offers.find(
        (offer) => invoiceOffer.row_id == offer.row_id
      );
      if (!existOffer) {
        removeApplyOffer(invoiceOffer, context);
      }
    });
    offers.forEach((offer) => {
      const existOffer = context.posa_offers.find(
        (invoiceOffer) => invoiceOffer.row_id == offer.row_id
      );
      if (existOffer) {
        existOffer.items = JSON.stringify(offer.items);
        if (
          existOffer.offer === "Give Product" &&
          existOffer.give_item &&
          existOffer.give_item != offer.give_item
        ) {
          const item_to_remove = context.items.find(
            (item) => item.posa_row_id == existOffer.give_item_row_id
          );
          if (item_to_remove) {
            const updated_item_offers = offer.items.filter(
              (row_id) => row_id != item_to_remove.posa_row_id
            );
            offer.items = updated_item_offers;
            context.remove_item(item_to_remove);
            existOffer.give_item_row_id = null;
            existOffer.give_item = null;
          }
          const newItemOffer = ApplyOnGiveProduct(offer, context);
          if (offer.replace_cheapest_item) {
            const cheapestItem = getCheapestItem(offer, context);
            const oldBaseItem = context.items.find(
              (el) => el.posa_row_id == item_to_remove.posa_is_replace
            );
            newItemOffer.qty = item_to_remove.qty;
            if (oldBaseItem && !oldBaseItem.posa_is_replace) {
              oldBaseItem.qty += item_to_remove.qty;
            } else {
              const restoredItem = ApplyOnGiveProduct(
                {
                  given_qty: item_to_remove.qty,
                },
                context,
                item_to_remove.item_code
              );
              restoredItem.posa_is_offer = 0;
              context.items.unshift(restoredItem);
            }
            newItemOffer.posa_is_offer = 0;
            newItemOffer.posa_is_replace = cheapestItem.posa_row_id;
            const diffQty = cheapestItem.qty - newItemOffer.qty;
            if (diffQty <= 0) {
              newItemOffer.qty += diffQty;
              context.remove_item(cheapestItem);
              newItemOffer.posa_row_id = cheapestItem.posa_row_id;
              newItemOffer.posa_is_replace = newItemOffer.posa_row_id;
            } else {
              cheapestItem.qty = diffQty;
            }
          }
          context.items.unshift(newItemOffer);
          existOffer.give_item_row_id = newItemOffer.posa_row_id;
          existOffer.give_item = newItemOffer.item_code;
        } else if (
          existOffer.offer === "Give Product" &&
          existOffer.give_item &&
          existOffer.give_item == offer.give_item &&
          (offer.replace_item || offer.replace_cheapest_item)
        ) {
          context.$nextTick(function () {
            const offerItem = getItemFromRowID(
              existOffer.give_item_row_id,
              context
            );
            const diff = offer.given_qty - offerItem.qty;
            if (diff > 0) {
              const itemsRowID = JSON.parse(existOffer.items);
              const itemsList = [];
              itemsRowID.forEach((row_id) => {
                itemsList.push(getItemFromRowID(row_id, context));
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
                  context.remove_item(existItem);
                }
              }
            }
          });
        } else if (existOffer.offer === "Item Price") {
          ApplyOnPrice(offer, context);
        } else if (existOffer.offer === "Grand Total") {
          ApplyOnTotal(offer, context);
        }
        addOfferToItems(existOffer, context);
      } else {
        applyNewOffer(offer, context);
      }
    });
  };

  const removeApplyOffer = (invoiceOffer, context) => {
    if (invoiceOffer.offer === "Item Price") {
      RemoveOnPrice(invoiceOffer, context);
      const index = context.posa_offers.findIndex(
        (el) => el.row_id === invoiceOffer.row_id
      );
      context.posa_offers.splice(index, 1);
    }
    if (invoiceOffer.offer === "Give Product") {
      const item_to_remove = context.items.find(
        (item) => item.posa_row_id == invoiceOffer.give_item_row_id
      );
      const index = context.posa_offers.findIndex(
        (el) => el.row_id === invoiceOffer.row_id
      );
      context.posa_offers.splice(index, 1);
      context.remove_item(item_to_remove);
    }
    if (invoiceOffer.offer === "Grand Total") {
      RemoveOnTotal(invoiceOffer, context);
      const index = context.posa_offers.findIndex(
        (el) => el.row_id === invoiceOffer.row_id
      );
      context.posa_offers.splice(index, 1);
    }
    if (invoiceOffer.offer === "Loyalty Point") {
      const index = context.posa_offers.findIndex(
        (el) => el.row_id === invoiceOffer.row_id
      );
      context.posa_offers.splice(index, 1);
    }
    deleteOfferFromItems(invoiceOffer, context);
  };

  const applyNewOffer = (offer, context) => {
    if (offer.offer === "Item Price") {
      ApplyOnPrice(offer, context);
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
        const item = ApplyOnGiveProduct(offer, context, offer.item);
        item.posa_is_replace = itemsRowID[0];
        const baseItem = context.items.find(
          (el) => el.posa_row_id == item.posa_is_replace
        );
        const diffQty = baseItem.qty - offer.given_qty;
        item.posa_is_offer = 0;
        if (diffQty <= 0) {
          item.qty = baseItem.qty;
          context.remove_item(baseItem);
          item.posa_row_id = item.posa_is_replace;
        } else {
          baseItem.qty = diffQty;
        }
        context.items.unshift(item);
        offer.give_item_row_id = item.posa_row_id;
      } else if (
        offer.apply_on == "Item Group" &&
        offer.apply_type == "Item Group" &&
        offer.replace_cheapest_item
      ) {
        const itemsList = [];
        itemsRowID.forEach((row_id) => {
          itemsList.push(getItemFromRowID(row_id, context));
        });
        const baseItem = itemsList.find(
          (el) => el.item_code == offer.give_item
        );
        const item = ApplyOnGiveProduct(offer, context, offer.give_item);
        item.posa_is_offer = 0;
        item.posa_is_replace = baseItem.posa_row_id;
        const diffQty = baseItem.qty - offer.given_qty;
        if (diffQty <= 0) {
          item.qty = baseItem.qty;
          context.remove_item(baseItem);
          item.posa_row_id = item.posa_is_replace;
        } else {
          baseItem.qty = diffQty;
        }
        context.items.unshift(item);
        offer.give_item_row_id = item.posa_row_id;
      } else {
        const item = ApplyOnGiveProduct(offer, context);
        context.items.unshift(item);
        if (item) {
          offer.give_item_row_id = item.posa_row_id;
        }
      }
    }
    if (offer.offer === "Grand Total") {
      ApplyOnTotal(offer, context);
    }
    if (offer.offer === "Loyalty Point") {
      context.eventBus.emit("show_message", {
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
    context.posa_offers.push(newOffer);
    addOfferToItems(newOffer, context);
  };

  const ApplyOnGiveProduct = (offer, context, item_code) => {
    if (!item_code) {
      item_code = offer.give_item;
    }
    const items = context.allItems;
    const item = items.find((item) => item.item_code == item_code);
    if (!item) {
      return;
    }
    const new_item = { ...item };
    new_item.qty = offer.given_qty;
    new_item.stock_qty = offer.given_qty;

    if (offer.discount_type === "Rate") {
      new_item.base_rate = offer.rate;
      if (context.selected_currency !== context.pos_profile.currency) {
        new_item.rate = context.flt(offer.rate * context.exchange_rate, context.currency_precision);
      } else {
        new_item.rate = offer.rate;
      }
    } else if (offer.discount_type === "Discount Percentage") {
      const base_price = item.base_rate || (item.rate * context.exchange_rate);
      const base_discount = context.flt((base_price * offer.discount_percentage) / 100, context.currency_precision);
      new_item.base_discount_amount = base_discount;
      new_item.base_rate = context.flt(base_price - base_discount, context.currency_precision);

      if (context.selected_currency !== context.pos_profile.currency) {
        new_item.discount_amount = context.flt(base_discount * context.exchange_rate, context.currency_precision);
        new_item.rate = context.flt(new_item.base_rate * context.exchange_rate, context.currency_precision);
      } else {
        new_item.discount_amount = base_discount;
        new_item.rate = new_item.base_rate;
      }
    } else {
      if (context.selected_currency !== context.pos_profile.currency) {
        new_item.base_rate = item.base_rate || (item.rate * context.exchange_rate);
        new_item.rate = item.rate;
      } else {
        new_item.base_rate = item.rate;
        new_item.rate = item.rate;
      }
    }

    if (offer.discount_type === "Discount Amount") {
      new_item.base_discount_amount = offer.discount_amount;
      if (context.selected_currency !== context.pos_profile.currency) {
        new_item.discount_amount = context.flt(offer.discount_amount * context.exchange_rate, context.currency_precision);
      } else {
        new_item.discount_amount = offer.discount_amount;
      }
    } else if (offer.discount_type !== "Discount Percentage") {
      new_item.base_discount_amount = 0;
      new_item.discount_amount = 0;
    }

    new_item.discount_percentage = offer.discount_type === "Discount Percentage" ? offer.discount_percentage : 0;
    new_item.discount_amount_per_item = 0;
    new_item.uom = item.uom ? item.uom : item.stock_uom;
    new_item.actual_batch_qty = "";
    new_item.conversion_factor = 1;
    new_item.posa_offers = JSON.stringify([]);
    new_item.posa_offer_applied =
      offer.discount_type === "Rate" ||
      offer.discount_type === "Discount Amount" ||
      offer.discount_type === "Discount Percentage"
        ? 1
        : 0;
    new_item.posa_is_offer = 1;
    new_item.posa_is_replace = null;
    new_item.posa_notes = "";
    new_item.posa_delivery_date = "";

    const is_free = (offer.discount_type === "Rate" && !offer.rate) ||
      (offer.discount_type === "Discount Percentage" && offer.discount_percentage == 100);

    new_item.is_free_item = is_free ? 1 : 0;

    if (is_free) {
      new_item.base_price_list_rate = 0;
      new_item.price_list_rate = 0;
    } else {
      new_item.price_list_rate = item.rate;
      if (context.selected_currency !== context.pos_profile.currency) {
        new_item.base_price_list_rate = context.flt(item.rate * context.exchange_rate, context.currency_precision);
      } else {
        new_item.base_price_list_rate = item.rate;
      }
    }

    new_item.posa_row_id = context.makeid(20);

    if ((!context.pos_profile.posa_auto_set_batch && new_item.has_batch_no) || new_item.has_serial_no) {
      context.expanded.push(new_item);
    }

    context.update_item_detail(new_item);
    return new_item;
  };

  const ApplyOnPrice = (offer, context) => {
    if (!offer || !Array.isArray(context.items)) return;

    context.items.forEach((item) => {
      if (!item || !offer.items || !Array.isArray(offer.items)) return;

      if (offer.items.includes(item.posa_row_id)) {
        const item_offers = item.posa_offers ? JSON.parse(item.posa_offers) : [];
        if (!Array.isArray(item_offers)) return;

        if (!item_offers.includes(offer.row_id)) {
          if (!item.posa_offer_applied) {
            const cf = context.flt(item.conversion_factor || 1);
            item.original_base_rate = item.base_rate / cf;
            item.original_base_price_list_rate = item.base_price_list_rate / cf;
            item.original_rate = item.rate / cf;
            item.original_price_list_rate = item.price_list_rate / cf;
          }

          const conversion_factor = context.flt(item.conversion_factor || 1);

          if (offer.discount_type === "Rate") {
            const base_offer_rate = context.flt(offer.rate * conversion_factor);

            item.base_rate = base_offer_rate;
            item.base_price_list_rate = base_offer_rate;

            if (context.selected_currency !== context.pos_profile.currency) {
              item.rate = context.flt(base_offer_rate * context.exchange_rate, context.currency_precision);
              item.price_list_rate = item.rate;
            } else {
              item.rate = base_offer_rate;
              item.price_list_rate = base_offer_rate;
            }

            item.discount_percentage = 0;
            item.discount_amount = 0;
            item.base_discount_amount = 0;

          } else if (offer.discount_type === "Discount Percentage") {
            item.discount_percentage = offer.discount_percentage;

            const base_price = context.flt(
              (item.original_base_price_list_rate || (item.base_price_list_rate / conversion_factor)) * conversion_factor,
              context.currency_precision
            );
            const base_discount = context.flt((base_price * offer.discount_percentage) / 100, context.currency_precision);
            item.base_discount_amount = base_discount;
            item.base_rate = context.flt(base_price - base_discount, context.currency_precision);
            item.base_price_list_rate = base_price;

            if (context.selected_currency !== context.pos_profile.currency) {
              item.price_list_rate = context.flt(base_price * context.exchange_rate, context.currency_precision);
              item.discount_amount = context.flt(base_discount * context.exchange_rate, context.currency_precision);
              item.rate = context.flt(item.base_rate * context.exchange_rate, context.currency_precision);
            } else {
              item.price_list_rate = base_price;
              item.discount_amount = base_discount;
              item.rate = item.base_rate;
            }
          }

          item.amount = context.flt(item.qty * item.rate, context.currency_precision);
          item.base_amount = context.flt(item.qty * item.base_rate, context.currency_precision);

          item.posa_offer_applied = 1;
          context.$forceUpdate();
        }
      }
    });
  };

  const RemoveOnPrice = (offer, context) => {
    if (!offer || !Array.isArray(context.items)) return;

    context.items.forEach((item) => {
      if (!item || !item.posa_offers) return;

      try {
        const item_offers = JSON.parse(item.posa_offers);
        if (!Array.isArray(item_offers)) return;

        if (item_offers.includes(offer.row_id)) {
          if (!item.original_base_rate) {
            context.update_item_detail(item);
            return;
          }

          const cf = context.flt(item.conversion_factor || 1);

          item.base_rate = context.flt(item.original_base_rate * cf, context.currency_precision);
          item.base_price_list_rate = context.flt(item.original_base_price_list_rate * cf, context.currency_precision);

          if (context.selected_currency !== context.pos_profile.currency) {
            item.rate = context.flt(item.base_rate * context.exchange_rate, context.currency_precision);
            item.price_list_rate = context.flt(item.base_price_list_rate * context.exchange_rate, context.currency_precision);
          } else {
            item.rate = item.base_rate;
            item.price_list_rate = item.base_price_list_rate;
          }

          item.discount_percentage = 0;
          item.discount_amount = 0;
          item.base_discount_amount = 0;

          item.amount = context.flt(item.qty * item.rate, context.currency_precision);
          item.base_amount = context.flt(item.qty * item.base_rate, context.currency_precision);

          const remaining_offers = item_offers.filter(id => id !== offer.row_id);
          if (remaining_offers.length === 0) {
            item.original_base_rate = null;
            item.original_base_price_list_rate = null;
            item.original_rate = null;
            item.original_price_list_rate = null;
            item.posa_offer_applied = 0;
          }

          item.posa_offers = JSON.stringify(remaining_offers);
          context.$forceUpdate();
        }
      } catch (error) {
        console.error('Error removing price offer:', error);
        context.eventBus.emit("show_message", {
          title: __("Error removing price offer"),
          color: "error",
          message: error.message
        });
      }
    });
  };

  const ApplyOnTotal = (offer, context) => {
    if (!offer.name) {
      offer = context.posOffers.find((el) => el.name == offer.offer_name);
    }
    if (
      context.discount_percentage_offer_name === offer.name &&
      context.discount_amount !== 0
    ) {
      return;
    }
    if (
      (!context.discount_percentage_offer_name ||
        context.discount_percentage_offer_name == offer.name) &&
      offer.discount_percentage > 0 &&
      offer.discount_percentage <= 100
    ) {
      context.discount_amount = context.flt(
        (context.flt(context.Total) * context.flt(offer.discount_percentage)) / 100,
        context.currency_precision
      );
      context.discount_percentage_offer_name = offer.name;

      context.additional_discount = context.discount_amount;
      if (context.Total && context.Total !== 0) {
        context.additional_discount_percentage =
          (context.discount_amount / context.Total) * 100;
      } else {
        context.additional_discount_percentage = 0;
      }
    }
  };

  const RemoveOnTotal = (offer, context) => {
    if (
      context.discount_percentage_offer_name &&
      context.discount_percentage_offer_name == offer.offer_name
    ) {
      context.discount_amount = 0;
      context.discount_percentage_offer_name = null;

      context.additional_discount = 0;
      context.additional_discount_percentage = 0;
    }
  };

  const addOfferToItems = (offer, context) => {
    if (!offer || !offer.items || !Array.isArray(context.items)) return;

    try {
      const offer_items = typeof offer.items === 'string' ? JSON.parse(offer.items) : offer.items;
      if (!Array.isArray(offer_items)) return;

      offer_items.forEach((el) => {
        context.items.forEach((exist_item) => {
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
      context.eventBus.emit("show_message", {
        title: __("Error adding offer to items"),
        color: "error",
        message: error.message
      });
    }
  };

  const deleteOfferFromItems = (offer, context) => {
    if (!offer || !offer.items || !Array.isArray(context.items)) return;

    try {
      const offer_items = typeof offer.items === 'string' ? JSON.parse(offer.items) : offer.items;
      if (!Array.isArray(offer_items)) return;

      offer_items.forEach((el) => {
        context.items.forEach((exist_item) => {
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
      context.eventBus.emit("show_message", {
        title: __("Error deleting offer from items"),
        color: "error",
        message: error.message
      });
    }
  };

  const validate_due_date = (item, context) => {
    const today = frappe.datetime.now_date();
    const parse_today = Date.parse(today);
    const backend_date = context.formatDateForBackend(item.posa_delivery_date);
    const new_date = Date.parse(backend_date);
    if (isNaN(new_date) || new_date < parse_today) {
      setTimeout(() => {
        item.posa_delivery_date = context.formatDateForDisplay(today);
      }, 0);
    } else {
      item.posa_delivery_date = context.formatDateForDisplay(backend_date);
    }
  };

  const load_print_page = (invoice_name, context) => {
    const print_format =
      context.pos_profile.print_format_for_online ||
      context.pos_profile.print_format;
    const letter_head = context.pos_profile.letter_head || 0;
    const url =
      frappe.urllib.get_base_url() +
      "/printview?doctype=Sales%20Invoice&name=" +
      invoice_name +
      "&trigger_print=1" +
      "&format=" +
      print_format +
      "&no_letterhead=" +
      letter_head;

    if (context.pos_profile.posa_silent_print) {
      silentPrint(url);
    } else {
      const printWindow = window.open(url, "Print");
      printWindow.addEventListener(
        "load",
        function () {
          printWindow.print();
        },
        { once: true }
      );
    }
  };

  const formatDateForBackend = (date) => {
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
  };

  const formatDateForDisplay = (date) => {
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
  };

  const toggleOffer = (item, context) => {
    context.$nextTick(() => {
      if (!item.posa_is_offer) {
        item.posa_offers = JSON.stringify([]);
        item.posa_offer_applied = 0;
        item.discount_percentage = 0;
        item.discount_amount = 0;
        item.rate = item.price_list_rate;
        context.calc_item_price(item);
        handelOffers(context);
      }
      context.$forceUpdate();
    });
  };

  return {
    checkOfferIsAppley,
    handelOffers,
    setItemGiveOffer,
    getCheapestItem,
    getItemFromRowID,
    checkQtyAnountOffer,
    checkOfferCoupon,
    getItemOffer,
    getGroupOffer,
    getBrandOffer,
    getTransactionOffer,
    updatePosOffers,
    updateInvoiceOffers,
    removeApplyOffer,
    applyNewOffer,
    ApplyOnGiveProduct,
    ApplyOnPrice,
    RemoveOnPrice,
    ApplyOnTotal,
    RemoveOnTotal,
    addOfferToItems,
    deleteOfferFromItems,
    validate_due_date,
    load_print_page,
    formatDateForBackend,
    formatDateForDisplay,
    toggleOffer
  };
}