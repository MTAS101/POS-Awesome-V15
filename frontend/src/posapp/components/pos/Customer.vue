<template>
	<!-- ? Disable dropdown if either readonly or loadingCustomers is true -->
	<div class="customer-input-wrapper">
		<v-autocomplete
			ref="customerDropdown"
			class="customer-autocomplete sleek-field"
			density="compact"
			clearable
			variant="solo"
			color="primary"
			:label="frappe._('Customer')"
			v-model="internalCustomer"
                        :items="customers"
			item-title="customer_name"
			item-value="name"
			:bg-color="isDarkTheme ? '#1E1E1E' : 'white'"
			:no-data-text="__('Customers not found')"
			hide-details
			:customFilter="() => true"
			:disabled="effectiveReadonly || loadingCustomers"
			:menu-props="{ closeOnContentClick: false }"
			@update:menu="onCustomerMenuToggle"
			@update:modelValue="onCustomerChange"
			@update:search="onCustomerSearch"
			@keydown.enter="handleEnter"
			:virtual-scroll="true"
			:virtual-scroll-item-height="48"
		>
			<!-- Edit icon (left) -->
			<template #prepend-inner>
				<v-tooltip text="Edit customer">
					<template #activator="{ props }">
						<v-icon
							v-bind="props"
							class="icon-button"
							@mousedown.prevent.stop
							@click.stop="edit_customer"
						>
							mdi-account-edit
						</v-icon>
					</template>
				</v-tooltip>
			</template>

			<!-- Add icon (right) -->
			<template #append-inner>
				<v-tooltip text="Add new customer">
					<template #activator="{ props }">
						<v-icon
							v-bind="props"
							class="icon-button"
							@mousedown.prevent.stop
							@click.stop="new_customer"
						>
							mdi-plus
						</v-icon>
					</template>
				</v-tooltip>
			</template>

			<!-- Dropdown display -->
			<template #item="{ props, item }">
				<v-list-item v-bind="props">
					<v-list-item-subtitle v-if="item.raw.customer_name !== item.raw.name">
						<div v-html="`ID: ${item.raw.name}`"></div>
					</v-list-item-subtitle>
					<v-list-item-subtitle v-if="item.raw.tax_id">
						<div v-html="`TAX ID: ${item.raw.tax_id}`"></div>
					</v-list-item-subtitle>
					<v-list-item-subtitle v-if="item.raw.email_id">
						<div v-html="`Email: ${item.raw.email_id}`"></div>
					</v-list-item-subtitle>
					<v-list-item-subtitle v-if="item.raw.mobile_no">
						<div v-html="`Mobile No: ${item.raw.mobile_no}`"></div>
					</v-list-item-subtitle>
					<v-list-item-subtitle v-if="item.raw.primary_address">
						<div v-html="`Primary Address: ${item.raw.primary_address}`"></div>
					</v-list-item-subtitle>
				</v-list-item>
			</template>
		</v-autocomplete>

		<!-- Update customer modal -->
		<div class="mt-4">
			<UpdateCustomer />
		</div>
	</div>
</template>

<style scoped>
.customer-input-wrapper {
	width: 100%;
	max-width: 100%;
	padding-right: 1.5rem;
	/* Elegant space at the right edge */
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}

.customer-autocomplete {
	width: 100%;
	box-sizing: border-box;
	border-radius: 12px;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
	transition: box-shadow 0.3s ease;
	background-color: #fff;
}

