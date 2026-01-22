/**
 * Sync Operation Queue
 * Serializes concurrent sync operations to prevent race conditions
 *
 * Purpose: Prevent concurrent push/pull operations from corrupting data
 * - Handles user's rapid "sync" button clicks
 * - Prevents autoSync and manualSync from running simultaneously
 * - Ensures push completes before pull starts
 *
 * Pattern: FIFO queue with single executor
 * Behavior: Operations wait their turn, execute one at a time
 */

import { logger } from '../../../00_kernel/telemetry';

interface QueuedOperation<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

/**
 * Lightweight operation queue for sync operations
 * Ensures only one sync operation executes at a time
 */
export class SyncQueue {
  private queue: QueuedOperation<any>[] = [];
  private isProcessing = false;

  /**
   * Execute an operation, queuing it if another is already running
   * Returns a promise that resolves when the operation completes
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  /**
   * Process the queue: take next operation and execute it
   * Continues until queue is empty
   */
  private async process(): Promise<void> {
    // Already processing, let it continue when done
    if (this.isProcessing) {
      return;
    }

    // No operations in queue
    if (this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { fn, resolve, reject } = this.queue.shift()!;

    const queueSize = this.queue.length;
    if (queueSize > 0) {
      logger.debug('SYNC_QUEUE_OPERATION_QUEUED', {
        operation: fn.name || 'sync',
        queueLength: queueSize,
      });
    }

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      logger.error('SYNC_QUEUE_OPERATION_FAILED', {
        operation: fn.name || 'sync',
        error: error instanceof Error ? error.message : String(error),
      });
      reject(error);
    } finally {
      this.isProcessing = false;
      // Process next operation if any
      this.process();
    }
  }

  /**
   * Get current queue status (for debugging)
   */
  getStatus(): { isProcessing: boolean; queueLength: number } {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
    };
  }

  /**
   * Clear queue (only for testing)
   */
  clear(): void {
    this.queue = [];
    this.isProcessing = false;
  }
}

/**
 * Global sync queue singleton
 * All sync operations (manual, auto, recovery) use this queue
 *
 * Usage:
 *   await syncQueue.execute(() => manualSync());
 *   await syncQueue.execute(() => autoSync());
 */
export const syncQueue = new SyncQueue();
