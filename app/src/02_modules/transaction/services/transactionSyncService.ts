// Transaction Sync Service
// Listens to upload:complete events and triggers transaction sync
// Pillar L: Pure orchestration, no React dependencies

import type { UserId } from '../../../00_kernel/types';
import { on, emit } from '../../../00_kernel/eventBus';
import { logger } from '../../../00_kernel/telemetry';
import { syncTransactions } from './syncService';

// Delay after upload completes before syncing (allow Lambda to process)
const SYNC_DELAY_MS = 5000; // 5 seconds (Lambda processing time)

class TransactionSyncService {
  private initialized = false;
  private userId: UserId | null = null;
  private cleanupUploadListener: (() => void) | null = null;
  private pendingSyncTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialize transaction sync service
   * Called once at app startup, registers event listeners
   */
  init(): void {
    if (this.initialized) {
      logger.warn('transaction_sync_service_init', { status: 'already_initialized' });
      return;
    }
    this.initialized = true;

    logger.debug('transaction_sync_service_init', { phase: 'start' });

    // Listen to upload:complete events
    this.cleanupUploadListener = on('upload:complete', (payload) => {
      logger.info('transaction_sync_auto_trigger', {
        imageId: payload.id,
        traceId: payload.traceId,
        s3Key: payload.s3Key,
        delay: SYNC_DELAY_MS,
      });

      // Trigger sync after delay (allow Lambda to process image and create transaction)
      this.scheduleSync();
    });

    logger.info('transaction_sync_service_initialized');
  }

  /**
   * Set current user for sync operations
   */
  setUser(userId: UserId | null): void {
    this.userId = userId;
  }

  /**
   * Schedule a sync after delay
   * Debounces multiple upload completions to avoid excessive syncs
   */
  private scheduleSync(): void {
    // Cancel any pending sync
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
      logger.debug('transaction_sync_auto_trigger', { phase: 'debounced' });
    }

    // Schedule new sync
    this.pendingSyncTimeout = setTimeout(() => {
      this.performSync();
      this.pendingSyncTimeout = null;
    }, SYNC_DELAY_MS);
  }

  /**
   * Perform transaction sync
   */
  private async performSync(): Promise<void> {
    if (!this.userId) {
      logger.warn('transaction_sync_skipped', { reason: 'no_user' });
      return;
    }

    logger.info('transaction_sync_auto_started', { userId: this.userId });

    try {
      const result = await syncTransactions(this.userId);
      logger.info('transaction_sync_auto_complete', {
        userId: this.userId,
        synced: result.synced,
        conflicts: result.conflicts,
        errors: result.errors.length,
      });

      // Emit event to notify UI to reload
      emit('transaction:synced', {
        userId: this.userId,
        result,
      });
    } catch (error) {
      logger.error('transaction_sync_auto_failed', {
        userId: this.userId,
        error: String(error),
      });
    }
  }

  /**
   * Manually trigger sync (e.g., from UI button)
   */
  async triggerSync(): Promise<void> {
    if (!this.userId) {
      logger.warn('transaction_sync_skipped', { reason: 'no_user' });
      return;
    }

    await this.performSync();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
      this.pendingSyncTimeout = null;
    }
    this.cleanupUploadListener?.();
    this.initialized = false;
  }
}

export const transactionSyncService = new TransactionSyncService();
