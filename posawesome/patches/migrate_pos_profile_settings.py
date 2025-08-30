import frappe


def execute():
    """Migrate existing POSAwesome custom fields into POS Awesome User Profile Settings."""
    frappe.reload_doc("pos_awesome_config", "doctype", "pos_awesome_user_profile_settings")

    try:
        settings = frappe.get_single("POS Awesome User Profile Settings")
    except frappe.DoesNotExistError:
        settings = frappe.new_doc("POS Awesome User Profile Settings")
        settings.insert(ignore_permissions=True)

    # list of fields to migrate
    fields = [
        "posa_cash_mode_of_payment",
        "posa_allow_partial_payment",
        "posa_allow_credit_sale",
        "posa_allow_write_off_change",
        "use_cashback",
        "use_customer_credit",
        "posa_hide_closing_shift",
        "hide_expected_amount",
        "posa_allow_user_to_edit_rate",
        "posa_allow_user_to_edit_additional_discount",
        "posa_allow_user_to_edit_item_discount",
        "posa_use_percentage_discount",
        "posa_max_discount_allowed",
        "posa_apply_customer_discount",
        "posa_allow_price_list_rate_change",
        "posa_enable_price_list_dropdown",
        "posa_display_discount_amount",
        "posa_display_discount_percentage",
        "posa_allow_zero_rated_items",
        "posa_fetch_coupon",
        "posa_allow_delete",
        "posa_allow_change_posting_date",
        "posa_default_sales_order",
        "posa_allow_sales_order",
        "custom_allow_select_sales_order",
        "posa_create_only_sales_order",
        "posa_allow_customer_purchase_order",
        "create_pos_invoice_instead_of_sales_invoice",
        "posa_input_qty",
        "posa_decimal_precision",
        "posa_allow_return",
        "posa_allow_return_without_invoice",
        "posa_allow_free_batch_return",
        "posa_auto_set_batch",
        "posa_display_items_in_stock",
        "posa_display_item_code",
        "posa_show_template_items",
        "posa_hide_variants_items",
        "posa_block_sale_beyond_available_qty",
        "posa_scale_barcode_start",
        "posa_enable_camera_scanning",
        "posa_search_serial_no",
        "posa_search_batch_no",
        "posa_show_customer_balance",
        "posa_default_card_view",
        "posa_language",
        "posa_display_additional_notes",
        "posa_show_custom_name_marker_on_print",
        "posa_allow_line_item_name_override",
        "posa_allow_print_last_invoice",
        "posa_allow_print_draft_invoices",
        "posa_silent_print",
        "posa_allow_delete_offline_invoice",
        "posa_new_line",
        "posa_use_delivery_charges",
        "posa_auto_set_delivery_charges",
        "posa_allow_duplicate_customer_names",
        "posa_use_pos_awesome_payments",
        "posa_allow_make_new_payments",
        "posa_allow_reconcile_payments",
        "posa_allow_mpesa_reconcile_payments",
        "posa_allow_submissions_in_background_job",
        "posa_tax_inclusive",
        "posa_local_storage",
        "posa_force_server_items",
        "posa_use_server_cache",
        "posa_force_reload_items",
        "posa_smart_reload_mode",
        "posa_server_cache_duration",
        "pose_use_limit_search",
        "posa_allow_multi_currency",
        "posa_show_cpu_load_gadget",
        "posa_show_database_usage_gadget",
        "posa_default_country",
    ]

    profile = frappe.get_all("POS Profile", limit=1)
    if profile:
        doc = frappe.get_doc("POS Profile", profile[0].name)
        for field in fields:
            if field in doc.as_dict():
                settings.set(field, doc.get(field))
    settings.save()
