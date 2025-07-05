export function useDiscounts() {
  // Update additional discount amount based on percentage
  const updateDiscountAmount = (context) => {
    const value = flt(context.additional_discount_percentage);
    // If value is too large, reset to 0
    if (value < -100 || value > 100) {
      context.additional_discount_percentage = 0;
      context.additional_discount = 0;
      return;
    }

    // Calculate discount amount based on percentage
    if (context.Total && context.Total !== 0) {
      context.additional_discount = (context.Total * value) / 100;
    } else {
      context.additional_discount = 0;
    }
  };

  // Calculate prices and discounts for an item based on field change
  const calcPrices = (item, value, $event, context) => {
    if (!$event?.target?.id || !item) return;

    const fieldId = $event.target.id;
    let newValue = flt(value, context.currency_precision);

    try {
      // Flag to track manual rate changes
      if (fieldId === 'rate') {
        item._manual_rate_set = true;
      }

      // Handle negative values
      if (newValue < 0) {
        newValue = 0;
        context.eventBus.emit("show_message", {
          title: __("Negative values not allowed"),
          color: "error"
        });
      }

      // Convert price_list_rate to current currency for calculations
      const converted_price_list_rate = context.selected_currency !== context.pos_profile.currency ?
        context.flt(item.price_list_rate / context.exchange_rate, context.currency_precision) :
        item.price_list_rate;

      // Field-wise calculations
      switch (fieldId) {
        case "rate":
          // Store base rate and convert to selected currency
          item.base_rate = context.flt(newValue * context.exchange_rate, context.currency_precision);
          item.rate = newValue;

          // Calculate discount amount in selected currency
          item.discount_amount = context.flt(converted_price_list_rate - item.rate, context.currency_precision);
          item.base_discount_amount = context.flt(item.price_list_rate - item.base_rate, context.currency_precision);

          // Calculate percentage based on converted values
          if (converted_price_list_rate) {
            item.discount_percentage = context.flt((item.discount_amount / converted_price_list_rate) * 100, context.float_precision);
          }
          break;

        case "discount_amount":
          console.log("[calc_prices] Event Target ID:", fieldId);
          console.log("[calc_prices] RAW value received by function:", value);
          console.log("[calc_prices] Original item.price_list_rate:", item.price_list_rate);
          console.log("[calc_prices] Converted price_list_rate for calc:", converted_price_list_rate);
          console.log("[calc_prices] Input value (newValue before Math.min):", newValue);

          // Ensure discount amount doesn't exceed price list rate
          newValue = Math.min(newValue, converted_price_list_rate);
          console.log("[calc_prices] Input value (newValue after Math.min):", newValue);

          // Store base discount and convert to selected currency
          item.base_discount_amount = context.flt(newValue * context.exchange_rate, context.currency_precision);
          item.discount_amount = newValue;
          console.log("[calc_prices] Updated item.discount_amount:", item.discount_amount);
          console.log("[calc_prices] Updated item.base_discount_amount:", item.base_discount_amount);

          // Update rate based on discount
          item.rate = context.flt(converted_price_list_rate - item.discount_amount, context.currency_precision);
          item.base_rate = context.flt(item.price_list_rate - item.base_discount_amount, context.currency_precision);
          console.log("[calc_prices] Calculated item.rate:", item.rate);
          console.log("[calc_prices] Calculated item.base_rate:", item.base_rate);

          // Calculate percentage
          if (converted_price_list_rate) {
            item.discount_percentage = context.flt((item.discount_amount / converted_price_list_rate) * 100, context.float_precision);
          } else {
            item.discount_percentage = 0; // Avoid division by zero
          }
          console.log("[calc_prices] Calculated item.discount_percentage:", item.discount_percentage);
          break;

        case "discount_percentage":
          // Ensure percentage doesn't exceed 100%
          newValue = Math.min(newValue, 100);
          item.discount_percentage = context.flt(newValue, context.float_precision);

          // Calculate discount amount in selected currency
          item.discount_amount = context.flt((converted_price_list_rate * item.discount_percentage) / 100, context.currency_precision);
          item.base_discount_amount = context.flt((item.price_list_rate * item.discount_percentage) / 100, context.currency_precision);

          // Update rates
          item.rate = context.flt(converted_price_list_rate - item.discount_amount, context.currency_precision);
          item.base_rate = context.flt(item.price_list_rate - item.base_discount_amount, context.currency_precision);
          break;
      }

      // Ensure rate doesn't go below zero
      if (item.rate < 0) {
        item.rate = 0;
        item.base_rate = 0;
        item.discount_amount = converted_price_list_rate;
        item.base_discount_amount = item.price_list_rate;
        item.discount_percentage = 100;
      }

      // Update stock calculations and force UI update
      context.calcStockQty(item, item.qty);
      context.forceUpdate();

    } catch (error) {
      console.error("Error calculating prices:", error);
      context.eventBus.emit("show_message", {
        title: __("Error calculating prices"),
        color: "error"
      });
    }
  };

  // Calculate item price and discount fields
  const calcItemPrice = (item, context) => {
    // Skip recalculation if called from update_item_rates to avoid double calculations
    if (item._skip_calc) {
      item._skip_calc = false;
      return;
    }

    if (!item.posa_offer_applied) {
      if (item.price_list_rate) {
        // Always work with base rates first
        if (!item.base_price_list_rate) {
          item.base_price_list_rate = item.price_list_rate;
          item.base_rate = item.rate;
        }

        // Convert to selected currency
        if (context.selected_currency !== context.pos_profile.currency) {
          item.price_list_rate = context.flt(item.base_price_list_rate / context.exchange_rate, context.currency_precision);
          item.rate = context.flt(item.base_rate / context.exchange_rate, context.currency_precision);
        } else {
          item.price_list_rate = item.base_price_list_rate;
          item.rate = item.base_rate;
        }
      }
    }

    // Handle discounts
    if (item.discount_percentage) {
      // Calculate discount in selected currency
      const price_list_rate = item.price_list_rate;
      const discount_amount = context.flt((price_list_rate * item.discount_percentage) / 100, context.currency_precision);

      item.discount_amount = discount_amount;
      item.rate = context.flt(price_list_rate - discount_amount, context.currency_precision);

      // Store base discount amount
      if (context.selected_currency !== context.pos_profile.currency) {
        item.base_discount_amount = context.flt(discount_amount * context.exchange_rate, context.currency_precision);
      } else {
        item.base_discount_amount = item.discount_amount;
      }
    }

    // Calculate amounts
    item.amount = context.flt(item.qty * item.rate, context.currency_precision);
    if (context.selected_currency !== context.pos_profile.currency) {
      item.base_amount = context.flt(item.amount * context.exchange_rate, context.currency_precision);
    } else {
      item.base_amount = item.amount;
    }

    context.forceUpdate();
  };

  return {
    updateDiscountAmount,
    calcPrices,
    calcItemPrice
  }
}