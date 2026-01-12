/**
 * Auto Sync Service (Issue #86)
 * Automatically triggers Push sync after local operations with debouncing
 *
 * Features:
 * - Debounce: Waits 3 seconds after last operation before syncing
 * - Network check: Only syncs when online
 * - Push-first: Uses fullSync to ensure local changes are pushed first
 *
 * Pillar L: Pure orchestration, no React dependencies
 * Pillar R: Observability - logs all sync events
 */

import type { UserId } from '../../../00_kernel/types';
import { on, emit } from '../../../00_kernel/eventBus';
import { logger } from '../../../00_kernel/telemetry';
import { networkMonitor } from '../utils/networkMonitor';
import { fullSync } from './syncCoordinator';

// Debounce delay after local operation
const AUTO_SYNC_DELAY_MS = 3000; // 3 seconds

// Maximum retry attempts for failed syncs
const MAX_RETRY_ATTEMPTS = 3;

// Exponential backoff base delay
const RETRY_BASE_DELAY_MS = 5000; // 5 seconds

class AutoSyncService {
  private initialized = false;
  private userId: UserId | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private cleanupListeners: Array<() => void> = [];

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

    // Listen to local transaction changes
    this.cleanupListeners.push(
      on('transaction:confirmed', () => this.scheduleSync('confirm')),
      on('transaction:updated', () => this.scheduleSync('update')),
      on('transaction:deleted', () => this.scheduleSync('delete')),
    );

    // Listen to network status changes - sync when reconnecting
    const unsubNetwork = networkMonitor.subscribe((online) => {
      if (online) {
        logger.info('auto_sync_network_reconnect', { action: 'trigger_sync' });
        this.scheduleSync('network_reconnect');
      }
    });
    this.cleanupListeners.push(unsubNetwork);

    logger.info('auto_sync_service_initialized');
  }

  /**
   * Set current user for sync operations
   */
  setUser(userId: UserId | null): void {
    this.userId = userId;
    // Reset retry count when user changes
    this.retryCount = 0;
  }

  /**
   * Schedule a sync after debounce delay
   * Resets timer on each call (debounce pattern)
   *
   * @param reason - Trigger reason for logging
   */
  scheduleSync(reason: string): void {
    // Check if user is set
    if (!this.userId) {
      logger.debug('auto_sync_skipped', { reason: 'no_user' });
      return;
    }

    // Check network status - don't start timer if offline
    if (!networkMonitor.getStatus()) {
      logger.debug('auto_sync_skipped', { reason: 'offline' });
      return;
    }

    // Cancel any pending sync (debounce)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      logger.debug('auto_sync_debounced', { reason });
    }

    // Cancel any retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // Schedule new sync
    logger.info('auto_sync_scheduled', {
      reason,
      delayMs: AUTO_SYNC_DELAY_MS,
      userId: this.userId,
    });

    this.debounceTimer = setTimeout(() => {
      this.performSync();
      this.debounceTimer = null;
    }, AUTO_SYNC_DELAY_MS);
  }

  /**
   * Perform full sync (Push + Pull)
   */
  private async performSync(): Promise<void> {
    if (!this.userId) {
      logger.warn('auto_sync_aborted', { reason: 'no_user' });
      return;
    }

    // Double-check network before sync
    if (!networkMonitor.getStatus()) {
      logger.info('auto_sync_aborted', { reason: 'offline_at_sync_time' });
      return;
    }

    logger.info('auto_sync_started', { userId: this.userId, retryCount: this.retryCount });

    try {
      const result = await fullSync(this.userId);

      // Reset retry count on success
      this.retryCount = 0;

      logger.info('auto_sync_complete', {
        userId: this.userId,
        pushSynced: result.push.synced,
        pushFailed: result.push.failed.length,
        pullSynced: result.pull.synced,
        pullConflicts: result.pull.conflicts,
      });

      // Emit event to notify UI
      emit('sync:complete', {
        push: result.push,
        pull: result.pull,
        source: 'auto',
      });

    } catch (error) {
      const errorMsg = String(error);
      logger.error('auto_sync_failed', {
        userId: this.userId,
        error: errorMsg,
        retryCount: this.retryCount,
      });

      // Emit error event for UI
      emit('sync:error', {
        error: errorMsg,
        source: 'auto',
      });

      // Schedule retry with exponential backoff
      this.scheduleRetry();
    }
  }

  /**
   * Schedule retry with exponential backoff
   */
  private scheduleRetry(): void {
    if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
      logger.warn('auto_sync_max_retries', {
        maxAttempts: MAX_RETRY_ATTEMPTS,
        userId: this.userId,
      });
      this.retryCount = 0;
      return;
    }

    // Exponential backoff: 5s, 10s, 20s
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, this.retryCount);
    this.retryCount++;

    logger.info('auto_sync_retry_scheduled', {
      attempt: this.retryCount,
      delayMs: delay,
    });

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.performSync();
    }, delay);
  }

  /**
   * Manually trigger sync (for UI sync button)
   */
  async triggerManualSync(): Promise<void> {
    // Cancel any pending auto-sync
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // Reset retry count for manual sync
    this.retryCount = 0;

    await this.performSync();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.cleanupListeners.forEach((cleanup) => cleanup());
    this.cleanupListeners = [];
    this.initialized = false;
  }
}

export const autoSyncService = new AutoSyncService();
