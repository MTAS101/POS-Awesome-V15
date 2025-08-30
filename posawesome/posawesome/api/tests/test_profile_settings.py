import frappe
from posawesome.posawesome.api.profile import get_profile_settings


def test_get_profile_settings():
    settings = frappe.get_single("POS Awesome User Profile Settings")
    settings.posa_allow_user_to_edit_rate = 1
    settings.save()
    result = get_profile_settings()
    assert result.get("posa_allow_user_to_edit_rate") == 1
