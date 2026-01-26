/**
 * Auto Sync Service (Issue #86)
 * Smart sync with activity-based boost mode
 *
 * Features:
 * - Smart Intervals: 60s normal, 10s boosted
 * - Boost Mode: Triggered by image uploads, lasts 90 seconds
 * - Initial Delay: 8s after upload (wait for Lambda processing)
 * - Alternating Operations: Push (if dirty) → Pull → Push → Pull ...
 * - Network Aware: Pauses when offline, resumes when online
 *
 * Efficiency: ~900 syncs/day (down from 9,600), 91% cost reduction
 *
 * Workflow:
 * 1. User uploads image → boost mode activated
 * 2. Wait 8 seconds (Lambda processing time)
 * 3. Sync every 10 seconds for 90 seconds (9 syncs total)
 * 4. Return to 60-second normal interval
 *
 * Pillar L: Pure orchestration, no React dependencies
 * Pillar R: Observability - logs all sync events
 */

import type { UserId } from '../../../00_kernel/types';
import { on } from '../../../00_kernel/eventBus';
import { logger } from '../../../00_kernel/telemetry';
import { networkMonitor } from '../utils/networkMonitor';
import { syncQueue } from '../utils/syncQueue';

// Smart interval configuration
const BASE_INTERVAL_MS = 60 * 1000;       // Normal: 60 seconds
const BOOSTED_INTERVAL_MS = 10 * 1000;    // Boosted: 10 seconds
const BOOST_DURATION_MS = 90 * 1000;      // Duration: 90 seconds (9 syncs total)
const INITIAL_SYNC_DELAY_MS = 8 * 1000;   // Initial delay: 8 seconds (wait for Lambda)

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
  private lastBoostTime = 0; // ✨ Boost mode tracking

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

    // ✨ NEW: Listen to image uploads - activate boost mode
    this.cleanupListeners.push(
      on('image:uploaded', () => this.activateBoostMode()),
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
   * Start the sync timer
   * Public method for explicit control (e.g., before removing all data, start it after operations complete)
   */
  start(): void {
    if (!this.userId) {
      logger.warn('auto_sync_start', { reason: 'no_user_set' });
      return;
    }
    if (this.syncTimer) {
      logger.debug('auto_sync_start', { status: 'already_running' });
      return;
    }
    logger.info('auto_sync_start', { userId: this.userId });
    this.restartSyncTimer();
  }

  /**
   * Stop the sync timer
   * Public method for explicit control (e.g., before removing all data)
   */
  stop(): void {
    logger.info('auto_sync_stop');
    this.stopSyncTimer();
  }

  /**
   * Restart the sync timer with smart intervals
   * - Normal: 60 seconds
   * - Boosted: 10 seconds (after image upload, lasts 30 seconds)
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

    // ✨ Calculate current interval based on boost mode
    const elapsed = Date.now() - this.lastBoostTime;
    const isBoosted = elapsed < BOOST_DURATION_MS;
    const interval = isBoosted ? BOOSTED_INTERVAL_MS : BASE_INTERVAL_MS;

    logger.info('auto_sync_timer_started', {
      userId: this.userId,
      intervalMs: interval,
      mode: isBoosted ? 'boosted' : 'normal',
      nextOperation: this.nextOperation,
    });

    // Start interval timer with smart interval
    this.syncTimer = setInterval(
      () => {
        this.executeSyncCycle();

        // ✨ Check if boost period expired - restart timer with normal interval
        if (isBoosted) {
          const elapsed = Date.now() - this.lastBoostTime;
          if (elapsed >= BOOST_DURATION_MS) {
            logger.info('auto_sync_boost_expired', { userId: this.userId });
            this.restartSyncTimer(); // Exit boost mode
          }
        }
      },
      interval,
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
    // Queue this cycle to serialize with other sync operations (manual sync, push, pull)
    // The SyncQueue ensures this and manual sync don't run concurrently
    try {
      await syncQueue.execute(() => this._performSyncCycle());
    } catch (error) {
      // Error already logged in _performSyncCycle, just prevent throwing from timer callback
      logger.debug('auto_sync_cycle_queued_error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Internal sync cycle implementation
   * Wrapped by executeSyncCycle via SyncQueue for serialization
   * @private
   */
  private async _performSyncCycle(): Promise<void> {
    // ✅ Prevent concurrent execution (Timer overflow protection)
    // This is a secondary guard - SyncQueue is the primary serialization mechanism
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

    // 🔍 INVESTIGATION: Log pull parameters
    logger.info('auto_sync_pull_execute', {
      userId: this.userId,
      traceId,
      startDate: undefined,  // Auto-sync pulls ALL transactions (no date filter)
      endDate: undefined,
      note: 'Auto-sync pulls without date filters to catch all cloud transactions',
    });

    const result = await pullTransactions(this.userId, traceId);

    // 🔍 INVESTIGATION: Log detailed pull result
    logger.info('auto_sync_pull_complete', {
      userId: this.userId,
      traceId,
      synced: result.synced,
      conflicts: result.conflicts,
      errorCount: result.errors.length,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });

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
   * ✨ Activate boost mode
   * Triggered by image uploads - speeds up sync for 30 seconds
   * Waits 8 seconds initially to let Lambda process
   */
  private activateBoostMode(): void {
    this.lastBoostTime = Date.now();

    logger.info('auto_sync_boost_activated', {
      userId: this.userId,
      boostDuration: BOOST_DURATION_MS,
      initialDelay: INITIAL_SYNC_DELAY_MS,
    });

    // Wait for Lambda to process, then execute first boosted sync
    setTimeout(() => {
      if (this.userId) {
        logger.debug('auto_sync_boost_initial_sync', { userId: this.userId });
        this.executeSyncCycle();
      }
    }, INITIAL_SYNC_DELAY_MS);

    // Restart timer with boosted interval
    this.restartSyncTimer();
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
