import { memory } from './cache.js';
import { persist } from './core.js';

export function saveTaxesCache(profileName, taxes) {
    try {
        const cache = memory.taxes_cache || {};
        const clean = JSON.parse(JSON.stringify(taxes));
        cache[profileName] = clean;
        memory.taxes_cache = cache;
        persist('taxes_cache', memory.taxes_cache);
    } catch (e) {
        console.error('Failed to cache taxes', e);
    }
}

export function getCachedTaxes(profileName) {
    try {
        const cache = memory.taxes_cache || {};
        return cache[profileName] || null;
    } catch (e) {
        console.error('Failed to get cached taxes', e);
        return null;
    }
}

export function calculateOfflineTaxes(doc, taxes, taxInclusive = false) {
    if (!doc || !Array.isArray(taxes) || !taxes.length) {
        return doc;
    }

    const delivery = parseFloat(doc.posa_delivery_charges_rate || 0);
    const discount = parseFloat(doc.discount_amount || 0);
    const baseAmount = parseFloat(doc.total || 0) - discount + delivery;

    const percentTaxes = taxes.filter(t => t.charge_type !== 'Actual');
    const totalRate = percentTaxes.reduce((sum, t) => sum + parseFloat(t.rate || 0), 0);

    let taxable = taxInclusive ? baseAmount / (1 + totalRate / 100) : baseAmount;
    let grandTotal = taxInclusive ? baseAmount : taxable;
    const computed = [];
    let totalTaxes = 0;

    taxes.forEach(tax => {
        const rate = parseFloat(tax.rate || 0);
        let amount = 0;
        if (tax.charge_type === 'Actual') {
            amount = parseFloat(tax.tax_amount || 0);
        } else {
            amount = taxable * (rate / 100);
        }
        totalTaxes += amount;
        if (!taxInclusive && tax.charge_type !== 'Actual') {
            grandTotal += amount;
        } else if (tax.charge_type === 'Actual') {
            grandTotal += amount;
        }
        computed.push({
            account_head: tax.account_head,
            charge_type: tax.charge_type || 'On Net Total',
            description: tax.description,
            rate: rate,
            tax_amount: parseFloat(amount.toFixed(2)),
            total: parseFloat(grandTotal.toFixed(2))
        });
    });

    doc.net_total = parseFloat(taxable.toFixed(2));
    doc.grand_total = parseFloat(grandTotal.toFixed(2));
    doc.rounded_total = parseFloat(grandTotal.toFixed(2));
    doc.total_taxes_and_charges = parseFloat(totalTaxes.toFixed(2));
    doc.taxes = computed;
    return doc;
}

