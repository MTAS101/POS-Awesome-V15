import { InvoiceQueue } from './InvoiceQueue';

/**
 * Generic API call wrapper around frappe.call that handles offline queueing for invoice operations
 * @param {Object} params - API call parameters
 * @param {string} params.method - Frappe API method name
 * @param {Object} params.args - Method arguments
 * @param {boolean} params.isInvoice - Whether this is an invoice-related operation
 * @returns {Promise} API call response
 */
export async function apiCall({method, args, isInvoice = false}) {
  try {
    const response = await frappe.call({method, args});
    return response;
  } catch (err) {
    // Queue failed invoice operations for retry when back online
    if (isInvoice) {
      await InvoiceQueue.add({
        method,
        args,
        lastError: err.message,
        timestamp: new Date().toISOString()
      });
    }
    throw err; // Re-throw to let caller handle error
  }
}

// Common API methods
export const API_METHODS = {
  SUBMIT_INVOICE: 'posawesome.posawesome.api.posapp.submit_invoice',
  UPDATE_INVOICE: 'posawesome.posawesome.api.posapp.update_invoice',
  CREATE_PAYMENT_REQUEST: 'posawesome.posawesome.api.posapp.create_payment_request',
  GET_DRAFT_INVOICES: 'posawesome.posawesome.api.posapp.get_draft_invoices',
  DELETE_INVOICE: 'posawesome.posawesome.api.posapp.delete_invoice'
};

// Helper to check if method is invoice-related
export function isInvoiceMethod(method) {
  return Object.values(API_METHODS).includes(method);
} 