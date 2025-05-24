# -*- coding: utf-8 -*-
# Copyright (c) 2023, Youssef Restom and contributors
# For license information, please see license.txt

import frappe

def service_worker_middleware(app):
    """
    Middleware to add Service-Worker-Allowed header to service worker responses
    """
    @app.route('/assets/posawesome/js/service-worker.js', methods=['GET'])
    def handle_service_worker():
        """
        Add Service-Worker-Allowed header to service worker response to allow broader scope
        """
        # Get the original response
        response = app.get_response('/assets/posawesome/js/service-worker.js')
        
        # Add Service-Worker-Allowed header to allow the service worker to control paths under /app/
        response.headers['Service-Worker-Allowed'] = '/'
        
        return response
    
    return app 