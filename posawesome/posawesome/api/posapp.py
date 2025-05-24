# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import json
import frappe
from frappe.utils import nowdate, flt, cstr, getdate, cint, money_in_words
from erpnext.setup.utils import get_exchange_rate
from frappe import _
from erpnext.accounts.doctype.sales_invoice.sales_invoice import get_bank_cash_account
from erpnext.stock.get_item_details import get_item_details
from erpnext.accounts.doctype.pos_profile.pos_profile import get_item_groups
from frappe.utils.background_jobs import enqueue
from erpnext.accounts.party import get_party_bank_account
from erpnext.stock.doctype.batch.batch import (
    get_batch_no,
    get_batch_qty,
)
from erpnext.accounts.doctype.payment_request.payment_request import (
    get_dummy_message,
    get_existing_payment_request_amount,
)

from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice
from erpnext.accounts.doctype.loyalty_program.loyalty_program import (
    get_loyalty_program_details_with_points,
)
from posawesome.posawesome.doctype.pos_coupon.pos_coupon import check_coupon_code
from posawesome.posawesome.doctype.delivery_charges.delivery_charges import (
    get_applicable_delivery_charges as _get_applicable_delivery_charges,
)
from frappe.utils.caching import redis_cache
from typing import List, Dict
from datetime import datetime


@frappe.whitelist()
def get_opening_dialog_data():
    data = {}
    data["companies"] = frappe.get_list("Company", limit_page_length=0, order_by="name")
    data["pos_profiles_data"] = frappe.get_list(
        "POS Profile",
        filters={"disabled": 0},
        fields=["name", "company", "currency"],
        limit_page_length=0,
        order_by="name",
    )

    pos_profiles_list = []
    for i in data["pos_profiles_data"]:
        pos_profiles_list.append(i.name)

    payment_method_table = (
        "POS Payment Method" if get_version() == 13 else "Sales Invoice Payment"
    )
    data["payments_method"] = frappe.get_list(
        payment_method_table,
        filters={"parent": ["in", pos_profiles_list]},
        fields=["*"],
        limit_page_length=0,
        order_by="parent",
        ignore_permissions=True,
    )
    # set currency from pos profile
    for mode in data["payments_method"]:
        mode["currency"] = frappe.get_cached_value(
            "POS Profile", mode["parent"], "currency"
        )

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
        data["pos_opening_shift"] = frappe.get_doc(
            "POS Opening Shift", open_vouchers[0]["name"]
        )
        update_opening_shift_data(data, open_vouchers[0]["pos_profile"])
    return data


def update_opening_shift_data(data, pos_profile):
    data["pos_profile"] = frappe.get_doc("POS Profile", pos_profile)
    data["company"] = frappe.get_doc("Company", data["pos_profile"].company)
    allow_negative_stock = frappe.get_value(
        "Stock Settings", None, "allow_negative_stock"
    )
    data["stock_settings"] = {}
    data["stock_settings"].update({"allow_negative_stock": allow_negative_stock})


