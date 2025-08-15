export function initializeWorker(existingWorker) {
  if (typeof Worker !== "undefined" && !existingWorker) {
    try {
      const workerUrl = "/assets/posawesome/js/posapp/workers/itemWorker.js";
      const worker = new Worker(workerUrl, { type: "classic" });
      worker.onerror = function (event) {
        console.error("Worker error:", event);
        console.error("Message:", event.message);
        console.error("Filename:", event.filename);
        console.error("Line number:", event.lineno);
      };
      console.log("Created worker");
      return worker;
    } catch (e) {
      console.error("Failed to start item worker", e);
      return null;
    }
  }
  return existingWorker;
}
