import { memory } from "./cache.js";
import { persist } from "./core.js";

// Cache gift coupons by customer
export function saveGiftCoupons(customer, coupons) {
        try {
                const cache = memory.coupon_cache || {};
                // Clone coupons to avoid reactive objects issues
                const clean = JSON.parse(JSON.stringify(coupons));
                cache[customer] = {
                        coupons: clean,
                        timestamp: Date.now(),
                };
                memory.coupon_cache = cache;
                persist("coupon_cache", memory.coupon_cache);
        } catch (e) {
                console.error("Failed to cache gift coupons", e);
        }
}

// Retrieve cached coupons for a customer within 24h TTL
export function getCachedGiftCoupons(customer) {
        try {
                const cache = memory.coupon_cache || {};
                const data = cache[customer];
                if (data) {
                        const isValid = Date.now() - data.timestamp < 24 * 60 * 60 * 1000;
                        return isValid ? data.coupons : null;
                }
                return null;
        } catch (e) {
                console.error("Failed to get cached gift coupons", e);
                return null;
        }
}

export function clearGiftCouponCache() {
        try {
                memory.coupon_cache = {};
                persist("coupon_cache", memory.coupon_cache);
        } catch (e) {
                console.error("Failed to clear gift coupon cache", e);
        }
}
