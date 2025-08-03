# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe


def before_migrate():
    """Remove POS Profile custom fields before migration"""
    try:
        print("Starting POS Profile Custom Field cleanup...")

        # Get count of Custom Field documents for POS Profile
        count = frappe.db.sql("SELECT COUNT(*) FROM `tabCustom Field` WHERE dt = 'POS Profile'")[0][0]
        print(f"Found {count} POS Profile Custom Field documents to delete")

        if count == 0:
            print("No POS Profile Custom Field documents found to delete")
            return

        # Delete POS Profile Custom Fields using SQL
        frappe.db.sql("DELETE FROM `tabCustom Field` WHERE dt = 'POS Profile'")
        print(f"✅ Deleted {count} POS Profile Custom Field documents")

        # Delete related Property Setter records
        property_count = frappe.db.sql("SELECT COUNT(*) FROM `tabProperty Setter` WHERE doc_type = 'POS Profile'")[0][0]
        if property_count > 0:
            frappe.db.sql("DELETE FROM `tabProperty Setter` WHERE doc_type = 'POS Profile'")
            print(f"✅ Deleted {property_count} Property Setter records for POS Profile")

        # Commit the transaction
        frappe.db.commit()

        # Verify deletion
        remaining = frappe.db.sql("SELECT COUNT(*) FROM `tabCustom Field` WHERE dt = 'POS Profile'")[0][0]
        print(f"Remaining POS Profile Custom Field documents: {remaining}")

        print("✅ POS Profile Custom Field cleanup completed successfully")
    except Exception as e:
        print(f"Error in before_migrate: {str(e)}")
        frappe.db.rollback()

