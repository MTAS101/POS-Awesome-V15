import "posapp/posapp.js";

// Initialize POS Awesome Vue app if available
if (window.frappe && frappe.PosApp && frappe.PosApp.posapp) {
  frappe.ready(() => {
    if (!document.getElementById("app")) return;
    const page = { page: {}, $el: [document.getElementById("app")] };
    new frappe.PosApp.posapp(page);
  });
}
