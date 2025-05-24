/**
 * Queue for handling failed invoice operations when offline
 */
export class InvoiceQueue {
  static STORAGE_KEY = 'POS_INVOICE_QUEUE';
  static MAX_RETRIES = 3;
  static RETRY_DELAY = 5000; // 5 seconds

  /**
   * Add a failed invoice operation to the queue
   * @param {Object} operation - Failed operation details
   */
  static async add(operation) {
    try {
      const queue = await this.getQueue();
      queue.push({
        ...operation,
        retries: 0,
        status: 'pending'
      });
      await this.saveQueue(queue);
      console.log('Added operation to invoice queue:', operation);
    } catch (err) {
      console.error('Error adding to invoice queue:', err);
    }
  }

  /**
   * Process all queued invoice operations
   */
  static async processQueue() {
    const queue = await this.getQueue();
    if (!queue.length) return;

    console.log('Processing invoice queue:', queue.length, 'items');

    for (const operation of queue) {
      if (operation.status === 'completed') continue;
      if (operation.retries >= this.MAX_RETRIES) {
        operation.status = 'failed';
        continue;
      }

      try {
        const response = await frappe.call({
          method: operation.method,
          args: operation.args
        });

        operation.status = 'completed';
        operation.response = response;
        console.log('Successfully processed queued operation:', operation);
      } catch (err) {
        operation.retries++;
        operation.lastError = err.message;
        console.error('Error processing queued operation:', operation, err);
        
        // Add delay between retries
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      }
    }

    await this.saveQueue(queue);
  }

  /**
   * Get the current queue from storage
   */
  static async getQueue() {
    try {
      const queueStr = localStorage.getItem(this.STORAGE_KEY);
      return queueStr ? JSON.parse(queueStr) : [];
    } catch (err) {
      console.error('Error getting invoice queue:', err);
      return [];
    }
  }

  /**
   * Save the queue to storage
   */
  static async saveQueue(queue) {
    try {
      // Only keep pending and failed items
      const filteredQueue = queue.filter(op => op.status !== 'completed');
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredQueue));
    } catch (err) {
      console.error('Error saving invoice queue:', err);
    }
  }

  /**
   * Clear completed operations from the queue
   */
  static async clearCompleted() {
    const queue = await this.getQueue();
    const pendingQueue = queue.filter(op => op.status !== 'completed');
    await this.saveQueue(pendingQueue);
  }

  /**
   * Get queue statistics
   */
  static async getStats() {
    const queue = await this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter(op => op.status === 'pending').length,
      completed: queue.filter(op => op.status === 'completed').length,
      failed: queue.filter(op => op.status === 'failed').length
    };
  }
} 