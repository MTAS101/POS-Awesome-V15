import { ref } from "vue";
import { getCachedPosProfile, savePosProfile } from "../../offline/index.js";

export function usePosProfile() {
    const profile = ref(null);

    async function loadProfile(name) {
        const bootProfile = frappe?.boot?.pos_profile;
        if (bootProfile && bootProfile.name === name) {
            profile.value = bootProfile;
            savePosProfile(bootProfile);
            return bootProfile;
        }
        const cached = getCachedPosProfile(name, bootProfile?.modified);
        if (cached) {
            profile.value = cached;
            return cached;
        }
        try {
            const res = await frappe.call({
                method: "posawesome.pos_profile.api.get_profile",
                args: { name },
            });
            if (res.message) {
                profile.value = res.message;
                savePosProfile(res.message);
                return res.message;
            }
        } catch (e) {
            console.error("Failed to fetch POS profile", e);
        }
        return null;
    }

    return { profile, loadProfile };
}
