import frappe

custom_fields = [
    "posa_pos_awesome_settings",
    "posa_cash_mode_of_payment",
    "posa_allow_delete",
    "posa_allow_user_to_edit_rate",
    "posa_allow_user_to_edit_additional_discount",
    "posa_use_percentage_discount",
    "posa_max_discount_allowed",
    "posa_scale_barcode_start",
    "posa_enable_camera_scanning",
    "posa_camera_scan_type",
    "posa_allow_change_posting_date",
    "posa_show_customer_balance",
    "posa_default_card_view",
    "posa_default_sales_order",
    "posa_col_1",
    "posa_allow_user_to_edit_item_discount",
    "posa_display_items_in_stock",
    "posa_allow_partial_payment",
    "posa_allow_credit_sale",
    "posa_allow_return",
    "posa_apply_customer_discount",
    "use_cashback",
    "use_customer_credit",
    "posa_hide_closing_shift",
    "posa_auto_set_batch",
    "posa_display_item_code",
    "posa_allow_zero_rated_items",
    "hide_expected_amount",
    "posa_column_break_112",
    "posa_allow_sales_order",
    "custom_allow_select_sales_order",
    "posa_create_only_sales_order",
    "posa_show_template_items",
    "posa_hide_variants_items",
    "posa_fetch_coupon",
    "posa_allow_customer_purchase_order",
    "posa_allow_print_last_invoice",
    "posa_display_additional_notes",
    "posa_allow_write_off_change",
    "posa_new_line",
    "posa_input_qty",
    "posa_allow_print_draft_invoices",
    "posa_use_delivery_charges",
    "posa_auto_set_delivery_charges",
    "posa_allow_duplicate_customer_names",
    "pos_awesome_payments",
    "posa_use_pos_awesome_payments",
    "column_break_uolvm",
    "posa_allow_make_new_payments",
    "posa_allow_reconcile_payments",
    "posa_allow_mpesa_reconcile_payments",
    "posa_pos_awesome_advance_settings",
    "posa_allow_submissions_in_background_job",
    "posa_search_serial_no",
    "posa_search_batch_no",
    "posa_tax_inclusive",
    "column_break_dqsba",
    "posa_local_storage",
    "posa_use_server_cache",
    "posa_server_cache_duration",
    "column_break_anyol",
    "pose_use_limit_search",
    "posa_search_limit",
    "posa_allow_return_without_invoice",
    "posa_allow_multi_currency",
    "posa_allow_delete_offline_invoice",
    "posa_allow_price_list_rate_change",
    "posa_decimal_precision",
    "posa_force_reload_items",
    "posa_smart_reload_mode",
    "posa_display_discount_percentage",
    "posa_display_discount_amount",
    "posa_silent_print",
    "posa_language",
    "posa_currency",
    "posa_default_country",
]

def execute():
    # ensure the new DocType definition is available during patch execution
    frappe.reload_doc("posawesome", "doctype", "pos_profile_awesome")

    for old in frappe.get_all("POS Profile", pluck="name"):
        src = frappe.get_doc("POS Profile", old)
        if not frappe.db.exists("POS Profile Awesome", src.name):
            doc = {
                "doctype": "POS Profile Awesome",
                "name": src.name,
                "currency": src.get("currency"),
                "posa_language": src.get("posa_language"),
                "posa_currency": src.get("posa_currency"),
            }
            doc.update({f: src.get(f) for f in custom_fields})
            tgt = frappe.get_doc(doc)
            tgt.insert(ignore_permissions=True)
        else:
            tgt = frappe.get_doc("POS Profile Awesome", src.name)
            updated = False
            for field in ["posa_language", "posa_currency", "currency"]:
                if not tgt.get(field) and src.get(field):
                    tgt.set(field, src.get(field))
                    updated = True
            if updated:
                tgt.save(ignore_permissions=True)

        # mark old custom fields read only
        for field in custom_fields:
            cf_name = f"POS Profile-{field}"
            if frappe.db.exists("Custom Field", cf_name):
                frappe.db.set_value("Custom Field", cf_name, "read_only", 1)

