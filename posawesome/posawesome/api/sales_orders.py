# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

import json

import frappe
from erpnext.accounts.party import get_party_account
from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice
from frappe.utils import getdate, nowdate


@frappe.whitelist()
def search_orders(company, currency, order_name=None):
    filters = {
        "billing_status": ["in", ["Not Billed", "Partly Billed"]],
        "docstatus": 1,
        "company": company,
        "currency": currency,
    }
    if order_name:
        filters["name"] = ["like", f"%{order_name}%"]
    orders_list = frappe.get_list(
        "Sales Order",
        filters=filters,
        fields=["name"],
        limit_page_length=0,
        order_by="customer",
    )
    data = []
    for order in orders_list:
        data.append(frappe.get_doc("Sales Order", order["name"]))
    return data


def _map_delivery_dates(data):
    """Ensure mandatory delivery_date fields are populated."""
    def parse_date(value):
        if not value:
            return None
        try:
            return str(getdate(value))
        except Exception:
            return None

    # Map order level delivery date
    if not data.get("delivery_date") and data.get("posa_delivery_date"):
        parsed = parse_date(data.get("posa_delivery_date"))
        if parsed:
            data["delivery_date"] = parsed

    # Map item level delivery dates
    for item in data.get("items", []):
        if not item.get("delivery_date"):
            delivery = item.get("posa_delivery_date") or data.get("delivery_date")
            parsed = parse_date(delivery)
            if parsed:
                item["delivery_date"] = parsed



@frappe.whitelist()
def update_sales_order(data):
    """Create or update a Sales Order document."""
    data = json.loads(data)
    _map_delivery_dates(data)
    if data.get("name") and frappe.db.exists("Sales Order", data.get("name")):
        so_doc = frappe.get_doc("Sales Order", data.get("name"))
        so_doc.update(data)
    else:
        so_doc = frappe.get_doc(data)

    so_doc.flags.ignore_permissions = True
    frappe.flags.ignore_account_permission = True
    so_doc.docstatus = 0
    so_doc.save()
    return so_doc


def _create_payment_entries(so_doc, payments):
    """Create payment entries referencing the sales order."""
    for pay in payments or []:
        if not pay.get("amount"):
            continue

        debit_to = get_party_account("Customer", so_doc.customer, so_doc.company)
        pe = frappe.get_doc({
            "doctype": "Payment Entry",
            "posting_date": nowdate(),
            "payment_type": "Receive",
            "party_type": "Customer",
            "party": so_doc.customer,
            "paid_amount": pay.get("amount"),
            "received_amount": pay.get("amount"),
            "paid_from": debit_to,
            "paid_to": pay.get("account"),
            "company": so_doc.company,
            "mode_of_payment": pay.get("mode_of_payment"),
            "reference_no": so_doc.get("posa_pos_opening_shift"),
            "reference_date": nowdate(),
        })

        pe.append("references", {
            "allocated_amount": pay.get("amount"),
            "reference_doctype": "Sales Order",
            "reference_name": so_doc.name,
        })

        pe.flags.ignore_permissions = True
        frappe.flags.ignore_account_permission = True
        pe.save()
        pe.submit()


@frappe.whitelist()
def submit_sales_order(order):
    """Submit sales order and create payment entries."""
    order = json.loads(order)
    _map_delivery_dates(order)
    if order.get("name") and frappe.db.exists("Sales Order", order.get("name")):
        so_doc = frappe.get_doc("Sales Order", order.get("name"))
        so_doc.update(order)
    else:
        so_doc = frappe.get_doc(order)

    payments = order.get("payments")

    so_doc.flags.ignore_permissions = True
    frappe.flags.ignore_account_permission = True
    so_doc.save()
    so_doc.submit()

    _create_payment_entries(so_doc, payments)

    return {"name": so_doc.name, "status": so_doc.docstatus}