@frappe.whitelist()
def get_items(
    pos_profile, price_list=None, item_group="", search_value="", customer=None
):
    _pos_profile = json.loads(pos_profile)
    use_price_list = _pos_profile.get("posa_use_server_cache")

    @redis_cache(ttl=60)
    def __get_items(pos_profile, price_list, item_group, search_value, customer=None):
        return _get_items(pos_profile, price_list, item_group, search_value, customer)

    def _get_items(pos_profile, price_list, item_group, search_value, customer=None):
        pos_profile = json.loads(pos_profile)
        condition = ""
        
        # Clear quantity cache to ensure fresh values on each search
        try:
            if hasattr(frappe.local.cache, "delete_key"):
                frappe.local.cache.delete_key('bin_qty_cache')
            elif frappe.cache().get_value('bin_qty_cache'):
                frappe.cache().delete_value('bin_qty_cache')
        except Exception as e:
            frappe.log_error(f"Error clearing bin_qty_cache: {str(e)}", "POS Awesome")
        
        today = nowdate()
        warehouse = pos_profile.get("warehouse")
        use_limit_search = pos_profile.get("pose_use_limit_search")
        search_serial_no = pos_profile.get("posa_search_serial_no")
        search_batch_no = pos_profile.get("posa_search_batch_no")
        posa_show_template_items = pos_profile.get("posa_show_template_items")
        posa_display_items_in_stock = pos_profile.get("posa_display_items_in_stock")
        search_limit = 0

        if not price_list:
            price_list = pos_profile.get("selling_price_list")

        limit = ""

        condition += get_item_group_condition(pos_profile.get("name"))

        if use_limit_search:
            search_limit = pos_profile.get("posa_search_limit") or 500
            data = {}
            if search_value:
                data = search_serial_or_batch_or_barcode_number(
                    search_value, search_serial_no
                )

            item_code = data.get("item_code") if data.get("item_code") else search_value
            serial_no = data.get("serial_no") if data.get("serial_no") else ""
            batch_no = data.get("batch_no") if data.get("batch_no") else ""
            barcode = data.get("barcode") if data.get("barcode") else ""

            condition += get_seearch_items_conditions(
                item_code, serial_no, batch_no, barcode
            )
            if item_group:
                condition += " AND item_group like '%{item_group}%'".format(
                    item_group=item_group
                )
            limit = " LIMIT {search_limit}".format(search_limit=search_limit)

        if not posa_show_template_items:
            condition += " AND has_variants = 0"

        result = []

        items_data = frappe.db.sql(
            """
            SELECT
                name AS item_code,
                item_name,
                description,
                stock_uom,
                image,
                is_stock_item,
                has_variants,
                variant_of,
                item_group,
                idx as idx,
                has_batch_no,
                has_serial_no,
                max_discount,
                brand
            FROM
                `tabItem`
            WHERE
                disabled = 0
                    AND is_sales_item = 1
                    AND is_fixed_asset = 0
                    {condition}
            ORDER BY
                item_name asc
            {limit}
                """.format(
                condition=condition, limit=limit
            ),
            as_dict=1,
        )

        if items_data:
            items = [d.item_code for d in items_data]
            item_prices_data = frappe.get_all(
                "Item Price",
                fields=["item_code", "price_list_rate", "currency", "uom"],
                filters={
                    "price_list": price_list,
                    "item_code": ["in", items],
                    "currency": pos_profile.get("currency"),
                    "selling": 1,
                    "valid_from": ["<=", today],
                    "customer": ["in", ["", None, customer]],
                },
                or_filters=[
                    ["valid_upto", ">=", today],
                    ["valid_upto", "in", ["", None]],
                ],
                order_by="valid_from ASC, valid_upto DESC",
            )

            item_prices = {}
            for d in item_prices_data:
                item_prices.setdefault(d.item_code, {})
                item_prices[d.item_code][d.get("uom") or "None"] = d

            for item in items_data:
                item_code = item.item_code
                item_price = {}
                if item_prices.get(item_code):
                    item_price = (
                        item_prices.get(item_code).get(item.stock_uom)
                        or item_prices.get(item_code).get("None")
                        or {}
                    )
                item_barcode = frappe.get_all(
                    "Item Barcode",
                    filters={"parent": item_code},
                    fields=["barcode", "posa_uom"],
                )
                batch_no_data = []
                if search_batch_no:
                    batch_list = get_batch_qty(warehouse=warehouse, item_code=item_code)
                    if batch_list:
                        for batch in batch_list:
                            if batch.qty > 0 and batch.batch_no:
                                batch_doc = frappe.get_cached_doc(
                                    "Batch", batch.batch_no
                                )
                                if (
                                    str(batch_doc.expiry_date) > str(today)
                                    or batch_doc.expiry_date in ["", None]
                                ) and batch_doc.disabled == 0:
                                    batch_no_data.append(
                                        {
                                            "batch_no": batch.batch_no,
                                            "batch_qty": batch.qty,
                                            "expiry_date": batch_doc.expiry_date,
                                            "batch_price": batch_doc.posa_batch_price,
                                            "manufacturing_date": batch_doc.manufacturing_date,
                                        }
                                    )
                serial_no_data = []
                if search_serial_no:
                    serial_no_data = frappe.get_all(
                        "Serial No",
                        filters={
                            "item_code": item_code,
                            "status": "Active",
                            "warehouse": warehouse,
                        },
                        fields=["name as serial_no"],
                    )
                item_stock_qty = 0
                if pos_profile.get("posa_display_items_in_stock") or use_limit_search:
                    item_stock_qty = get_stock_availability(
                        item_code, pos_profile.get("warehouse")
                    )
                attributes = ""
                if pos_profile.get("posa_show_template_items") and item.has_variants:
                    attributes = get_item_attributes(item.item_code)
                item_attributes = ""
                if pos_profile.get("posa_show_template_items") and item.variant_of:
                    item_attributes = frappe.get_all(
                        "Item Variant Attribute",
                        fields=["attribute", "attribute_value"],
                        filters={"parent": item.item_code, "parentfield": "attributes"},
                    )
                if posa_display_items_in_stock and (
                    not item_stock_qty or item_stock_qty < 0
                ):
                    pass
                else:
                    row = {}
                    row.update(item)
                    row.update(
                        {
                            "rate": item_price.get("price_list_rate") or 0,
                            "currency": item_price.get("currency")
                            or pos_profile.get("currency"),
                            "item_barcode": item_barcode or [],
                            "actual_qty": item_stock_qty or 0,
                            "serial_no_data": serial_no_data or [],
                            "batch_no_data": batch_no_data or [],
                            "attributes": attributes or "",
                            "item_attributes": item_attributes or "",
                        }
                    )
                    result.append(row)
        return result

    if use_price_list:
        return __get_items(pos_profile, price_list, item_group, search_value, customer)
    else:
        return _get_items(pos_profile, price_list, item_group, search_value, customer)


