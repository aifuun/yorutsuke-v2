/**
 * Manual Sync Service
 * Manages user-triggered sync operations and UI state
 *
 * Migrated from transaction/headless/useSyncLogic.ts (Issue #141)
 * Pillar D: FSM - explicit state machine
 * Pillar J: Locality - state near usage
 */

import { createStore } from 'zustand/vanilla';
import type { UserId } from '../../../00_kernel/types';
import type { FullSyncResult } from './syncCoordinator';
import { fullSync } from './syncCoordinator';
import { logger } from '../../../00_kernel/telemetry/logger';

const LAST_SYNCED_KEY = 'transaction_last_synced_at';
const AUTO_SYNC_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// FSM State with persistent timestamp
type ManualSyncStore =
  | { status: 'idle'; lastSyncedAt: string | null }
  | { status: 'syncing'; lastSyncedAt: string | null }
  | { status: 'success'; result: FullSyncResult; lastSyncedAt: string | null }
  | { status: 'error'; error: string; lastSyncedAt: string | null };

class ManualSyncService {
  // Zustand vanilla store
  store = createStore<ManualSyncStore>(() => ({
    status: 'idle',
    lastSyncedAt: null,
  }));

  /**
   * Initialize service - load last synced timestamp
   * Called once at app startup
   */
  init(): void {
    try {
      const stored = localStorage.getItem(LAST_SYNCED_KEY);
      if (stored) {
        this.store.setState({ lastSyncedAt: stored });
        logger.debug('manual_sync_init', { lastSyncedAt: stored });
      }
    } catch (error) {
      logger.warn('sync_load_timestamp_failed', { error: String(error) });
    }
  }

  /**
   * Full bidirectional sync (Push + Pull)
   * Pillar Q: Idempotent - safe to call multiple times
   *
   * @param userId - User ID to sync for
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   */
  async sync(userId: UserId, startDate?: string, endDate?: string): Promise<void> {
    if (!userId) {
      logger.warn('sync_skipped_no_user');
      return;
    }

    this.store.setState({ status: 'syncing', lastSyncedAt: this.store.getState().lastSyncedAt });
    logger.info('sync_started', { userId, startDate, endDate });

    try {
      // Full sync: Push local changes + Pull cloud changes
      const result = await fullSync(userId, startDate, endDate);

      // Check for errors in pull result
      if (result.pull.errors.length > 0) {
        // Partial failure - show error but keep result
        this.store.setState({
          status: 'error',
          error: result.pull.errors.join('; '),
          lastSyncedAt: this.store.getState().lastSyncedAt
        });
        logger.warn('sync_partial_failure', { userId, result });
      } else {
        this.store.setState({
          status: 'success',
          result,
          lastSyncedAt: this.store.getState().lastSyncedAt
        });
        logger.info('sync_success', { userId, result });
      }

      // Update last synced timestamp
      const now = new Date().toISOString();
      this.store.setState({ lastSyncedAt: now });

      try {
        localStorage.setItem(LAST_SYNCED_KEY, now);
      } catch (error) {
        logger.warn('sync_save_timestamp_failed', { error: String(error) });
      }
    } catch (error) {
      this.store.setState({
        status: 'error',
        error: String(error),
        lastSyncedAt: this.store.getState().lastSyncedAt
      });
      logger.error('sync_failed', { userId, error: String(error) });
    }
  }

  /**
   * Check if auto-sync should run
   * Returns true if last sync was more than 5 minutes ago
   */
  shouldAutoSync(): boolean {
    const { lastSyncedAt } = this.store.getState();
    if (!lastSyncedAt) return true; // Never synced

    try {
      const lastSyncTime = new Date(lastSyncedAt).getTime();
      const now = Date.now();
      const elapsed = now - lastSyncTime;

      return elapsed > AUTO_SYNC_THRESHOLD_MS;
    } catch {
      return true; // Invalid timestamp, sync anyway
    }
  }

  /**
   * Get time since last sync in human-readable format
   */
  getTimeSinceLastSync(): string | null {
    const { lastSyncedAt } = this.store.getState();
    if (!lastSyncedAt) return null;

    try {
      const lastSyncTime = new Date(lastSyncedAt).getTime();
      const now = Date.now();
      const elapsedMs = now - lastSyncTime;

      if (elapsedMs < 60_000) {
        return 'just now';
      }

      const elapsedMinutes = Math.floor(elapsedMs / 60_000);
      if (elapsedMinutes < 60) {
        return `${elapsedMinutes} min ago`;
      }

      const elapsedHours = Math.floor(elapsedMinutes / 60);
      if (elapsedHours < 24) {
        return `${elapsedHours}h ago`;
      }

      const elapsedDays = Math.floor(elapsedHours / 24);
      return `${elapsedDays}d ago`;
    } catch {
      return null;
    }
  }

  /**
   * Reset sync state (for testing/debugging)
   */
  reset(): void {
    this.store.setState({ status: 'idle', lastSyncedAt: null });
    try {
      localStorage.removeItem(LAST_SYNCED_KEY);
    } catch {
      // Ignore cleanup errors
    }
  }
}

export const manualSyncService = new ManualSyncService();
