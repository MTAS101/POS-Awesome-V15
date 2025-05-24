import { InvoiceQueue } from './InvoiceQueue';
import { NetworkService } from './NetworkService';

/**
 * Generic API call wrapper around frappe.call that handles offline queueing for invoice operations
 * @param {Object} params - API call parameters
 * @param {string} params.method - Frappe API method name
 * @param {Object} params.args - Method arguments
 * @param {boolean} params.isInvoice - Whether this is an invoice-related operation
 * @returns {Promise} API call response
 */
export async function apiCall({method, args, isInvoice = false}) {
  // Check network status
  if (!NetworkService.isOnline) {
    const error = new Error('No network connection');
    error.isOffline = true;
    
    if (isInvoice) {
      await InvoiceQueue.add({
        method,
        args,
        lastError: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    throw error;
  }

  try {
    const response = await frappe.call({method, args});
    return response;
  } catch (err) {
    // Check if error is due to network
    if (!navigator.onLine || err.message.includes('network') || err.message.includes('disconnected')) {
      NetworkService.handleOffline();
      
      if (isInvoice) {
        await InvoiceQueue.add({
          method,
          args,
          lastError: err.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    throw err;
  }
}

// Common API methods
export const API_METHODS = {
  SUBMIT_INVOICE: 'posawesome.posawesome.api.posapp.submit_invoice',
  UPDATE_INVOICE: 'posawesome.posawesome.api.posapp.update_invoice',
  CREATE_PAYMENT_REQUEST: 'posawesome.posawesome.api.posapp.create_payment_request',
  GET_DRAFT_INVOICES: 'posawesome.posawesome.api.posapp.get_draft_invoices',
  DELETE_INVOICE: 'posawesome.posawesome.api.posapp.delete_invoice',
  GET_ADDRESSES: 'posawesome.posawesome.api.posapp.get_customer_addresses',
  GET_SALES_PERSONS: 'posawesome.posawesome.api.posapp.get_sales_person_names',
  UPDATE_ITEMS: 'posawesome.posawesome.api.posapp.get_items_details'
};

// Helper to check if method is invoice-related
export function isInvoiceMethod(method) {
  return Object.values(API_METHODS).includes(method);
}

// Helper to check if method requires network
export function requiresNetwork(method) {
  return !method.startsWith('local.');
} 