import os
import subprocess
import frappe

def before_build():
    """Run npm install before bench build"""
    try:
        app_path = frappe.get_app_path('posawesome')
        
        # Change directory to app path
        os.chdir(app_path)
        
        # Run npm install
        subprocess.check_call(['npm', 'install'])
        
        frappe.log_error("Successfully ran npm install for posawesome", "Build Setup")
        return True
        
    except Exception as e:
        frappe.log_error(f"Error running npm install: {str(e)}", "Build Setup Error")
        return False 