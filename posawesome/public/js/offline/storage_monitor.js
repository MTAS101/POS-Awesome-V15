export function checkLocalStorageUsage(threshold = 0.9) {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        try {
            navigator.storage.estimate().then(({ usage, quota }) => {
                if (usage !== undefined && quota && usage / quota > threshold) {
                    console.warn(
                        `POS Awesome storage usage is ${((usage / quota) * 100).toFixed(1)}% of quota`
                    );
                }
            }).catch(err => {
                console.error('Failed to estimate storage usage', err);
            });
        } catch (err) {
            console.error('Failed to check storage usage', err);
        }
    } else if (typeof localStorage !== 'undefined') {
        try {
            let total = 0;
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith('posa_')) {
                    const item = localStorage.getItem(key);
                    total += key.length + (item ? item.length : 0);
                }
            });
            const maxApprox = 5 * 1024 * 1024; // 5MB typical limit
            if (total / maxApprox > threshold) {
                console.warn(
                    `POS Awesome localStorage usage ${(total / maxApprox * 100).toFixed(1)}% of quota`
                );
            }
        } catch (err) {
            console.error('Failed to check localStorage usage', err);
        }
    }
}
