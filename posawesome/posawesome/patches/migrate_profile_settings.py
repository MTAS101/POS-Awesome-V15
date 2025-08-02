import frappe


def execute():
	frappe.reload_doc("posawesome", "doctype", "pos_profile_settings")
	profile_names = frappe.get_all("POS Profile", pluck="name")
	if not profile_names:
		return

	meta = frappe.get_meta("POS Profile Settings")
	fields = [
		df.fieldname
		for df in meta.fields
		if df.fieldtype not in {"Section Break", "Column Break", "HTML", "Fold", "Button", "Table", "Table MultiSelect"}
		and df.fieldname != "pos_profile"
	]

	for name in profile_names:
		profile_doc = frappe.get_doc("POS Profile", name)
		if frappe.db.exists("POS Profile Settings", name):
			settings_doc = frappe.get_doc("POS Profile Settings", name)
		else:
			settings_doc = frappe.new_doc("POS Profile Settings")
			settings_doc.pos_profile = name

		for field in fields:
			settings_doc.set(field, profile_doc.get(field))

		settings_doc.save(ignore_permissions=True)
