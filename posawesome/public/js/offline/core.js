import Dexie from "dexie";

// --- Dexie initialization ---------------------------------------------------
export const db = new Dexie("posawesome_offline");
db.version(1).stores({ keyval: "&key" });

let persistWorker = null;
let sharedWorker = null;

if (typeof Worker !== "undefined") {
	try {
		const workerUrl = "/assets/posawesome/js/posapp/workers/itemWorker.js?worker";
		persistWorker = new Worker(workerUrl, { type: "classic" });
	} catch (e) {
		console.error("Failed to init persist worker", e);
		persistWorker = null;
	}
}

// Initialize shared worker if available
if (typeof SharedWorker !== "undefined") {
	try {
		const sharedWorkerUrl = "/assets/posawesome/js/posapp/workers/sharedWorker.js";
		sharedWorker = new SharedWorker(sharedWorkerUrl, { type: "classic" });
		sharedWorker.port.start();
	} catch (e) {
		console.error("Failed to init shared worker", e);
		sharedWorker = null;
	}
}

export function getSharedWorker() {
	return sharedWorker;
}

// Persist queue for batching operations
const persistQueue = {};
let persistTimeout = null;

export function addToPersistQueue(key, value) {
	persistQueue[key] = value;
	
	if (!persistTimeout) {
		persistTimeout = setTimeout(flushPersistQueue, 100);
	}
}

function flushPersistQueue() {
	const keys = Object.keys(persistQueue);
	if (keys.length) {
		keys.forEach(key => {
			persist(key, persistQueue[key]);
			delete persistQueue[key];
		});
	}
	persistTimeout = null;
}

export function persist(key, value) {
        if (persistWorker) {
                let clean = value;
                try {
                        clean = JSON.parse(JSON.stringify(value));
                } catch (e) {
                        console.error("Failed to serialize", key, e);
                }
                persistWorker.postMessage({ type: "persist", key, value: clean });
                return;
        }
	
	db.table("keyval")
		.put({ key, value })
		.catch((e) => console.error(`Failed to persist ${key}`, e));

	if (typeof localStorage !== "undefined") {
		try {
			localStorage.setItem(`posa_${key}`, JSON.stringify(value));
		} catch (err) {
			console.error("Failed to persist", key, "to localStorage", err);
		}
	}
}

export const initPromise = new Promise((resolve) => {
	const init = async () => {
		try {
			await db.open();
			// Initialization will be handled by the cache.js module
			resolve();
		} catch (e) {
			console.error("Failed to initialize offline DB", e);
			resolve(); // Resolve anyway to prevent blocking
		}
	};

	if (typeof requestIdleCallback === "function") {
		requestIdleCallback(init);
	} else {
		setTimeout(init, 0);
	}
});