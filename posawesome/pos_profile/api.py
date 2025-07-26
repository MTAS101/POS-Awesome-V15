import frappe


@frappe.whitelist()
def get_profile(name: str):
	"""Return POS Profile (Awesome) details as dict."""
	return frappe.get_doc("POS Profile (Awesome)", name).as_dict()
