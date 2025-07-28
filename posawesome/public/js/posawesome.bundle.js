import "./toConsole";
import "./posapp/posapp";
import "./utils/clearAllCaches";

// Ensure frappe.PosApp is available globally
if (typeof window !== "undefined" && window.frappe) {
    // The posapp module should have already set up frappe.PosApp
    console.log("PosAwesome bundle loaded, frappe.PosApp should be available");
}
