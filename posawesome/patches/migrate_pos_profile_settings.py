import frappe


def execute():
    """Migrate existing POSAwesome custom fields into POS Awesome User Profile Settings."""
    frappe.reload_doc(
        "pos_awesome_config", "doctype", "pos_awesome_user_profile_settings"
    )

    meta = frappe.get_meta("POS Awesome User Profile Settings")
    fields = [df.fieldname for df in meta.fields if df.fieldname != "user"]

    # create settings per user based on their linked POS Profile
    profile_users = frappe.get_all("POS Profile User", fields=["parent", "user"])
    for row in profile_users:
        profile_doc = frappe.get_doc("POS Profile", row.parent)
        settings = frappe.db.exists(
            "POS Awesome User Profile Settings", {"user": row.user}
        )
        if settings:
            settings = frappe.get_doc("POS Awesome User Profile Settings", settings)
        else:
            settings = frappe.new_doc("POS Awesome User Profile Settings")
            settings.user = row.user
        for field in fields:
            if field in profile_doc.as_dict():
                settings.set(field, profile_doc.get(field))
        settings.save()

    # remove migrated custom fields from POS Profile only
    for field in fields:
        custom_field_names = frappe.get_all(
            "Custom Field",
            filters={"fieldname": field, "dt": "POS Profile"},
            pluck="name",
        )
        for name in custom_field_names:
            frappe.delete_doc("Custom Field", name, ignore_missing=True)

    frappe.clear_cache()
