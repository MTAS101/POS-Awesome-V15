import { memory } from "./cache.js";
import { persist } from "./core.js";

// Cache translation dictionaries per language
export function saveTranslations(lang, data) {
    try {
        const cache = memory.translation_cache || {};
        // clone to avoid reactive proxies
        const clean = JSON.parse(JSON.stringify(data));
        cache[lang] = {
            messages: clean,
            timestamp: Date.now(),
        };
        memory.translation_cache = cache;
        persist("translation_cache", memory.translation_cache);
    } catch (e) {
        console.error("Failed to cache translations", e);
    }
}

// Retrieve cached translations with a TTL of 7 days
export function getCachedTranslations(lang, ttl = 7 * 24 * 60 * 60 * 1000) {
    try {
        const cache = memory.translation_cache || {};
        const entry = cache[lang];
        if (entry) {
            const isValid = Date.now() - entry.timestamp < ttl;
            return isValid ? entry.messages : null;
        }
        return null;
    } catch (e) {
        console.error("Failed to get cached translations", e);
        return null;
    }
}

export function clearTranslationCache() {
    try {
        memory.translation_cache = {};
        persist("translation_cache", memory.translation_cache);
    } catch (e) {
        console.error("Failed to clear translation cache", e);
    }
}
