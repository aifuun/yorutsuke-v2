/**
 * Recovery Service (Issue #86 Phase 4)
 * Detects and recovers from sync failures
 *
 * Scenarios:
 * - App crashed during sync (dirty records remain)
 * - Network failure during sync (queue has pending items)
 * - User manually closed app before sync completed
 *
 * Pillar R: Observability - Log recovery events
 */

import type { UserId } from '../../../00_kernel/types';
import { logger } from '../../../00_kernel/telemetry/logger';
import * as transactionDb from '../../transaction/adapters/transactionDb';
import { syncStore } from '../stores/syncStore';

export interface RecoveryStatus {
  needsRecovery: boolean;
  dirtyCount: number;
  queueCount: number;
  lastSyncedAt: string | null;
}

class RecoveryService {
  /**
   * Check if recovery is needed
   * Called on app startup
   *
   * @param userId - User ID
   * @returns Recovery status
   */
  async checkRecoveryStatus(userId: UserId | null): Promise<RecoveryStatus> {
    if (!userId) {
      return {
        needsRecovery: false,
        dirtyCount: 0,
        queueCount: 0,
        lastSyncedAt: null,
      };
    }

    try {
      // Check for dirty records in database
      const dirtyTransactions = await transactionDb.fetchDirtyTransactions(userId);
      const dirtyCount = dirtyTransactions.length;

      // Check offline queue
      const queueCount = syncStore.getState().queue.length;

      // Get last synced timestamp
      const lastSyncedAt = syncStore.getState().lastSyncedAt;

      const needsRecovery = dirtyCount > 0 || queueCount > 0;

      if (needsRecovery) {
        logger.info('recovery_needed', {
          module: 'sync',
          event: 'RECOVERY_NEEDED',
          userId,
          dirtyCount,
          queueCount,
          lastSyncedAt,
        });
      } else {
        logger.debug('recovery_not_needed', {
          module: 'sync',
          userId,
        });
      }

      return {
        needsRecovery,
        dirtyCount,
        queueCount,
        lastSyncedAt,
      };
    } catch (error) {
      logger.error('recovery_check_failed', {
        module: 'sync',
        event: 'RECOVERY_CHECK_FAILED',
        userId,
        error: String(error),
      });

      return {
        needsRecovery: false,
        dirtyCount: 0,
        queueCount: 0,
        lastSyncedAt: null,
      };
    }
  }

  /**
   * Clear all pending sync data
   * Used when user chooses to discard changes
   *
   * @param userId - User ID
   */
  async clearPendingData(userId: UserId): Promise<void> {
    logger.info('recovery_clear_started', {
      module: 'sync',
      event: 'RECOVERY_CLEAR_STARTED',
      userId,
    });

    try {
      // Clear dirty flags in database
      const dirtyTransactions = await transactionDb.fetchDirtyTransactions(userId);
      const dirtyIds = dirtyTransactions.map((tx) => tx.id);

      if (dirtyIds.length > 0) {
        await transactionDb.clearDirtyFlags(dirtyIds);
        logger.info('recovery_dirty_cleared', {
          module: 'sync',
          count: dirtyIds.length,
        });
      }

      // Clear offline queue
      syncStore.getState().clearQueue();

      logger.info('recovery_clear_completed', {
        module: 'sync',
        event: 'RECOVERY_CLEAR_COMPLETED',
        userId,
      });
    } catch (error) {
      logger.error('recovery_clear_failed', {
        module: 'sync',
        event: 'RECOVERY_CLEAR_FAILED',
        userId,
        error: String(error),
      });
      throw error;
    }
  }
}

export const recoveryService = new RecoveryService();
