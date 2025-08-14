from __future__ import annotations
from functools import lru_cache

import frappe

# Reusable ORM filter to exclude template items
HAS_VARIANTS_EXCLUSION = {"has_variants": 0}


@frappe.whitelist()
def get_active_pos_profile(user=None):
    """Return the active POS profile for the given user."""
    user = user or frappe.session.user
    profile = frappe.db.get_value("POS Profile User", {"user": user}, "parent")
    if not profile:
        profile = frappe.db.get_single_value("POS Settings", "pos_profile")
    if not profile:
        return None
    return frappe.get_doc("POS Profile", profile).as_dict()


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


@lru_cache(maxsize=None)
def get_item_groups(pos_profile: str) -> list[str]:
    """Return item groups linked to a POS profile using the ORM.

    Results are cached to avoid duplicate database calls when the same
    profile's item groups are requested multiple times within a process.
    """
    if not pos_profile:
        return []

    return frappe.get_all(
        "POS Profile Item Group",
        filters={"parent": pos_profile},
        pluck="item_group",
    )
