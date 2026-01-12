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
import type { UserId, TransactionId, TraceId } from '../../../00_kernel/types';
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
    // Set syncing state before IO operations (UI feedback)
    syncStore.getState().setSyncStatus('syncing');

    try {
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

      logger.info('sync_completed', {
        module: 'sync',
        event: 'SYNC_COMPLETED',
        synced: result.synced,
        failed: result.failed.length,
        queued: failedTxs.length,
        traceId,
      });

      return {
        synced: result.synced,
        failed: result.failed.map((id) => id as TransactionId),
        queued: failedTxs.length,
      };
    } catch (error) {
      // Queue all for retry (before store updates)
      dirty.forEach((tx) => {
        this.queueSyncAction({
          id: `sync-${tx.id}-${Date.now()}`,
          type: 'update',
          transactionId: tx.id,
          timestamp: new Date().toISOString(),
          payload: tx,
        });
      });

      // ✅ Update store after queueing
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
   * @param userId - User ID
   * @param traceId - Trace ID for observability
   */
  async processQueue(userId: UserId, traceId: TraceId): Promise<void> {
    const queue = syncStore.getState().queue;

    if (queue.length === 0) {
      return;
    }

    logger.info('queue_process_started', {
      module: 'sync',
      event: 'QUEUE_PROCESS_STARTED',
      queueSize: queue.length,
      traceId,
    });

    syncStore.getState().setSyncStatus('syncing');

    for (const action of queue) {
      try {
        await this.processSyncAction(userId, action, traceId);
        syncStore.getState().removeFromQueue(action.id);

        logger.debug('queue_action_processed', {
          module: 'sync',
          actionId: action.id,
          type: action.type,
          traceId,
        });
      } catch (error) {
        logger.error('queue_action_failed', {
          module: 'sync',
          event: 'QUEUE_ACTION_FAILED',
          actionId: action.id,
          error: String(error),
          traceId,
        });
        // Keep in queue for next retry
      }
    }

    // Reset to idle after queue processing (success or partial success)
    syncStore.getState().setSyncStatus('idle');

    logger.info('queue_process_completed', {
      module: 'sync',
      event: 'QUEUE_PROCESS_COMPLETED',
      remaining: syncStore.getState().queue.length,
      traceId,
    });
  }

  /**
   * Process a single sync action from queue
   * @private
   */
  private async processSyncAction(userId: UserId, _action: SyncAction, traceId: TraceId): Promise<void> {
    // For now, re-sync all dirty transactions
    // In future, can optimize to sync only the specific transaction
    await this.syncDirtyTransactions(userId, traceId);
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