def get_item_group_condition(pos_profile):
    cond = " and 1=1"
    item_groups = get_item_groups(pos_profile)
    if item_groups:
        cond = " and item_group in (%s)" % (", ".join(["%s"] * len(item_groups)))

    return cond % tuple(item_groups)


def get_root_of(doctype):
    """Get root element of a DocType with a tree structure"""
    result = frappe.db.sql(
        """select t1.name from `tab{0}` t1 where
		(select count(*) from `tab{1}` t2 where
			t2.lft < t1.lft and t2.rgt > t1.rgt) = 0
		and t1.rgt > t1.lft""".format(
            doctype, doctype
        )
    )
    return result[0][0] if result else None


@frappe.whitelist()
def get_items_groups():
    return frappe.db.sql(
        """
        select name 
        from `tabItem Group`
        where is_group = 0
        order by name
        LIMIT 0, 200 """,
        as_dict=1,
    )


def get_customer_groups(pos_profile):
    customer_groups = []
    if pos_profile.get("customer_groups"):
        # Get items based on the item groups defined in the POS profile
        for data in pos_profile.get("customer_groups"):
            customer_groups.extend(
                [
                    "%s" % frappe.db.escape(d.get("name"))
                    for d in get_child_nodes(
                        "Customer Group", data.get("customer_group")
                    )
                ]
            )

    return list(set(customer_groups))


def get_child_nodes(group_type, root):
    lft, rgt = frappe.db.get_value(group_type, root, ["lft", "rgt"])
    return frappe.db.sql(
        """ Select name, lft, rgt from `tab{tab}` where
			lft >= {lft} and rgt <= {rgt} order by lft""".format(
            tab=group_type, lft=lft, rgt=rgt
        ),
        as_dict=1,
    )


def get_customer_group_condition(pos_profile):
    cond = "disabled = 0"
    customer_groups = get_customer_groups(pos_profile)
    if customer_groups:
        cond = " customer_group in (%s)" % (", ".join(["%s"] * len(customer_groups)))

    return cond % tuple(customer_groups)


@frappe.whitelist()
def get_customer_names(pos_profile):
    _pos_profile = json.loads(pos_profile)
    ttl = _pos_profile.get("posa_server_cache_duration")
    if ttl:
        ttl = int(ttl) * 60

    @redis_cache(ttl=ttl or 1800)
    def __get_customer_names(pos_profile):
        return _get_customer_names(pos_profile)

    def _get_customer_names(pos_profile):
        pos_profile = json.loads(pos_profile)
        condition = ""
        condition += get_customer_group_condition(pos_profile)
        customers = frappe.db.sql(
            """
            SELECT name, mobile_no, email_id, tax_id, customer_name, primary_address
            FROM `tabCustomer`
            WHERE {0}
            ORDER by name
            """.format(
                condition
            ),
            as_dict=1,
        )
        return customers

    if _pos_profile.get("posa_use_server_cache"):
        return __get_customer_names(pos_profile)
    else:
        return _get_customer_names(pos_profile)


