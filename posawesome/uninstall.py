import frappe


def after_uninstall():
    clear_custom_fields_and_properties()
    remove_delivery_charges_field()


def clear_custom_fields_and_properties():
    fixtures = frappe.get_hooks("fixtures", app_name="posawesome")
    for fixture in fixtures:
        doctype = fixture.get("doctype")
        if not doctype:
            continue

        filters = fixture.get("filters") or []

        for f in filters:
            # fixture filters are defined as lists like ["name", "in", (<values>)]
            if isinstance(f, (list, tuple)) and len(f) == 3:
                f = {f[0]: (f[1], f[2])}

            frappe.db.delete(doctype, f)
            print(f"Deleted {doctype}: ", f)

    frappe.db.commit()


def remove_delivery_charges_field():
    # Remove posa_delivery_charges field from Sales Invoice
    frappe.db.delete("Custom Field", "Sales Invoice-posa_delivery_charges")
    frappe.db.delete("Custom Field", "Sales Invoice-posa_delivery_charges_rate")
    frappe.db.commit()
    print("Removed delivery charges fields from Sales Invoice")
