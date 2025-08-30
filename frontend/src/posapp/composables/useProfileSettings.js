import { ref } from "vue";

export function useProfileSettings() {
    const settings = ref({});

    async function loadProfileSettings() {
        try {
            const response = await frappe.call(
                "posawesome.posawesome.api.get_profile_settings"
            );
            settings.value = response.message || {};
        } catch (error) {
            console.error("Failed to load profile settings", error);
        }
    }

    return { settings, loadProfileSettings };
}
