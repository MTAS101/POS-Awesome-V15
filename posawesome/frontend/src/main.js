const script = document.createElement("script");
script.src = "/assets/posawesome/js/posawesome.bundle.js";
script.type = "module";
document.head.appendChild(script);

// Initialize POS Awesome Vue app if available
if (window.frappe && frappe.PosApp && frappe.PosApp.posapp) {
  frappe.ready(() => {
    if (!document.getElementById("app")) return;
    const page = { page: { }, $el: [document.getElementById("app")] };
    new frappe.PosApp.posapp(page);
  });
}
