import frappe
from frappe.exceptions import DoesNotExistError


@frappe.whitelist()
def get_profile_settings(user: str | None = None):
    """Return POS Awesome profile settings for a given user.

    If no document exists for the user, a new one is created on the fly.
    """
    user = user or frappe.session.user

    try:
        return frappe.get_doc(
            "POS Awesome User Profile Settings", {"user": user}, ignore_permissions=True
        )
    except DoesNotExistError:
        settings = frappe.new_doc("POS Awesome User Profile Settings")
        settings.user = user
        settings.insert(ignore_permissions=True)
        return settings
