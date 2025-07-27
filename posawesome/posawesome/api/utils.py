from __future__ import annotations

import frappe
from frappe import _

from posawesome.pos_profile.api import resolve_profile


@frappe.whitelist()
def get_active_pos_profile(user=None):
    """Return the active POS profile for the given user."""
    user = user or frappe.session.user
    profile = frappe.db.get_value("POS Profile User", {"user": user}, "parent")
    if not profile:
        profile = frappe.db.get_single_value("POS Settings", "pos_profile")
    if not profile:
        return None
    doc = resolve_profile(profile)
    if not frappe.has_permission(doc.doctype, "read", doc.name):
        frappe.throw(_("Not permitted"), frappe.PermissionError)
    return doc.as_dict()

@frappe.whitelist()
def get_default_warehouse(company=None):
    """Return the default warehouse for the given company."""
    company = company or frappe.defaults.get_default("company")
    if not company:
        return None
    warehouse = frappe.db.get_value("Company", company, "default_warehouse")
    if not warehouse:
        warehouse = frappe.db.get_single_value("Stock Settings", "default_warehouse")
    return warehouse
