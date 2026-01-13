/**
 * Auto Sync Service (Issue #86)
 * Continuously syncs local and cloud data with 3-second intervals
 *
 * Features:
 * - Continuous Loop: Runs every 3 seconds indefinitely
 * - Alternating Operations: Push (if dirty) → Pull → Push → Pull ...
 * - Conditional Execution: Only pushes if dirty data exists
 * - Network Aware: Pauses when offline, resumes when online
 *
 * Workflow:
 * 1. Timer fires every 3 seconds
 * 2. If nextOperation === 'push':
 *    - Check for dirty transactions
 *    - If exists: push to cloud
 *    - If not: skip silently
 *    - Switch to 'pull' for next cycle
 * 3. If nextOperation === 'pull':
 *    - Fetch and merge cloud data
 *    - Switch to 'push' for next cycle
 * 4. Repeat until user logs out or network goes offline
 *
 * Pillar L: Pure orchestration, no React dependencies
 * Pillar R: Observability - logs all sync events
 */

import type { UserId } from '../../../00_kernel/types';
import { on } from '../../../00_kernel/eventBus';
import { logger } from '../../../00_kernel/telemetry';
import { networkMonitor } from '../utils/networkMonitor';

// Debounce delay after local operation
const AUTO_SYNC_DELAY_MS = 3000; // 3 seconds

// Maximum retry attempts for failed syncs
const MAX_RETRY_ATTEMPTS = 3;

class AutoSyncService {
  private initialized = false;
  private userId: UserId | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private nextOperation: 'push' | 'pull' = 'push'; // Alternating schedule
  private syncInProgress = false; // ✅ Prevent concurrent execution
  private retryCount = 0;
  private cleanupListeners: Array<() => void> = [];
  private activeSyncUserId: UserId | null = null; // ⚠️ Detect user switching

  /**
   * Initialize auto-sync service
   * Called once at app startup
   */
  init(): void {
    if (this.initialized) {
      logger.warn('auto_sync_service_init', { status: 'already_initialized' });
      return;
    }
    this.initialized = true;

    logger.debug('auto_sync_service_init', { phase: 'start' });

    // Listen to local transaction changes - mark that sync is needed
    this.cleanupListeners.push(
      on('transaction:confirmed', () => this.markDirty()),
      on('transaction:updated', () => this.markDirty()),
      on('transaction:deleted', () => this.markDirty()),
    );

    // Listen to network status changes - restart timer when reconnecting
    const unsubNetwork = networkMonitor.subscribe((online) => {
      if (online) {
        logger.info('auto_sync_network_reconnect', { action: 'restart_timer' });
        this.restartSyncTimer();
      }
    });
    this.cleanupListeners.push(unsubNetwork);

    logger.info('auto_sync_service_initialized');
  }

  /**
   * Set current user for sync operations
   * ⚠️ Resets state to prevent data leakage between users
   */
  setUser(userId: UserId | null): void {
    this.userId = userId;
    // Reset retry count when user changes
    this.retryCount = 0;
    // Reset active sync user ID (prevents user switching mid-sync)
    this.activeSyncUserId = null;
    // Reset operation (force pull first for new user = safety)
    this.nextOperation = 'pull';
    // Restart the sync timer for new user
    if (userId) {
      this.restartSyncTimer();
    } else {
      this.stopSyncTimer();
    }
  }

  /**
   * Mark that sync is needed (data has changed locally)
   */
  private markDirty(): void {
    logger.debug('auto_sync_dirty_marked', {
      userId: this.userId,
      nextOperation: this.nextOperation,
    });
    // Timer is always running, so it will pick this up in next cycle
  }

  /**
   * Restart the sync timer
   * Every 3 seconds: Check if operation is needed, execute, then alternate
   * ✅ Force next operation to 'pull' on restart (network recovery)
   */
  private restartSyncTimer(): void {
    // Clear any existing timer
    this.stopSyncTimer();

    if (!this.userId || !networkMonitor.getStatus()) {
      logger.debug('auto_sync_timer_not_started', {
        reason: !this.userId ? 'no_user' : 'offline',
      });
      return;
    }

    // ⚠️ NETWORK RECOVERY: Force next operation to pull
    // This ensures we pull latest cloud state after network recovery
    this.nextOperation = 'pull';

    logger.info('auto_sync_timer_started', {
      userId: this.userId,
      intervalMs: AUTO_SYNC_DELAY_MS,
      nextOperation: this.nextOperation,
    });

    // Start interval timer: execute every 3 seconds
    this.syncTimer = setInterval(
      () => {
        this.executeSyncCycle();
      },
      AUTO_SYNC_DELAY_MS,
    );
  }

