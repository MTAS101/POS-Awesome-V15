import { useOfflineStore } from "../stores/offlineStore";

export function getTranslationsCache(lang) {
        const store = useOfflineStore();
        return store.getTranslationsCache(lang);
}

export function saveTranslationsCache(lang, data) {
        const store = useOfflineStore();
        store.saveTranslationsCache(lang, data);
}