@frappe.whitelist()
def get_sales_person_names():
    import json
    print("Fetching sales persons...")
    try:
        sales_persons = frappe.get_list(
            "Sales Person",
            filters={"enabled": 1},
            fields=["name", "sales_person_name"],
            limit_page_length=100000,
        )
        print(f"Found {len(sales_persons)} sales persons: {json.dumps(sales_persons)}")
        return sales_persons
    except Exception as e:
        print(f"Error fetching sales persons: {str(e)}")
        frappe.log_error(f"Error fetching sales persons: {str(e)}", "POS Sales Person Error")
        return []


def add_taxes_from_tax_template(item, parent_doc):
    accounts_settings = frappe.get_cached_doc("Accounts Settings")
    add_taxes_from_item_tax_template = (
        accounts_settings.add_taxes_from_item_tax_template
    )
    if item.get("item_tax_template") and add_taxes_from_item_tax_template:
        item_tax_template = item.get("item_tax_template")
        taxes_template_details = frappe.get_all(
            "Item Tax Template Detail",
            filters={"parent": item_tax_template},
            fields=["tax_type"],
        )

        for tax_detail in taxes_template_details:
            tax_type = tax_detail.get("tax_type")

            found = any(tax.account_head == tax_type for tax in parent_doc.taxes)
            if not found:
                tax_row = parent_doc.append("taxes", {})
                tax_row.update(
                    {
                        "description": str(tax_type).split(" - ")[0],
                        "charge_type": "On Net Total",
                        "account_head": tax_type,
                    }
                )

                if parent_doc.doctype == "Purchase Order":
                    tax_row.update({"category": "Total", "add_deduct_tax": "Add"})
                tax_row.db_insert()

def validate_return_items(original_invoice_name, return_items):
    """
    Ensure that return items do not exceed the quantity from the original invoice.
    """
    original_invoice = frappe.get_doc("Sales Invoice", original_invoice_name)
    original_item_qty = {}

    for item in original_invoice.items:
        original_item_qty[item.item_code] = original_item_qty.get(item.item_code, 0) + item.qty

    returned_items = frappe.get_all(
        "Sales Invoice",
        filters={
            "return_against": original_invoice_name,
            "docstatus": 1,
            "is_return": 1
        },
        fields=["name"]
    )

    for returned_invoice in returned_items:
        ret_doc = frappe.get_doc("Sales Invoice", returned_invoice.name)
        for item in ret_doc.items:
            if item.item_code in original_item_qty:
                original_item_qty[item.item_code] -= abs(item.qty)

    for item in return_items:
        item_code = item.get("item_code")
        return_qty = abs(item.get("qty", 0))
        if item_code in original_item_qty and return_qty > original_item_qty[item_code]:
            return {
                "valid": False,
                "message": _("You are trying to return more quantity for item {0} than was sold.").format(item_code),
            }

    return {"valid": True}
    
def debug_log(msg, data=None):
    """Helper function to log debug messages with timestamp"""
    import json
    from datetime import datetime
    
    timestamp = datetime.now().isoformat()
    log_msg = f"[{timestamp}] {msg}"
    
    if data:
        log_msg += f"\nData: {json.dumps(data, indent=2)}"
    
    print(log_msg)
    frappe.log_error(log_msg, "POS Debug Log")

