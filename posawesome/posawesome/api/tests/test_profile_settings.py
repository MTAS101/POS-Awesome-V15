import frappe
from posawesome.posawesome.api.profile import get_profile_settings


def test_get_profile_settings():
    user = frappe.session.user
    settings_name = frappe.db.exists(
        "POS Awesome User Profile Settings", {"user": user}
    )
    if settings_name:
        settings = frappe.get_doc("POS Awesome User Profile Settings", settings_name)
    else:
        settings = frappe.new_doc("POS Awesome User Profile Settings")
        settings.user = user
    settings.posa_allow_user_to_edit_rate = 1
    settings.save()
    result = get_profile_settings(user)
    assert result.get("posa_allow_user_to_edit_rate") == 1
