import frappe


@frappe.whitelist()
def get_profile_settings():
    """Return consolidated POS Awesome profile settings."""
    return frappe.get_single("POS Awesome User Profile Settings")
