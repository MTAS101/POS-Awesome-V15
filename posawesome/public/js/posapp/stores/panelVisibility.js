import { defineStore } from "pinia";

export const usePanelVisibilityStore = defineStore("panelVisibility", {
        state: () => ({
                paymentVisible: false,
                offersVisible: false,
                couponsVisible: false,
        }),
        actions: {
                showPayment() {
                        this.paymentVisible = true;
                        this.offersVisible = false;
                        this.couponsVisible = false;
                },
                hidePayment() {
                        this.paymentVisible = false;
                },
                showOffers() {
                        this.offersVisible = true;
                        this.paymentVisible = false;
                        this.couponsVisible = false;
                },
                hideOffers() {
                        this.offersVisible = false;
                },
                showCoupons() {
                        this.couponsVisible = true;
                        this.paymentVisible = false;
                        this.offersVisible = false;
                },
                hideCoupons() {
                        this.couponsVisible = false;
                },
        },
});