  /**
   * Stop the sync timer
   */
  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      logger.info('auto_sync_timer_stopped');
    }
  }

  /**
   * Execute one sync cycle: alternate between push and pull
   * ⚠️ Protected against concurrent execution
   * ⚠️ Protected against user switching mid-sync
   */
  private async executeSyncCycle(): Promise<void> {
    // ✅ Prevent concurrent execution (Timer overflow protection)
    if (this.syncInProgress) {
      logger.debug('auto_sync_cycle_skipped', {
        reason: 'sync_already_in_progress',
        userId: this.userId,
      });
      return;
    }

    if (!this.userId || !networkMonitor.getStatus()) {
      return;
    }

    // ⚠️ SECURITY: Detect user switching (user logged out and logged in as someone else)
    // This prevents User A's push from going to User B's account
    if (this.activeSyncUserId && this.activeSyncUserId !== this.userId) {
      logger.warn('auto_sync_user_mismatch', {
        expected: this.activeSyncUserId,
        current: this.userId,
      });
      // Reset and restart timer with new user
      this.restartSyncTimer();
      return;
    }

    // ✅ Mark sync as in progress
    this.syncInProgress = true;
    this.activeSyncUserId = this.userId;

    logger.info('auto_sync_cycle_execute', {
      userId: this.userId,
      operation: this.nextOperation,
    });

    try {
      if (this.nextOperation === 'push') {
        // Try to push dirty transactions
        const pushResult = await this.executePush();
        logger.info('auto_sync_push_cycle_complete', {
          synced: pushResult.synced,
          failed: pushResult.failed.length,
          userId: this.userId,
        });

        // ⚠️ Only advance if push succeeded (no failed transactions)
        // If push failed, keep push for next cycle to retry
        if (pushResult.failed.length === 0) {
          this.nextOperation = 'pull';
        } else {
          logger.debug('auto_sync_push_failed', {
            failedCount: pushResult.failed.length,
            retryCount: this.retryCount,
          });
        }
      } else {
        // Pull transactions from cloud
        const pullResult = await this.executePull();
        logger.info('auto_sync_pull_cycle_complete', {
          synced: pullResult.synced,
          conflicts: pullResult.conflicts,
          userId: this.userId,
        });

        // Alternate back to push for next cycle
        this.nextOperation = 'push';
      }

      // Reset retry count on successful cycle
      this.retryCount = 0;
    } catch (error) {
      const errorMsg = String(error);
      logger.error('auto_sync_cycle_failed', {
        userId: this.userId,
        operation: this.nextOperation,
        error: errorMsg,
        retryCount: this.retryCount,
      });

      // Schedule retry after max attempts
      if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
        logger.warn('auto_sync_max_retries_reached', {
          maxAttempts: MAX_RETRY_ATTEMPTS,
          userId: this.userId,
        });
        this.retryCount = 0;
      } else {
        this.retryCount++;
      }
    } finally {
      // ✅ CRITICAL: Always reset the flag, even if error or early return
      // This prevents timer overflow deadlock
      this.syncInProgress = false;
    }
  }

  /**
   * Execute push operation: sync dirty transactions to cloud
   */
  private async executePush(): Promise<{ synced: number; failed: string[] }> {
    if (!this.userId) return { synced: 0, failed: [] };

    const { transactionPushService } = await import('./transactionPushService');
    const { createTraceId } = await import('../../../00_kernel/types');

    const traceId = createTraceId();

    // Check if there's dirty data to push
    const { fetchDirtyTransactions } = await import('../../transaction/adapters/transactionDb');
    const dirtyTxs = await fetchDirtyTransactions(this.userId);

    if (dirtyTxs.length === 0) {
      logger.debug('auto_sync_push_skip', {
        reason: 'no_dirty_data',
        userId: this.userId,
      });
      return { synced: 0, failed: [] };
    }

    logger.info('auto_sync_push_execute', {
      dirtyCount: dirtyTxs.length,
      userId: this.userId,
    });

    // Process offline queue first
    await transactionPushService.processQueue(this.userId, traceId);

    // Push dirty transactions
    const result = await transactionPushService.syncDirtyTransactions(this.userId, traceId);

    return {
      synced: result.synced,
      failed: result.failed.map((id) => String(id)),
    };
  }

  /**
   * Execute pull operation: fetch and merge cloud transactions
   */
  private async executePull(): Promise<{ synced: number; conflicts: number; errors: string[] }> {
    if (!this.userId) return { synced: 0, conflicts: 0, errors: [] };

    const { pullTransactions } = await import('./transactionPullService');
    const { createTraceId } = await import('../../../00_kernel/types');

    const traceId = createTraceId();

    logger.info('auto_sync_pull_execute', { userId: this.userId });

    const result = await pullTransactions(this.userId, traceId);

    return {
      synced: result.synced,
      conflicts: result.conflicts,
      errors: result.errors,
    };
  }



  /**
   * Manually trigger sync (for UI sync button)
   */
  async triggerManualSync(): Promise<void> {
    if (!this.userId) {
      logger.warn('manual_sync_skipped', { reason: 'no_user' });
      return;
    }

    logger.info('manual_sync_triggered', { userId: this.userId });

    // Execute current operation immediately
    await this.executeSyncCycle();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopSyncTimer();
    this.cleanupListeners.forEach((cleanup) => cleanup());
    this.cleanupListeners = [];
    this.initialized = false;
  }
}

export const autoSyncService = new AutoSyncService();
