/* global frappe */
import { getPrintTemplate, getTermsAndConditions } from "./offline/index.js";

export default function renderOfflineInvoiceHTML(invoice) {
        if (!invoice) return "";

        const template = getPrintTemplate();
        const terms = getTermsAndConditions();
        if (!template) {
                console.warn("No offline print template cached");
                return "";
        }

        try {
                return frappe.render_template(template, {
                        doc: invoice,
                        terms,
                        terms_and_conditions: terms,
                });
        } catch (e) {
                console.error("Failed to render offline invoice", e);
                return "";
        }
}