@frappe.whitelist()
def submit_invoice(invoice, data):
    debug_log("Starting submit_invoice", {
        "invoice_name": invoice.get("name") if isinstance(invoice, dict) else None,
        "has_data": bool(data)
    })
    
    try:
        data = json.loads(data)
        invoice = json.loads(invoice)
        
        # Extract transaction ID
        transaction_id = data.get("transaction_id")
        debug_log("Extracted transaction ID", {"transaction_id": transaction_id})
        
        if transaction_id:
            # Check for existing submitted invoice with this transaction ID
            existing_invoice = frappe.db.get_value(
                "Sales Invoice",
                {
                    "posa_transaction_id": transaction_id,
                    "docstatus": 1
                },
                ["name", "docstatus"],
                as_dict=1
            )
            
            if existing_invoice:
                debug_log("Found existing submitted invoice", {
                    "invoice_name": existing_invoice.name,
                    "transaction_id": transaction_id
                })
                return existing_invoice
            
            # Check for draft with same transaction ID
            draft_invoice = frappe.db.get_value(
                "Sales Invoice",
                {
                    "posa_transaction_id": transaction_id,
                    "docstatus": 0
                },
                ["name"],
                as_dict=1
            )
            
            if draft_invoice:
                debug_log("Found existing draft invoice", {
                    "invoice_name": draft_invoice.name,
                    "transaction_id": transaction_id
                })
                invoice["name"] = draft_invoice.name
        
        debug_log("Processing invoice data", {
            "customer": invoice.get("customer"),
            "total": invoice.get("total"),
            "payment_count": len(data.get("payments", [])),
        })
        
        invoice_doc = frappe.get_doc("Sales Invoice", invoice.get("name")) if invoice.get("name") else frappe.get_doc(invoice)
        
        if transaction_id:
            invoice_doc.posa_transaction_id = transaction_id
        
        debug_log("Invoice doc created/loaded", {
            "name": invoice_doc.name,
            "is_new": not bool(invoice.get("name")),
            "transaction_id": invoice_doc.posa_transaction_id
        })
        
        # One final check before saving
        if transaction_id:
            duplicate_check = frappe.db.exists(
                "Sales Invoice",
                {
                    "posa_transaction_id": transaction_id,
                    "name": ["!=", invoice_doc.name if invoice_doc.name else ""],
                    "docstatus": ["!=", 2]
                }
            )
            if duplicate_check:
                debug_log("Found duplicate during final check", {
                    "duplicate_invoice": duplicate_check,
                    "transaction_id": transaction_id
                })
                return frappe.get_doc("Sales Invoice", duplicate_check)
        
        # Save the invoice
        invoice_doc.flags.ignore_permissions = True
        frappe.flags.ignore_account_permission = True
        
        debug_log("Saving invoice", {
            "name": invoice_doc.name,
            "is_pos": invoice_doc.is_pos,
            "update_stock": invoice_doc.update_stock
        })
        
        invoice_doc.save()
        
        debug_log("Invoice saved successfully", {
            "name": invoice_doc.name,
            "transaction_id": invoice_doc.posa_transaction_id
        })
        
        # Submit if needed
        if data.get("submit"):
            try:
                debug_log("Attempting to submit invoice", {
                    "name": invoice_doc.name,
                    "transaction_id": invoice_doc.posa_transaction_id
                })
                
                invoice_doc.submit()
                frappe.db.commit()
                
                debug_log("Invoice submitted successfully", {
                    "name": invoice_doc.name,
                    "transaction_id": invoice_doc.posa_transaction_id
                })
                
            except Exception as e:
                debug_log("Error submitting invoice", {
                    "name": invoice_doc.name,
                    "error": str(e),
                    "transaction_id": invoice_doc.posa_transaction_id
                })
                frappe.db.rollback()
                raise
        
        return {
            "name": invoice_doc.name,
            "status": invoice_doc.docstatus
        }
        
    except Exception as e:
        debug_log("Error in submit_invoice", {
            "error": str(e),
            "traceback": frappe.get_traceback()
        })
        raise

# Add custom field for transaction ID
def after_install():
    try:
        # Create custom field for transaction ID if it doesn't exist
        if not frappe.db.exists("Custom Field", "Sales Invoice-posa_transaction_id"):
            custom_field = frappe.get_doc({
                "doctype": "Custom Field",
                "dt": "Sales Invoice",
                "label": "POS Transaction ID",
                "fieldname": "posa_transaction_id",
                "fieldtype": "Data",
                "insert_after": "pos_profile",
                "unique": 1,
                "allow_on_submit": 0,
                "in_list_view": 0,
                "in_standard_filter": 0,
                "in_global_search": 0,
                "in_preview": 0,
                "read_only": 1
            })
            custom_field.insert()
            print("Created custom field for POS Transaction ID")
    except Exception as e:
        print(f"Error creating custom field: {str(e)}")
        frappe.log_error(f"Error creating custom field: {str(e)}")

