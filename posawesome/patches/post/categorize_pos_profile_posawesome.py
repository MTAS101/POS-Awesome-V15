import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

DT = "POS Profile"

SECTIONS = [
    {
        "label": "POS Awesome \u2022 Payments & Cash Handling",
        "section_field": "posa_payments_cash_section",
        "left_col": "posa_payments_cash_left",
        "right_col": "posa_payments_cash_right",
        "left_fields": [
            "posa_cash_mode_of_payment",
            "posa_allow_partial_payment",
            "posa_allow_credit_sale",
            "posa_allow_write_off_change",
        ],
        "right_fields": [
            "use_cashback",
            "use_customer_credit",
            "posa_hide_closing_shift",
            "hide_expected_amount",
        ],
    },
    {
        "label": "POS Awesome \u2022 Discounts & Pricing",
        "section_field": "posa_discounts_pricing_section",
        "left_col": "posa_discounts_pricing_left",
        "right_col": "posa_discounts_pricing_right",
        "left_fields": [
            "posa_allow_user_to_edit_rate",
            "posa_allow_user_to_edit_additional_discount",
            "posa_allow_user_to_edit_item_discount",
            "posa_use_percentage_discount",
            "posa_max_discount_allowed",
        ],
        "right_fields": [
            "posa_apply_customer_discount",
            "posa_allow_price_list_rate_change",
            "posa_enable_price_list_dropdown",
            "posa_display_discount_amount",
            "posa_display_discount_percentage",
            "posa_allow_zero_rated_items",
            "posa_fetch_coupon",
        ],
    },
    {
        "label": "POS Awesome \u2022 Invoice & Sales Order Control",
        "section_field": "posa_invoice_sales_section",
        "left_col": "posa_invoice_sales_left",
        "right_col": "posa_invoice_sales_right",
        "left_fields": [
            "posa_allow_delete",
            "posa_allow_change_posting_date",
            "posa_default_sales_order",
            "posa_allow_sales_order",
            "custom_allow_select_sales_order",
        ],
        "right_fields": [
            "posa_create_only_sales_order",
            "posa_allow_customer_purchase_order",
            "posa_input_qty",
            "posa_decimal_precision",
        ],
    },
    {
        "label": "POS Awesome \u2022 Returns & Batch Handling",
        "section_field": "posa_returns_batch_section",
        "left_col": "posa_returns_batch_left",
        "right_col": "posa_returns_batch_right",
        "left_fields": [
            "posa_allow_return",
            "posa_allow_return_without_invoice",
        ],
        "right_fields": [
            "posa_allow_free_batch_return",
            "posa_auto_set_batch",
        ],
    },
    {
        "label": "POS Awesome \u2022 Item Display & Stock",
        "section_field": "posa_item_display_section",
        "left_col": "posa_item_display_left",
        "right_col": "posa_item_display_right",
        "left_fields": [
            "posa_display_items_in_stock",
            "posa_display_item_code",
            "posa_show_template_items",
        ],
        "right_fields": [
            "posa_hide_variants_items",
            "posa_block_sale_beyond_available_qty",
        ],
    },
    {
        "label": "POS Awesome \u2022 Scanning & Barcodes",
        "section_field": "posa_scanning_section",
        "left_col": "posa_scanning_left",
        "right_col": "posa_scanning_right",
        "left_fields": [
            "posa_scale_barcode_start",
            "posa_enable_camera_scanning",
        ],
        "right_fields": [
            "posa_search_serial_no",
            "posa_search_batch_no",
        ],
    },
    {
        "label": "POS Awesome \u2022 UI & Display Settings",
        "section_field": "posa_ui_display_section",
        "left_col": "posa_ui_display_left",
        "right_col": "posa_ui_display_right",
        "left_fields": [
            "posa_show_customer_balance",
            "posa_default_card_view",
            "posa_language",
        ],
        "right_fields": [
            "posa_display_additional_notes",
            "posa_show_custom_name_marker_on_print",
            "posa_allow_line_item_name_override",
        ],
    },
    {
        "label": "POS Awesome \u2022 Printing & Drafts",
        "section_field": "posa_printing_drafts_section",
        "left_col": "posa_printing_drafts_left",
        "right_col": "posa_printing_drafts_right",
        "left_fields": [
            "posa_allow_print_last_invoice",
            "posa_allow_print_draft_invoices",
            "posa_silent_print",
        ],
        "right_fields": [
            "posa_allow_delete_offline_invoice",
            "posa_new_line",
        ],
    },
    {
        "label": "POS Awesome \u2022 Delivery & Charges",
        "section_field": "posa_delivery_charges_section",
        "left_col": "posa_delivery_charges_left",
        "right_col": "posa_delivery_charges_right",
        "left_fields": [
            "posa_use_delivery_charges",
        ],
        "right_fields": [
            "posa_auto_set_delivery_charges",
        ],
    },
    {
        "label": "POS Awesome \u2022 Customer Handling",
        "section_field": "posa_customer_handling_section",
        "left_col": "posa_customer_handling_left",
        "right_col": "posa_customer_handling_right",
        "left_fields": [
            "posa_allow_duplicate_customer_names",
        ],
        "right_fields": [],
    },
    {
        "label": "POS Awesome \u2022 Payments (Module)",
        "section_field": "posa_payments_module_section",
        "left_col": "posa_payments_module_left",
        "right_col": "posa_payments_module_right",
        "left_fields": [
            "posa_use_pos_awesome_payments",
            "posa_allow_make_new_payments",
        ],
        "right_fields": [
            "posa_allow_reconcile_payments",
            "posa_allow_mpesa_reconcile_payments",
        ],
    },
    {
        "label": "POS Awesome \u2022 Advanced / Performance",
        "section_field": "posa_advanced_performance_section",
        "left_col": "posa_advanced_performance_left",
        "right_col": "posa_advanced_performance_right",
        "left_fields": [
            "posa_allow_submissions_in_background_job",
            "posa_tax_inclusive",
            "posa_local_storage",
            "posa_force_server_items",
            "posa_use_server_cache",
        ],
        "right_fields": [
            "posa_force_reload_items",
            "posa_smart_reload_mode",
            "posa_server_cache_duration",
            "pose_use_limit_search",
            "posa_allow_multi_currency",
        ],
    },
    {
        "label": "POS Awesome \u2022 System Gadgets / Monitoring",
        "section_field": "posa_system_gadgets_section",
        "left_col": "posa_system_gadgets_left",
        "right_col": "posa_system_gadgets_right",
        "left_fields": [
            "posa_show_cpu_load_gadget",
        ],
        "right_fields": [
            "posa_show_database_usage_gadget",
        ],
    },
    {
        "label": "POS Awesome \u2022 Miscellaneous",
        "section_field": "posa_miscellaneous_section",
        "left_col": "posa_miscellaneous_left",
        "right_col": "posa_miscellaneous_right",
        "left_fields": [
            "posa_default_country",
        ],
        "right_fields": [],
    },
]

