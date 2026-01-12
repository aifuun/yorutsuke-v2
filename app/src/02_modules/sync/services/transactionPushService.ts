/**
 * Transaction Push Service (Issue #86)
 * Pushes local transaction changes to cloud (Local → Cloud)
 *
 * Responsibilities:
 * - Sync dirty records (confirm/edit/delete) to cloud
 * - Process offline queue
 * - Auto-retry on network reconnect
 *
 * Pillar M: Saga - Compensation for failed syncs (queue + retry)
 * Pillar Q: Idempotency - Sync is safe to retry
 * Pillar R: Observability - Log all sync events
 */

import { logger } from '../../../00_kernel/telemetry/logger';
import type { UserId, TraceId } from '../../../00_kernel/types';
import { TransactionId } from '../../../00_kernel/types';
import * as transactionDb from '../../transaction/adapters/transactionDb';
import * as transactionApi from '../../transaction/adapters/transactionApi';
import { syncStore } from '../stores/syncStore';
import type { SyncAction } from '../stores/syncStore';
import { networkMonitor } from '../utils/networkMonitor';

export interface PushSyncResult {
  synced: number;
  failed: TransactionId[];
  queued: number;
}

class TransactionPushService {
  /**
   * Sync all dirty transactions to cloud
   * (Issue #86 Phase 1: Core Sync Service)
   *
   * @param userId - User ID
   * @param traceId - Trace ID for observability (Pillar N)
   * @returns Result with synced count, failed IDs, and queued count
   */
  async syncDirtyTransactions(userId: UserId, traceId: TraceId): Promise<PushSyncResult> {
    const dirty = await transactionDb.fetchDirtyTransactions(userId);

    if (dirty.length === 0) {
      // No dirty transactions - clear any stale queue items
      const queueSize = syncStore.getState().queue.length;
      if (queueSize > 0) {
        logger.info('sync_clearing_stale_queue', { module: 'sync', userId, queueSize, traceId });
        syncStore.getState().clearQueue();
      }
      logger.info('sync_no_dirty', { module: 'sync', userId, traceId });
      return { synced: 0, failed: [], queued: 0 };
    }

    logger.info('sync_started', {
      module: 'sync',
      event: 'SYNC_STARTED',
      userId,
      dirtyCount: dirty.length,
      traceId,
    });

    // Check network status
    if (!networkMonitor.getStatus()) {
      logger.info('sync_queued_offline', {
        module: 'sync',
        event: 'SYNC_QUEUED_OFFLINE',
        count: dirty.length,
        traceId,
      });

      // Add to queue for later retry
      dirty.forEach((tx) => {
        this.queueSyncAction({
          id: `sync-${tx.id}-${Date.now()}`,
          type: 'update',
          transactionId: tx.id,
          timestamp: new Date().toISOString(),
          payload: tx,
        });
      });

      return { synced: 0, failed: [], queued: dirty.length };
    }

    // Online: Sync to cloud
    try {
      // Set syncing state for UI feedback (inside try block)
      syncStore.getState().setSyncStatus('syncing');

      // ✅ IO-First: Execute all IO operations first
      const result = await transactionApi.syncTransactions(userId, dirty);

      // Clear dirty flags for successfully synced records
      const syncedIds = dirty
        .filter((tx) => !result.failed.includes(tx.id))
        .map((tx) => tx.id);

      if (syncedIds.length > 0) {
        await transactionDb.clearDirtyFlags(syncedIds);
      }

      // Queue failed records for retry
      const failedTxs = dirty.filter((tx) => result.failed.includes(tx.id));
      failedTxs.forEach((tx) => {
        this.queueSyncAction({
          id: `sync-${tx.id}-${Date.now()}`,
          type: 'update',
          transactionId: tx.id,
          timestamp: new Date().toISOString(),
          payload: tx,
        });
      });

      // ✅ After all IO completes, update store (triggers UI refresh)
      const timestamp = new Date().toISOString();
      syncStore.getState().setLastSyncedAt(timestamp);
      syncStore.getState().setSyncStatus('success');

      // Clear queue if all synced successfully (no failures)
      if (failedTxs.length === 0) {
        syncStore.getState().clearQueue();
      }

      logger.info('sync_completed', {
        module: 'sync',
        event: 'SYNC_COMPLETED',
        synced: result.synced,
        failed: result.failed.length,
        queued: failedTxs.length,
        traceId,
      });

      // ✅ Use branded type constructor instead of unsafe cast
      return {
        synced: result.synced,
        failed: result.failed.map((id) => TransactionId(String(id))),
        queued: failedTxs.length,
      };
    } catch (error) {
      // Don't re-queue - dirty flags remain on transactions for next sync attempt
      // Re-queueing here caused exponential queue growth bug

      syncStore.getState().setSyncStatus('error');
      syncStore.getState().setLastError(String(error));

      logger.error('sync_failed', {
        module: 'sync',
        event: 'SYNC_FAILED',
        error: String(error),
        count: dirty.length,
        traceId,
      });

      throw error;
    }
  }

  /**
   * Process offline queue when network reconnects
   * (Issue #86 Phase 1: Offline Queue)
   *
   * Note: Queue items are markers that "sync is needed", not individual work items.
   * We clear the queue first, then sync once. If sync fails, dirty transactions
   * remain marked and will be synced next time.
   *
   * @param userId - User ID
   * @param traceId - Trace ID for observability
   */
  async processQueue(userId: UserId, traceId: TraceId): Promise<void> {
    const queueSize = syncStore.getState().queue.length;

    if (queueSize === 0) {
      return;
    }

    logger.info('queue_process_started', {
      module: 'sync',
      event: 'QUEUE_PROCESS_STARTED',
      queueSize,
      traceId,
    });

    // Clear queue FIRST to prevent re-queueing loop
    // If sync fails, dirty flags remain on transactions for next sync attempt
    syncStore.getState().clearQueue();

    logger.info('queue_cleared', {
      module: 'sync',
      event: 'QUEUE_CLEARED',
      clearedCount: queueSize,
      traceId,
    });

    // Note: syncDirtyTransactions will be called separately by fullSync
    // No need to call it here - the queue is just a marker that sync is needed
  }

  /**
   * Add action to offline queue
   * @private
   */
  private queueSyncAction(action: SyncAction): void {
    syncStore.getState().addToQueue(action);
  }

  /**
   * Clear sync queue (for testing/debugging)
   */
  clearQueue(): void {
    syncStore.getState().clearQueue();
  }
}

export const transactionPushService = new TransactionPushService();
