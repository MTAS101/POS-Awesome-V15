import frappe
from frappe.model.document import Document

class POSAwesomeSyncLog(Document):
    def validate(self):
        # Ensure idempotency key is unique
        if self.is_new():
            existing = frappe.db.exists(
                "POS Awesome Sync Log",
                {"idempotency_key": self.idempotency_key}
            )
            if existing:
                frappe.throw(_("Duplicate idempotency key found"))
                
    def after_insert(self):
        # Clean up old logs (keep last 1000)
        self.cleanup_old_logs()
        
    def cleanup_old_logs(self):
        """Keep only the last 1000 logs"""
        try:
            count = frappe.db.count("POS Awesome Sync Log")
            if count > 1000:
                # Get the creation date of 1000th record
                date_limit = frappe.db.sql("""
                    SELECT creation 
                    FROM `tabPOS Awesome Sync Log`
                    ORDER BY creation DESC
                    LIMIT 1 OFFSET 999
                """)[0][0]
                
                # Delete older records
                frappe.db.sql("""
                    DELETE FROM `tabPOS Awesome Sync Log`
                    WHERE creation < %s
                """, (date_limit,))
                
                frappe.db.commit()
        except Exception as e:
            frappe.log_error("Error cleaning up old sync logs", str(e)) 