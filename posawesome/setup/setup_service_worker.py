# -*- coding: utf-8 -*-
# Copyright (c) 2023, Youssef Restom and contributors
# For license information, please see license.txt

import os
import shutil
import frappe

def setup_service_worker():
    """
    Copy service worker to the sites/assets directory for proper scope access
    """
    source_file = frappe.get_app_path("posawesome", "public", "js", "service-worker.js")
    dest_dir = os.path.join(frappe.local.sites_path, "assets")
    dest_file = os.path.join(dest_dir, "service-worker.js")
    
    # Create directory if it doesn't exist
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)
    
    # Copy the file
    shutil.copy2(source_file, dest_file)
    
    frappe.msgprint("Service worker has been installed at the site level")
    
    return "Service worker setup completed"

def after_install():
    """Setup service worker after app installation"""
    setup_service_worker()

def after_migrate():
    """Setup service worker after migration"""
    setup_service_worker() 