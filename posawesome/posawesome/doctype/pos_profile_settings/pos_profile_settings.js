// Copyright (c) 2024, POS Awesome and contributors
// For license information, please see license.txt

frappe.ui.form.on("POS Profile Settings", {
    setup: function (frm) {
        frm.set_query("pos_profile", function () {
            return {
                filters: {
                    disabled: 0
                }
            };
        });

        frm.set_query("warehouse", function () {
            return {
                filters: {
                    company: frm.doc.company,
                    is_group: 0
                }
            };
        });

        frm.set_query("posa_cash_mode_of_payment", function () {
            return {
                filters: {
                    type: "Cash"
                }
            };
        });
    },

    refresh: function (frm) {
        // Add custom buttons
        if (!frm.doc.__islocal) {
            frm.add_custom_button(__("Duplicate"), function () {
                frm.trigger("duplicate_profile");
            });

            frm.add_custom_button(__("Apply to POS Profile"), function () {
                frm.trigger("apply_to_pos_profile");
            });

            frm.add_custom_button(__("Create POS Profile"), function () {
                frm.trigger("create_pos_profile");
            });
        }

        if (frm.doc.is_active) {
            frm.add_custom_button(__("Deactivate"), function () {
                frm.trigger("deactivate_profile");
            }, __("Actions"));
        } else {
            frm.add_custom_button(__("Activate"), function () {
                frm.trigger("activate_profile");
            }, __("Actions"));
        }

        // Set field dependencies
        frm.trigger("set_field_dependencies");
    },

    pos_profile: function (frm) {
        // Load company and warehouse from selected POS Profile
        if (frm.doc.pos_profile) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "POS Profile",
                    name: frm.doc.pos_profile
                },
                callback: function (r) {
                    if (r.message) {
                        frm.set_value("company", r.message.company);
                        frm.set_value("warehouse", r.message.warehouse);
                        frm.refresh_field("company");
                        frm.refresh_field("warehouse");
                    }
                }
            });
        }
    },

    company: function (frm) {
        // Clear warehouse when company changes
        frm.set_value("warehouse", "");
        frm.refresh_field("warehouse");
    },

    is_active: function (frm) {
        if (frm.doc.is_active) {
            frm.trigger("validate_active_profile");
        }
    },

    posa_use_percentage_discount: function (frm) {
        if (frm.doc.posa_use_percentage_discount) {
            frm.set_value("posa_max_discount_allowed", 0);
            frm.refresh_field("posa_max_discount_allowed");
        }
    },

    posa_use_server_cache: function (frm) {
        if (!frm.doc.posa_use_server_cache) {
            frm.set_value("posa_server_cache_duration", 30);
            frm.refresh_field("posa_server_cache_duration");
        }
    },

    pose_use_limit_search: function (frm) {
        if (!frm.doc.pose_use_limit_search) {
            frm.set_value("posa_search_limit", 500);
            frm.refresh_field("posa_search_limit");
        }
    },

    posa_enable_camera_scanning: function (frm) {
        if (!frm.doc.posa_enable_camera_scanning) {
            frm.set_value("posa_camera_scan_type", "Both");
            frm.refresh_field("posa_camera_scan_type");
        }
    },

    posa_use_pos_awesome_payments: function (frm) {
        if (!frm.doc.posa_use_pos_awesome_payments) {
            frm.set_value("posa_allow_make_new_payments", 1);
            frm.set_value("posa_allow_reconcile_payments", 1);
            frm.refresh_field("posa_allow_make_new_payments");
            frm.refresh_field("posa_allow_reconcile_payments");
        }
    },

    set_field_dependencies: function (frm) {
        // Hide/show fields based on dependencies
        frm.toggle_display("posa_max_discount_allowed", frm.doc.posa_use_percentage_discount);
        frm.toggle_display("posa_server_cache_duration", frm.doc.posa_use_server_cache);
        frm.toggle_display("posa_search_limit", frm.doc.pose_use_limit_search);
        frm.toggle_display("posa_camera_scan_type", frm.doc.posa_enable_camera_scanning);
        frm.toggle_display("posa_allow_make_new_payments", frm.doc.posa_use_pos_awesome_payments);
        frm.toggle_display("posa_allow_reconcile_payments", frm.doc.posa_use_pos_awesome_payments);
        frm.toggle_display("posa_allow_mpesa_reconcile_payments", frm.doc.posa_use_pos_awesome_payments);
    },

    validate_active_profile: function (frm) {
        if (frm.doc.is_active && frm.doc.company) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "POS Profile Settings",
                    filters: {
                        company: frm.doc.company,
                        is_active: 1,
                        name: ["!=", frm.doc.name]
                    }
                },
                callback: function (r) {
                    if (r.message && r.message.length > 0) {
                        frappe.msgprint({
                            title: __("Warning"),
                            message: __("There is already an active profile for this company. Activating this profile will deactivate the existing one."),
                            indicator: "orange"
                        });
                    }
                }
            });
        }
    },

    duplicate_profile: function (frm) {
        frappe.prompt([
            {
                fieldname: "new_pos_profile",
                label: __("Select New POS Profile"),
                fieldtype: "Link",
                options: "POS Profile",
                reqd: 1,
                description: __("Select the POS Profile for the duplicated settings")
            }
        ], function (values) {
            frappe.call({
                method: "frappe.client.copy_doc",
                args: {
                    doctype: "POS Profile Settings",
                    name: frm.doc.name,
                    args: {
                        pos_profile: values.new_pos_profile,
                        is_active: 0
                    }
                },
                callback: function (r) {
                    if (r.message) {
                        frappe.set_route("Form", "POS Profile Settings", r.message.name);
                    }
                }
            });
        }, __("Duplicate Profile"), __("Duplicate"));
    },

    apply_to_pos_profile: function (frm) {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "POS Profile",
                filters: {
                    company: frm.doc.company
                },
                fields: ["name", "pos_profile_name"]
            }
        }).then(function (r) {
            if (r.message && r.message.length > 0) {
                let options = r.message.map(function (profile) {
                    return { label: profile.pos_profile_name, value: profile.name };
                });

                frappe.prompt([
                    {
                        fieldname: "pos_profile",
                        label: __("Select POS Profile"),
                        fieldtype: "Select",
                        options: options,
                        reqd: 1,
                        description: __("Select the POS Profile to apply these settings to")
                    }
                ], function (values) {
                    frappe.call({
                        method: "posawesome.posawesome.doctype.pos_profile_settings.pos_profile_settings.apply_profile_settings_to_pos_profile",
                        args: {
                            profile_settings_name: frm.doc.name,
                            pos_profile_name: values.pos_profile
                        },
                        callback: function (r) {
                            if (r.message) {
                                frappe.show_alert(__("Settings applied successfully"));
                            }
                        }
                    });
                }, __("Apply to POS Profile"), __("Apply"));
            } else {
                frappe.msgprint(__("No POS Profiles found for this company"));
            }
        });
    },

    create_pos_profile: function (frm) {
        frappe.prompt([
            {
                fieldname: "new_pos_profile_name",
                label: __("New POS Profile Name"),
                fieldtype: "Data",
                reqd: 1,
                description: __("Enter a name for the new POS Profile")
            }
        ], function (values) {
            frappe.call({
                method: "posawesome.posawesome.doctype.pos_profile_settings.pos_profile_settings.create_pos_profile_from_settings",
                args: {
                    profile_settings_name: frm.doc.name,
                    new_pos_profile_name: values.new_pos_profile_name
                },
                callback: function (r) {
                    if (r.message) {
                        frappe.set_route("Form", "POS Profile", r.message);
                    }
                }
            });
        }, __("Create POS Profile"), __("Create"));
    },

    activate_profile: function (frm) {
        frappe.call({
            method: "frappe.client.set_value",
            args: {
                doctype: "POS Profile Settings",
                name: frm.doc.name,
                fieldname: "is_active",
                value: 1
            },
            callback: function (r) {
                if (r.message) {
                    frm.reload_doc();
                }
            }
        });
    },

    deactivate_profile: function (frm) {
        frappe.call({
            method: "frappe.client.set_value",
            args: {
                doctype: "POS Profile Settings",
                name: frm.doc.name,
                fieldname: "is_active",
                value: 0
            },
            callback: function (r) {
                if (r.message) {
                    frm.reload_doc();
                }
            }
        });
    }
}); 