@frappe.whitelist()
def get_pos_coupon(coupon, customer, company):
    res = check_coupon_code(coupon, customer, company)
    return res


@frappe.whitelist()
def get_active_gift_coupons(customer, company):
    coupons = []
    coupons_data = frappe.get_all(
        "POS Coupon",
        filters={
            "company": company,
            "coupon_type": "Gift Card",
            "customer": customer,
            "used": 0,
        },
        fields=["coupon_code"],
    )
    if len(coupons_data):
        coupons = [i.coupon_code for i in coupons_data]
    return coupons


@frappe.whitelist()
def get_customer_info(customer):
    customer = frappe.get_doc("Customer", customer)

    res = {"loyalty_points": None, "conversion_factor": None}

    res["email_id"] = customer.email_id
    res["mobile_no"] = customer.mobile_no
    res["image"] = customer.image
    res["loyalty_program"] = customer.loyalty_program
    res["customer_price_list"] = customer.default_price_list
    res["customer_group"] = customer.customer_group
    res["customer_type"] = customer.customer_type
    res["territory"] = customer.territory
    res["birthday"] = customer.posa_birthday
    res["gender"] = customer.gender
    res["tax_id"] = customer.tax_id
    res["posa_discount"] = customer.posa_discount
    res["name"] = customer.name
    res["customer_name"] = customer.customer_name
    res["customer_group_price_list"] = frappe.get_value(
        "Customer Group", customer.customer_group, "default_price_list"
    )

    if customer.loyalty_program:
        lp_details = get_loyalty_program_details_with_points(
            customer.name,
            customer.loyalty_program,
            silent=True,
            include_expired_entry=False,
        )
        res["loyalty_points"] = lp_details.get("loyalty_points")
        res["conversion_factor"] = lp_details.get("conversion_factor")
        
    addresses = frappe.db.sql(
        """
        SELECT
            address.name as address_name,
            address.address_line1,
            address.address_line2,
            address.city,
            address.state,
            address.country,
            address.address_type
        FROM `tabAddress` address
        INNER JOIN `tabDynamic Link` link
            ON (address.name = link.parent)
        WHERE
            link.link_doctype = 'Customer'
            AND link.link_name = %s
            AND address.disabled = 0
            AND address.address_type = 'Shipping'
        ORDER BY address.creation DESC
        LIMIT 1
        """,
        (customer.name,),
        as_dict=True
    )

    if addresses:
        
        addr = addresses[0]
        res["address_line1"] = addr.address_line1 or ""
        res["address_line2"] = addr.address_line2 or ""
        res["city"] = addr.city or ""
        res["state"] = addr.state or ""
        res["country"] = addr.country or ""

    return res


def get_company_domain(company):
    return frappe.get_cached_value("Company", cstr(company), "domain")


@frappe.whitelist()
def get_applicable_delivery_charges(
    company, pos_profile, customer, shipping_address_name=None
):
    return _get_applicable_delivery_charges(
        company, pos_profile, customer, shipping_address_name
    )


def auto_create_items():
    # create 20000 items
    for i in range(20000):
        item_code = "AUTO-ITEM-{}".format(i)
        item = frappe.get_doc(
            {
                "doctype": "Item",
                "item_code": item_code,
                "item_name": item_code,
                "description": item_code,
                "item_group": "Auto Items",
                "is_stock_item": 0,
                "stock_uom": "Nos",
                "is_sales_item": 1,
                "is_purchase_item": 0,
                "is_fixed_asset": 0,
                "is_sub_contracted_item": 0,
                "is_pro_applicable": 0,
                "is_manufactured_item": 0,
                "is_service_item": 0,
                "is_non_stock_item": 0,
                "is_batch_item": 0,
                "is_table_item": 0,
                "is_variant_item": 0,
                "is_stock_item": 1,
                "opening_stock": 1000,
                "valuation_rate": 50 + i,
                "standard_rate": 100 + i,
            }
        )
        print("Creating Item: {}".format(item_code))
        item.insert(ignore_permissions=True)
        frappe.db.commit()


