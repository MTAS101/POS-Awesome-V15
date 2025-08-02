# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe

def before_migrate():
	"""
	Fast delete all Custom Field documents before migration using SQL
	"""
	try:
		print("Starting Custom Field cleanup...")
		
		# Get count of Custom Field documents
		count = frappe.db.sql("SELECT COUNT(*) FROM `tabCustom Field`")[0][0]
		print(f"Found {count} Custom Field documents to delete")
		
		if count == 0:
			print("No Custom Field documents found to delete")
			return
		
		# Delete all Custom Fields using SQL
		frappe.db.sql("DELETE FROM `tabCustom Field`")
		print(f"✅ Deleted {count} Custom Field documents")
		
		# Delete related Property Setter records
		property_count = frappe.db.sql("SELECT COUNT(*) FROM `tabProperty Setter` WHERE doc_type = 'Custom Field'")[0][0]
		if property_count > 0:
			frappe.db.sql("DELETE FROM `tabProperty Setter` WHERE doc_type = 'Custom Field'")
			print(f"✅ Deleted {property_count} Property Setter records")
		
		# Commit the transaction
		frappe.db.commit()
		
		# Verify deletion
		remaining = frappe.db.sql("SELECT COUNT(*) FROM `tabCustom Field`")[0][0]
		print(f"Remaining Custom Field documents: {remaining}")
		
		print("✅ Custom Field cleanup completed successfully")
		
	except Exception as e:
		print(f"Error in before_migrate: {str(e)}")
		frappe.db.rollback() 