import { useOfflineStore, MAX_QUEUE_ITEMS } from "../stores/offlineStore";
import { updateLocalStock } from "./stock.js";

// Flag to avoid concurrent invoice syncs which can cause duplicate submissions
let invoiceSyncInProgress = false;

export function saveOfflineInvoice(entry) {
	// Validate that invoice has items before saving
	if (!entry.invoice || !Array.isArray(entry.invoice.items) || !entry.invoice.items.length) {
		throw new Error("Cart is empty. Add items before saving.");
	}

        const store = useOfflineStore();
        const key = "offline_invoices";
        const entries = store.offline_invoices;
	// Clone the entry before storing to strip Vue reactivity
	// and other non-serializable properties. IndexedDB only
	// supports structured cloneable data, so reactive proxies
	// cause a DataCloneError without this step.
	let cleanEntry;
	try {
		cleanEntry = JSON.parse(JSON.stringify(entry));
	} catch (e) {
		console.error("Failed to serialize offline invoice", e);
		throw e;
	}

	entries.push(cleanEntry);
        if (entries.length > MAX_QUEUE_ITEMS) {
                entries.splice(0, entries.length - MAX_QUEUE_ITEMS);
        }
        store.setState(key, entries);

	// Update local stock quantities
        if (entry.invoice && entry.invoice.items) {
                updateLocalStock(entry.invoice.items);
        }
}

export function isOffline() {
	// Use cached data when running offline
        if (typeof window === "undefined") {
                // Not in a browser (SSR/Node), assume online (or handle explicitly if needed)
                const store = useOfflineStore();
                return store.isManualOffline();
        }

	const { protocol, hostname, navigator } = window;
	const online = navigator.onLine;

	const serverOnline = typeof window.serverOnline === "boolean" ? window.serverOnline : true;

	const isIpAddress = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
	const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
	const isDnsName = !isIpAddress && !isLocalhost;

        const store = useOfflineStore();
        if (store.isManualOffline()) {
                return true;
        }

	if (protocol === "https:" && isDnsName) {
		return !online || !serverOnline;
	}

	return !online || !serverOnline;
}

export function getOfflineInvoices() {
        const store = useOfflineStore();
        return store.offline_invoices;
}

export function clearOfflineInvoices() {
        const store = useOfflineStore();
        store.setState("offline_invoices", []);
}

export function deleteOfflineInvoice(index) {
        const store = useOfflineStore();
        const invoices = store.offline_invoices;
        if (Array.isArray(invoices) && index >= 0 && index < invoices.length) {
                invoices.splice(index, 1);
                store.setState("offline_invoices", invoices);
        }
}

export function getPendingOfflineInvoiceCount() {
        const store = useOfflineStore();
        return store.offline_invoices.length;
}

export function saveOfflinePayment(entry) {
        const store = useOfflineStore();
        const key = "offline_payments";
        const entries = store.offline_payments;
	// Strip down POS Profile to essential fields to avoid
	// serialization errors from complex reactive objects
	if (entry?.args?.payload?.pos_profile) {
		const profile = entry.args.payload.pos_profile;
		entry.args.payload.pos_profile = {
			posa_use_pos_awesome_payments: profile.posa_use_pos_awesome_payments,
			posa_allow_make_new_payments: profile.posa_allow_make_new_payments,
			posa_allow_reconcile_payments: profile.posa_allow_reconcile_payments,
			posa_allow_mpesa_reconcile_payments: profile.posa_allow_mpesa_reconcile_payments,
			cost_center: profile.cost_center,
			posa_cash_mode_of_payment: profile.posa_cash_mode_of_payment,
			name: profile.name,
		};
	}
	let cleanEntry;
	try {
		cleanEntry = JSON.parse(JSON.stringify(entry));
	} catch (e) {
		console.error("Failed to serialize offline payment", e);
		throw e;
	}
	entries.push(cleanEntry);
        if (entries.length > MAX_QUEUE_ITEMS) {
                entries.splice(0, entries.length - MAX_QUEUE_ITEMS);
        }
        store.setState(key, entries);
}

export function getOfflinePayments() {
        const store = useOfflineStore();
        return store.offline_payments;
}

export function clearOfflinePayments() {
        const store = useOfflineStore();
        store.setState("offline_payments", []);
}

export function deleteOfflinePayment(index) {
        const store = useOfflineStore();
        const payments = store.offline_payments;
        if (Array.isArray(payments) && index >= 0 && index < payments.length) {
                payments.splice(index, 1);
                store.setState("offline_payments", payments);
        }
}

export function getPendingOfflinePaymentCount() {
        const store = useOfflineStore();
        return store.offline_payments.length;
}

export function saveOfflineCustomer(entry) {
        const store = useOfflineStore();
        const key = "offline_customers";
        const entries = store.offline_customers;
	// Serialize to avoid storing reactive objects that IndexedDB
	// cannot clone.
	let cleanEntry;
	try {
		cleanEntry = JSON.parse(JSON.stringify(entry));
	} catch (e) {
		console.error("Failed to serialize offline customer", e);
		throw e;
	}
	entries.push(cleanEntry);
        if (entries.length > MAX_QUEUE_ITEMS) {
                entries.splice(0, entries.length - MAX_QUEUE_ITEMS);
        }
        store.setState(key, entries);
}

