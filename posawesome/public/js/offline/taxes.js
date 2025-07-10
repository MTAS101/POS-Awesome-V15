import { memory } from './cache.js';
import { persist } from './core.js';

export function saveTaxTemplate(name, doc) {
    try {
        const cache = memory.tax_template_cache || {};
        const cleanDoc = JSON.parse(JSON.stringify(doc));
        cache[name] = cleanDoc;
        memory.tax_template_cache = cache;
        persist("tax_template_cache", memory.tax_template_cache);
    } catch (e) {
        console.error('Failed to cache tax template', e);
    }
}

export function getCachedTaxTemplate(name) {
    try {
        const cache = memory.tax_template_cache || {};
        return cache[name] || null;
    } catch (e) {
        console.error('Failed to get cached tax template', e);
        return null;
    }
}
