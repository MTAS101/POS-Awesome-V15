import frappe
from frappe import _


def resolve_profile(name: str):
    """Return the POS profile document for the given name.

    Falls back to the legacy DocType if the new one is missing.
    """
    doctype = "POS Profile Awesome" if frappe.db.exists(
        "POS Profile Awesome", name
    ) else "POS Profile"
    return frappe.get_doc(doctype, name)


@frappe.whitelist()
def get_profile(name: str | None = None):
    """Return POS Profile Awesome details as dict.

    Falls back to the user's default profile if ``name`` is not provided.
    """
    if not name:
        name = frappe.defaults.get_user_default("pos_profile")
        if not name:
            return None

    profile = resolve_profile(name)

    if not frappe.has_permission(profile.doctype, "read", profile.name):
        frappe.throw(_("Not permitted"), frappe.PermissionError)

    return profile.as_dict()
