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
    """Return POS Profile details as dict.

    If ``name`` is not supplied, use the user's assigned POS profile or the
    default profile from POS Settings.
    """
    if not name:
        name = frappe.db.get_value("POS Profile User", {"user": frappe.session.user}, "parent")
        if not name:
            name = frappe.db.get_single_value("POS Settings", "pos_profile")
    if not name:
        frappe.throw(_("POS Profile is required"))

    return resolve_profile(name).as_dict()
