import frappe
from frappe.exceptions import DoesNotExistError


@frappe.whitelist()
def get_profile_settings():
    """Return consolidated POS Awesome profile settings."""
    try:
        return frappe.get_single("POS Awesome User Profile Settings")
    except DoesNotExistError:
        settings = frappe.new_doc("POS Awesome User Profile Settings")
        settings.insert(ignore_permissions=True)
        return settings
