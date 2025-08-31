import frappe

SOURCE = "POS Profile"
TARGET = "POSA Profile"

FIELD_MAP = {
    # if any rename needed
    # "old_fieldname": "posa_new_fieldname"
}

def execute():
    if not frappe.db.exists("DocType", SOURCE):
        frappe.throw("POS Profile DocType not found, cannot migrate")

    frappe.reload_doc("posawesome", "doctype", "posa_profile")
    src_docs = frappe.get_all(SOURCE, fields=["name"])
    for row in src_docs:
        src = frappe.get_doc(SOURCE, row.name)
        if frappe.db.exists(TARGET, {"name": src.name}):
            continue
        tgt = frappe.new_doc(TARGET)
        for df in frappe.get_meta(SOURCE).fields:
            fn = df.fieldname
            if not fn:
                continue
            val = src.get(fn)
            if fn in FIELD_MAP:
                tgt.set(FIELD_MAP[fn], val)
            else:
                if fn in frappe.get_meta(TARGET).get_fieldnames():
                    tgt.set(fn, val)
        tgt.insert(ignore_permissions=True)

    frappe.db.commit()
