import frappe


def resolve_profile(name: str) -> str:
    """Return the DocType storing the given POS profile."""
    if frappe.db.exists("POS Profile (Awesome)", name):
        return "POS Profile (Awesome)"
    return "POS Profile"


@frappe.whitelist()
def get_profile(name: str):
	"""Return POS Profile (Awesome) details as dict."""
	return frappe.get_doc("POS Profile (Awesome)", name).as_dict()