@frappe.whitelist()
def search_serial_or_batch_or_barcode_number(search_value, search_serial_no):
    # search barcode no
    barcode_data = frappe.db.get_value(
        "Item Barcode",
        {"barcode": search_value},
        ["barcode", "parent as item_code"],
        as_dict=True,
    )
    if barcode_data:
        return barcode_data
    # search serial no
    if search_serial_no:
        serial_no_data = frappe.db.get_value(
            "Serial No", search_value, ["name as serial_no", "item_code"], as_dict=True
        )
        if serial_no_data:
            return serial_no_data
    # search batch no
    batch_no_data = frappe.db.get_value(
        "Batch", search_value, ["name as batch_no", "item as item_code"], as_dict=True
    )
    if batch_no_data:
        return batch_no_data
    return {}


def get_seearch_items_conditions(item_code, serial_no, batch_no, barcode):
    if serial_no or batch_no or barcode:
        return " and name = {0}".format(frappe.db.escape(item_code))
    return """ and (name like {item_code} or item_name like {item_code})""".format(
        item_code=frappe.db.escape("%" + item_code + "%")
    )


@frappe.whitelist()
def create_sales_invoice_from_order(sales_order):
    sales_invoice = make_sales_invoice(sales_order, ignore_permissions=True)
    sales_invoice.save()
    return sales_invoice


@frappe.whitelist()
def delete_sales_invoice(sales_invoice):
    frappe.delete_doc("Sales Invoice", sales_invoice)


@frappe.whitelist()
def get_sales_invoice_child_table(sales_invoice, sales_invoice_item):
    parent_doc = frappe.get_doc("Sales Invoice", sales_invoice)
    child_doc = frappe.get_doc(
        "Sales Invoice Item", {"parent": parent_doc.name, "name": sales_invoice_item}
    )
    return child_doc

@frappe.whitelist()
def update_invoice_from_order(data):
     data = json.loads(data)
     invoice_doc = frappe.get_doc("Sales Invoice", data.get("name"))
     invoice_doc.update(data)
     invoice_doc.save()
     return invoice_doc

@frappe.whitelist()
def validate_return_items(return_against, items):
     """Custom validation for return items"""
     # If no return_against (return without invoice), skip validation
     if not return_against:
         return {"valid": True}
         
     original_invoice = frappe.get_doc("Sales Invoice", return_against)
     
     # Create lookup for original items
     original_items = {}
     for item in original_invoice.items:
         # Use item_code as key since that's what we're matching against
         if item.item_code not in original_items:
             original_items[item.item_code] = {
                 'qty': item.qty,
                 'rate': item.rate
             }
         else:
             original_items[item.item_code]['qty'] += item.qty
 
     # Validate return items
     for item in items:
         item_code = item.get('item_code')
         if item_code not in original_items:
             return {
                 "valid": False,
                 "message": f"Item {item_code} not found in original invoice"
             }
         
         return_qty = abs(float(item.get('qty')))
         if return_qty > original_items[item_code]['qty']:
             return {
                 "valid": False, 
                 "message": f"Return quantity {return_qty} exceeds original quantity {original_items[item_code]['qty']} for item {item_code}"
             }
             
         original_items[item_code]['qty'] -= return_qty
 
     return {"valid": True}

@frappe.whitelist()
def get_available_currencies():
    """Get list of available currencies from ERPNext"""
    return frappe.get_all("Currency", fields=["name", "currency_name"], 
                         filters={"enabled": 1}, order_by="currency_name")




@frappe.whitelist()
def get_app_info() -> Dict[str, List[Dict[str, str]]]:
    """
    Return a list of installed apps and their versions,
    as recorded in the Installed Application DocType.
    """
    # Fetch raw records from the DocType
    app_records = frappe.get_all(
        "Installed Application",
        fields=["app_name", "app_version"],
        order_by="app_name asc"
    )

    # Transform into the shape your API expects
    apps_info = [
        {
            "app_name": record["app_name"],
            "installed_version": record["app_version"]
        }
        for record in app_records
    ]

    return {"apps": apps_info}
