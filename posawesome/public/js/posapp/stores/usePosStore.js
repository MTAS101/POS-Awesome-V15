import { defineStore } from "pinia";

export const usePosStore = defineStore("pos", {
    state: () => ({
        profile: null,
        offers: [],
        shift: null,
    }),
    getters: {
        getProfile: (state) => state.profile,
        getOffers: (state) => state.offers,
        getShift: (state) => state.shift,
    },
    actions: {
        setProfile(profile) {
            this.profile = profile;
        },
        setOffers(offers) {
            this.offers = offers;
        },
        setShift(shift) {
            this.shift = shift;
        },
    },
});