export function updateOfflineInvoicesCustomer(oldName, newName) {
        const store = useOfflineStore();
        let updated = false;
        const invoices = store.offline_invoices || [];
	invoices.forEach((inv) => {
                if (inv.invoice && inv.invoice.customer === oldName) {
                        inv.invoice.customer = newName;
			if (inv.invoice.customer_name) {
				inv.invoice.customer_name = newName;
			}
			updated = true;
		}
	});
        if (updated) {
                store.setState("offline_invoices", invoices);
        }
}

export function getOfflineCustomers() {
        const store = useOfflineStore();
        return store.offline_customers;
}

export function clearOfflineCustomers() {
        const store = useOfflineStore();
        store.setState("offline_customers", []);
}

// Add sync function to clear local cache when invoices are successfully synced
export async function syncOfflineInvoices() {
	// Prevent concurrent syncs which can lead to duplicate submissions
	if (invoiceSyncInProgress) {
		return { pending: getPendingOfflineInvoiceCount(), synced: 0, drafted: 0 };
	}
	invoiceSyncInProgress = true;
	try {
		// Ensure any offline customers are synced first so that invoices
		// referencing them do not fail during submission
		await syncOfflineCustomers();

                const store = useOfflineStore();
                const invoices = getOfflineInvoices();
		if (!invoices.length) {
			// No invoices to sync; clear last totals to avoid repeated messages
                        const totals = { pending: 0, synced: 0, drafted: 0 };
                        store.setLastSyncTotals(totals);
                        return totals;
		}
		if (isOffline()) {
			// When offline just return the pending count without attempting a sync
			return { pending: invoices.length, synced: 0, drafted: 0 };
		}

		const failures = [];
		let synced = 0;
		let drafted = 0;

		for (const inv of invoices) {
			try {
				await frappe.call({
					method: "posawesome.posawesome.api.invoices.submit_invoice",
					args: {
						invoice: inv.invoice,
						data: inv.data,
					},
				});
				synced++;
			} catch (error) {
				console.error("Failed to submit invoice, saving as draft", error);
				try {
					await frappe.call({
						method: "posawesome.posawesome.api.invoices.update_invoice",
						args: { data: inv.invoice },
					});
					drafted += 1;
				} catch (draftErr) {
					console.error("Failed to save invoice as draft", draftErr);
					failures.push(inv);
				}
			}
		}

		// Reset saved invoices and totals after successful sync
                if (synced > 0) {
                        store.resetOfflineState();
                }

		const pendingLeft = failures.length;

		if (pendingLeft) {
                        store.setState("offline_invoices", failures);
                } else {
                        clearOfflineInvoices();
                        if (synced > 0 && drafted === 0) {
                                store.reduceCacheUsage();
                        }
                }

                const totals = { pending: pendingLeft, synced, drafted };
                if (pendingLeft || drafted) {
                        store.setLastSyncTotals(totals);
                } else {
                        store.setLastSyncTotals({ pending: 0, synced: 0, drafted: 0 });
                }
                return totals;
	} finally {
		invoiceSyncInProgress = false;
	}
}

export async function syncOfflineCustomers() {
        const store = useOfflineStore();
        const customers = getOfflineCustomers();
	if (!customers.length) {
		return { pending: 0, synced: 0 };
	}
	if (isOffline()) {
		return { pending: customers.length, synced: 0 };
	}

	const failures = [];
	let synced = 0;

	for (const cust of customers) {
		try {
			const result = await frappe.call({
				method: "posawesome.posawesome.api.customers.create_customer",
				args: cust.args,
			});
			synced++;
			if (
				result &&
				result.message &&
				result.message.name &&
				result.message.name !== cust.args.customer_name
			) {
				updateOfflineInvoicesCustomer(cust.args.customer_name, result.message.name);
			}
		} catch (error) {
			console.error("Failed to create customer", error);
			failures.push(cust);
		}
	}

        if (failures.length) {
                store.setState("offline_customers", failures);
        } else {
                clearOfflineCustomers();
        }

	return { pending: failures.length, synced };
}

export async function syncOfflinePayments() {
        const store = useOfflineStore();
        await syncOfflineCustomers();

        const payments = getOfflinePayments();
	if (!payments.length) {
		return { pending: 0, synced: 0 };
	}
	if (isOffline()) {
		return { pending: payments.length, synced: 0 };
	}

	const failures = [];
	let synced = 0;

	for (const pay of payments) {
		try {
			await frappe.call({
				method: "posawesome.posawesome.api.payment_entry.process_pos_payment",
				args: pay.args,
			});
			synced++;
		} catch (error) {
			console.error("Failed to submit payment", error);
			failures.push(pay);
		}
	}

        if (failures.length) {
                store.setState("offline_payments", failures);
        } else {
                clearOfflinePayments();
        }

	return { pending: failures.length, synced };
}