OLD_SECTIONS = [
    "POS Awesome Settings",
    "POS Awesome Payments",
    "POS Awesome Advance Settings",
]


def create_sections():
    anchor = "company_address"
    for sec in SECTIONS:
        fields = [
            {
                "fieldname": sec["section_field"],
                "label": sec["label"],
                "fieldtype": "Section Break",
                "collapsible": 1,
                "insert_after": anchor,
            },
            {
                "fieldname": sec["left_col"],
                "fieldtype": "Column Break",
                "insert_after": sec["section_field"],
            },
            {
                "fieldname": sec["right_col"],
                "fieldtype": "Column Break",
                "insert_after": sec["left_col"],
            },
        ]
        create_custom_fields({DT: fields}, ignore_validate=True)
        for f in fields:
            frappe.db.set_value("Custom Field", f"{DT}-{f['fieldname']}", "insert_after", f["insert_after"])
        anchor = sec["right_col"]


def move_fields_in_order(fieldnames, insert_after):
    prev = insert_after
    for fname in fieldnames:
        name = frappe.db.get_value("Custom Field", {"dt": DT, "fieldname": fname}, "name")
        if not name:
            continue
        frappe.db.set_value("Custom Field", name, "insert_after", prev)
        prev = fname


def hide_old_sections():
    for label in OLD_SECTIONS:
        name = frappe.db.get_value("Custom Field", {"dt": DT, "label": label}, "name")
        if name:
            frappe.db.set_value("Custom Field", name, "hidden", 1)


def execute():
    create_sections()
    for sec in SECTIONS:
        move_fields_in_order(sec["left_fields"], sec["left_col"])
        move_fields_in_order(sec["right_fields"], sec["right_col"])
    hide_old_sections()
    frappe.clear_cache(doctype=DT)
