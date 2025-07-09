import { memory } from './cache.js';
import { persist } from './core.js';

export function saveTaxes(profileName, taxes) {
    try {
        const cache = memory.taxes_cache || {};
        const clean = JSON.parse(JSON.stringify(taxes || []));
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
        return cache[profileName] || [];
    } catch (e) {
        console.error('Failed to get cached taxes', e);
        return [];
    }
}
