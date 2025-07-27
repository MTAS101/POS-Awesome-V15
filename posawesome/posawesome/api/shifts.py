# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.utils import nowdate

from posawesome.pos_profile.api import resolve_profile

from .utilities import get_version


@frappe.whitelist()
def get_opening_dialog_data():
    data = {}

    profile_names = frappe.get_all(
        "POS Profile User",
        filters={"user": frappe.session.user},
        pluck="parent",
    )

    pos_profiles_data: list[dict] = []
    for name in profile_names:
        profile = resolve_profile(name)
        if getattr(profile, "disabled", 0):
            continue
        pos_profiles_data.append(
            {
                "name": profile.name,
                "company": profile.company,
                "currency": profile.currency,
            }
        )

    data["pos_profiles_data"] = pos_profiles_data

    company_names: list[str] = []
    for profile in pos_profiles_data:
        if profile["company"] and profile["company"] not in company_names:
            company_names.append(profile["company"])
    data["companies"] = [{"name": c} for c in company_names]

    pos_profiles_list = [p["name"] for p in pos_profiles_data]

    payment_method_table = "POS Payment Method" if get_version() == 13 else "Sales Invoice Payment"
    data["payments_method"] = frappe.get_list(
        payment_method_table,
        filters={"parent": ["in", pos_profiles_list]},
        fields=["*"],
        limit_page_length=0,
        order_by="parent",
        ignore_permissions=True,
    )
    for mode in data["payments_method"]:
        profile_doc = resolve_profile(mode["parent"])
        mode["currency"] = profile_doc.currency

    return data


@frappe.whitelist()
def create_opening_voucher(pos_profile, company, balance_details):
	balance_details = json.loads(balance_details)

	new_pos_opening = frappe.get_doc(
		{
			"doctype": "POS Opening Shift",
			"period_start_date": frappe.utils.get_datetime(),
			"posting_date": frappe.utils.getdate(),
			"user": frappe.session.user,
			"pos_profile": pos_profile,
			"company": company,
			"docstatus": 1,
		}
	)
	new_pos_opening.set("balance_details", balance_details)
	new_pos_opening.insert(ignore_permissions=True)

	data = {}
	data["pos_opening_shift"] = new_pos_opening.as_dict()
	update_opening_shift_data(data, new_pos_opening.pos_profile)
	return data


@frappe.whitelist()
def check_opening_shift(user):
	open_vouchers = frappe.db.get_all(
		"POS Opening Shift",
		filters={
			"user": user,
			"pos_closing_shift": ["in", ["", None]],
			"docstatus": 1,
			"status": "Open",
		},
		fields=["name", "pos_profile"],
		order_by="period_start_date desc",
	)
	data = ""
	if len(open_vouchers) > 0:
		data = {}
		data["pos_opening_shift"] = frappe.get_doc("POS Opening Shift", open_vouchers[0]["name"])
		update_opening_shift_data(data, open_vouchers[0]["pos_profile"])
	return data


def update_opening_shift_data(data, pos_profile):
    profile_doc = resolve_profile(pos_profile)
    data["pos_profile"] = profile_doc
    if profile_doc.get("posa_language"):
        frappe.local.lang = profile_doc.posa_language
    data["company"] = frappe.get_doc("Company", profile_doc.company)
    allow_negative_stock = frappe.get_value("Stock Settings", None, "allow_negative_stock")
    data["stock_settings"] = {}
    data["stock_settings"].update({"allow_negative_stock": allow_negative_stock})
