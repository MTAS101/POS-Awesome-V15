import debounce from "lodash/debounce";

/**
 * Create a debounced price refresh handler.
 * @param {Function} updateFn - Function that updates item rates.
 * @param {number} wait - Debounce delay in ms.
 */
export function usePriceRefresh(updateFn, wait = 300) {
        const refreshPrices = debounce(() => {
                updateFn();
        }, wait);
        return { refreshPrices };
}
