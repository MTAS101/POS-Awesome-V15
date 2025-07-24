import "@public/toConsole.js";
import "@public/posapp/posapp.js";
import "@public/utils/clearAllCaches.js";

// Initialize POS Awesome Vue app if available
if (window.frappe && window.frappe.PosApp && window.frappe.PosApp.posapp) {
  frappe.ready(() => {
    const appEl = document.getElementById("app");
    if (!appEl) return;
    const page = { page: {}, $el: [appEl] };
    new frappe.PosApp.posapp(page);
  });
}
