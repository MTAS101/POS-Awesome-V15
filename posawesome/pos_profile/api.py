import frappe


def resolve_profile(name: str):
    """Return the POS profile document for the given name.

    Falls back to the legacy DocType if the new one is missing.
    """
    doctype = "POS Profile (Awesome)" if frappe.db.exists(
        "POS Profile (Awesome)", name
    ) else "POS Profile"
    return frappe.get_doc(doctype, name)


@frappe.whitelist()
def get_profile(name: str):
	"""Return POS Profile (Awesome) details as dict."""
	return frappe.get_doc("POS Profile (Awesome)", name).as_dict()
