import frappe


def get_posa_profile(name=None, company=None):
    filters = {}
    if name:
        filters["name"] = name
    if company:
        filters["company"] = company
    result = frappe.get_all("POSA Profile", filters=filters, fields=["name"], limit=1)
    if not result:
        frappe.throw(f"POSA Profile not found for filters {filters}")
    return frappe.get_doc("POSA Profile", result[0].name)


def get_profile_setting(profile, key, default=None):
    if not profile:
        frappe.throw("No POSA Profile provided")
    if key in profile.as_dict() and profile.get(key) not in (None, ""):
        return profile.get(key)
    return default
