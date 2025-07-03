"""APIs for persisting user preferences."""


import json

import frappe


@frappe.whitelist()
def save_user_preferences(key: str, prefs: str | dict):
    """Save preferences for the current user."""
    if isinstance(prefs, str):
        try:
            prefs = json.loads(prefs)
        except Exception:
            frappe.throw("Invalid preferences data")

    frappe.defaults.set_user_default(f"posa_{key}", json.dumps(prefs))
    return {"status": "ok"}


@frappe.whitelist()
def load_user_preferences(key: str) -> dict:
    """Load preferences for the current user."""
    data = frappe.defaults.get_user_default(f"posa_{key}")
    if not data:
        return {}
    try:
        return json.loads(data)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "POSA Load Preferences Failed")
        return {}
