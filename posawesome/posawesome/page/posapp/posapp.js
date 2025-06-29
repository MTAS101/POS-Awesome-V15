// Include onscan.js
frappe.pages['posapp'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'POS Awesome',
		single_column: true
	});

	this.page.$PosApp = new frappe.PosApp.posapp(this.page);

	$('div.navbar-fixed-top').find('.container').css('padding', '0');

        $("head").append("<link href='/assets/posawesome/node_modules/vuetify/dist/vuetify.min.css' rel='stylesheet'>");
        $("head").append("<link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/@mdi/font@6.x/css/materialdesignicons.min.css'>");
        $("head").append("<link rel='preconnect' href='https://fonts.googleapis.com'>");
        $("head").append("<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>");
        $("head").append("<link rel='preload' href='https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900' as='style'>");
        $("head").append("<link rel='stylesheet' href='https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900'>");
	
	// Listen for POS Profile registration
	frappe.realtime.on('pos_profile_registered', () => {
		const update_totals_based_on_tax_inclusive = () => {
			console.log("Updating totals based on tax inclusive settings");
			const posProfile = this.page.$PosApp.pos_profile;

			if (!posProfile) {
				console.error("POS Profile is not set.");
				return;
			}

			frappe.call({
				method: 'frappe.get_cached_value',
				args: {
					doctype: 'POS Profile',
					name: posProfile,
					fieldname: 'posa_tax_inclusive'
				},
				callback: function(response) {
					if (response.message !== undefined) {
						const posa_tax_inclusive = response.message;
						const totalAmountField = document.getElementById('input-v-25');
						const grandTotalField = document.getElementById('input-v-29');

						if (totalAmountField && grandTotalField) {
							if (posa_tax_inclusive) {
								totalAmountField.value = grandTotalField.value;
								console.log("Total amount copied from grand total:", grandTotalField.value);
							} else {
								totalAmountField.value = "";
								console.log("Total amount cleared because checkbox is unchecked.");
							}
						} else {
							console.error('Could not find total amount or grand total field by ID.');
						}
					} else {
						console.error('Error fetching POS Profile or POS Profile not found.');
					}
				}
			});
		};

		update_totals_based_on_tax_inclusive();
	});
};

function loadTranslations() {
    frappe.call({
        method: "posawesome.posawesome.api.utilities.get_translation_dict",
        args: { lang: frappe.boot.lang },
        callback: function (r) {
            if (!r.exc && r.message) {
                $.extend(frappe._messages, r.message);
            }
        },
    });
}

loadTranslations();