.customer-autocomplete:hover {
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Dark mode styling */
:deep([data-theme="dark"]) .customer-autocomplete,
:deep(.v-theme--dark) .customer-autocomplete,
::v-deep([data-theme="dark"]) .customer-autocomplete,
::v-deep(.v-theme--dark) .customer-autocomplete {
	/* Use surface color for dark mode */
	background-color: #1e1e1e !important;
}

:deep([data-theme="dark"]) .customer-autocomplete :deep(.v-field__input),
:deep(.v-theme--dark) .customer-autocomplete :deep(.v-field__input),
:deep([data-theme="dark"]) .customer-autocomplete :deep(input),
:deep(.v-theme--dark) .customer-autocomplete :deep(input),
:deep([data-theme="dark"]) .customer-autocomplete :deep(.v-label),
:deep(.v-theme--dark) .customer-autocomplete :deep(.v-label),
::v-deep([data-theme="dark"]) .customer-autocomplete .v-field__input,
::v-deep(.v-theme--dark) .customer-autocomplete .v-field__input,
::v-deep([data-theme="dark"]) .customer-autocomplete input,
::v-deep(.v-theme--dark) .customer-autocomplete input,
::v-deep([data-theme="dark"]) .customer-autocomplete .v-label,
::v-deep(.v-theme--dark) .customer-autocomplete .v-label {
	color: #fff !important;
}

:deep([data-theme="dark"]) .customer-autocomplete :deep(.v-field__overlay),
:deep(.v-theme--dark) .customer-autocomplete :deep(.v-field__overlay),
::v-deep([data-theme="dark"]) .customer-autocomplete .v-field__overlay,
::v-deep(.v-theme--dark) .customer-autocomplete .v-field__overlay {
	background-color: #1e1e1e !important;
}

.icon-button {
	cursor: pointer;
	font-size: 20px;
	opacity: 0.7;
	transition: all 0.2s ease;
}

.icon-button:hover {
	opacity: 1;
	color: var(--v-theme-primary);
}
</style>

<script>
/* global frappe */
import UpdateCustomer from "./UpdateCustomer.vue";
import {
        db,
        setCustomerStorage,
        memoryInitPromise,
        getCustomersLastSync,
        setCustomersLastSync,
} from "../../../offline/index.js";
import debounce from "lodash/debounce";

export default {
	props: {
		pos_profile: Object,
	},

	data: () => ({
		pos_profile: "",
                customers: [],
                customer: "", // Selected customer
                internalCustomer: null, // Model bound to the dropdown
                tempSelectedCustomer: null, // Temporarily holds customer selected from dropdown
                isMenuOpen: false, // Tracks whether dropdown menu is open
                readonly: false,
                effectiveReadonly: false,
                customer_info: {}, // Used for edit modal
                loadingCustomers: false, // ? New state to track loading status
                customers_loaded: false,
                customerSearch: "", // Search text
                page: 0,
                pageSize: 200,
                lastCustomer: null,
                allCustomersLoaded: false,
	}),

	components: {
		UpdateCustomer,
	},

	computed: {
                isDarkTheme() {
                        return this.$theme.current === "dark";
                },
        },

	watch: {
		readonly(val) {
			this.effectiveReadonly = val && navigator.onLine;
		},
               customers_loaded(val) {
                       if (val) {
                               this.eventBus.emit("customers_loaded");
                       }
               },
	},

	methods: {
		// Called when dropdown opens or closes
                onCustomerMenuToggle(isOpen) {
                        this.isMenuOpen = isOpen;

                        if (isOpen) {
                                this.internalCustomer = null;

                                this.$nextTick(() => {
                                        setTimeout(() => {
                                                const dropdown = this.$refs.customerDropdown?.$el?.querySelector(
                                                        ".v-overlay__content .v-select-list",
                                                );
                                                if (dropdown) {
                                                        dropdown.scrollTop = 0;
                                                        dropdown.addEventListener("scroll", this.onCustomerScroll, {
                                                                passive: true,
                                                        });
                                                }
                                        }, 50);
                                });
                        } else {
                                const dropdown = this.$refs.customerDropdown?.$el?.querySelector(
                                        ".v-overlay__content .v-select-list",
                                );
                                if (dropdown) {
                                        dropdown.removeEventListener("scroll", this.onCustomerScroll);
                                }
                                // Restore selection if user didn't pick anything
                                if (this.tempSelectedCustomer) {
                                        this.internalCustomer = this.tempSelectedCustomer;
                                        this.customer = this.tempSelectedCustomer;
                                        this.eventBus.emit("update_customer", this.customer);
                                } else if (this.customer) {
                                        this.internalCustomer = this.customer;
                                }

                                this.tempSelectedCustomer = null;
                        }
                },

		// Called when a customer is selected
               onCustomerChange(val) {
                        // if user selects the same customer again, show a meaningful error
                        if (val && val === this.customer) {
                                // keep the current selection and notify the user
                                this.internalCustomer = this.customer;
                                this.eventBus.emit("show_message", {
                                        title: __("Customer already selected"),
                                        color: "error",
                                });
                                return;
                        }

                        this.tempSelectedCustomer = val;

                        if (!this.isMenuOpen && val) {
                                this.customer = val;
                                this.eventBus.emit("update_customer", val);
                        }
               },

                onCustomerSearch(val) {
                        this.customerSearch = val || "";
                        this.page = 1;
                        this.debouncedSearch(val || "");
                },

                // Pressing Enter in input
                handleEnter(event) {
                        const inputText = event.target.value?.toLowerCase() || "";

                        const matched = this.customers.find((cust) => {
                                return (
                                        cust.customer_name?.toLowerCase().includes(inputText) ||
                                        cust.name?.toLowerCase().includes(inputText)
                                );
                        });

                        if (matched) {
                                this.tempSelectedCustomer = matched.name;
                                this.internalCustomer = matched.name;
                                this.customer = matched.name;
                                this.eventBus.emit("update_customer", matched.name);
                                this.isMenuOpen = false;

                                event.target.blur();
                        }
                },

                async searchCustomers(term = "") {
                        const searchTerm = term || "";
                        const limit = this.page * this.pageSize;
                        let collection = db.table("customers");
                        if (searchTerm) {
                                collection = collection
                                        .where("customer_name")
                                        .startsWithIgnoreCase(searchTerm);
                        }
                        this.customers = await collection.limit(limit).toArray();
                },

                onCustomerScroll(e) {
                        const el = e.target;
                        if (el.scrollTop + el.clientHeight + 50 >= el.scrollHeight) {
                                this.loadMoreCustomers();
                        }
                },

                async loadMoreCustomers() {
                        if (this.loadingCustomers || this.allCustomersLoaded) return;
                        await this.backgroundLoadCustomers();
                        await this.searchCustomers(this.customerSearch);
                },

                async backgroundLoadCustomers() {
                        const syncSince = getCustomersLastSync();
                        const startAfter = this.lastCustomer;
                        this.loadingCustomers = true;
                        frappe.call({
                                method: "posawesome.posawesome.api.customers.get_customer_names",
                                args: {
                                        pos_profile: this.pos_profile.pos_profile,
                                        modified_after: syncSince,
                                        limit: this.pageSize,
                                        start_after: startAfter,
                                },
                                callback: async (r) => {
                                        const rows = r.message || [];
                                        if (rows.length) {
                                                this.lastCustomer = rows[rows.length - 1].name;
                                                await setCustomerStorage(rows);
                                        }
                                        this.page += 1;
                                        if (rows.length < this.pageSize) {
                                                this.allCustomersLoaded = true;
                                                setCustomersLastSync(new Date().toISOString());
                                                this.eventBus.emit("data-load-progress", { name: "customers", progress: 100 });
                                                this.eventBus.emit("data-loaded", "customers");
                                                this.customers_loaded = true;
                                        }
                                        this.loadingCustomers = false;
                                },
                                error: (err) => {
                                        console.error("Failed to background load customers", err);
                                        this.loadingCustomers = false;
                                },
                        });
                },

                async get_customer_names() {
                        if (this.customers_loaded) return;
                        await this.searchCustomers(this.customerSearch);
                        if (navigator.onLine) {
                                this.page = 0;
                                this.lastCustomer = null;
                                this.allCustomersLoaded = false;
                                await this.backgroundLoadCustomers();
                                await this.searchCustomers(this.customerSearch);
                        } else {
                                this.customers_loaded = true;
                        }
                },

		new_customer() {
			this.eventBus.emit("open_update_customer", null);
		},

		edit_customer() {
			this.eventBus.emit("open_update_customer", this.customer_info);
		},
	},

        created() {
                this.debouncedSearch = debounce(this.searchCustomers, 300);
                memoryInitPromise.then(() => {
                        this.page = 1;
                        this.searchCustomers("");
                        this.effectiveReadonly = this.readonly && navigator.onLine;
                });

                this.effectiveReadonly = this.readonly && navigator.onLine;

                this.$nextTick(() => {
                        this.eventBus.on("register_pos_profile", async (pos_profile) => {
                                await memoryInitPromise;
                                this.pos_profile = pos_profile;
                                this.get_customer_names();
                        });

                        this.eventBus.on("payments_register_pos_profile", async (pos_profile) => {
                                await memoryInitPromise;
                                this.pos_profile = pos_profile;
                                this.get_customer_names();
                        });

                        this.eventBus.on("set_customer", (customer) => {
                                this.customer = customer;
                                this.internalCustomer = customer;
                        });

                        this.eventBus.on("add_customer_to_list", async (customer) => {
                                const index = this.customers.findIndex((c) => c.name === customer.name);
                                if (index !== -1) {
                                        // Replace existing entry to avoid duplicates after update
                                        this.customers.splice(index, 1, customer);
                                } else {
                                        this.customers.push(customer);
                                }
                                await setCustomerStorage([customer]);
                                this.customer = customer.name;
                                this.internalCustomer = customer.name;
                                this.eventBus.emit("update_customer", customer.name);
                        });

                        this.eventBus.on("set_customer_readonly", (value) => {
                                this.readonly = value;
                        });

                        this.eventBus.on("set_customer_info_to_edit", (data) => {
                                this.customer_info = data;
                        });

                        this.eventBus.on("fetch_customer_details", () => {
                                this.get_customer_names();
                        });
                });
        },
};
</script>
