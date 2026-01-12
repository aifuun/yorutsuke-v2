// Pillar L: Headless - logic without UI
// Pillar D: FSM - explicit state machine for sync
import { useState, useCallback, useEffect, useRef } from 'react';
import type { UserId } from '../../../00_kernel/types';
import { createTraceId } from '../../../00_kernel/types';
import type { PullSyncResult } from '../../sync';
import { pullTransactions } from '../../sync';
import { logger } from '../../../00_kernel/telemetry/logger';

const LAST_SYNCED_KEY = 'transaction_last_synced_at';
const AUTO_SYNC_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// FSM State
type State =
  | { status: 'idle' }
  | { status: 'syncing' }
  | { status: 'success'; result: PullSyncResult }
  | { status: 'error'; error: string };

/**
 * Headless hook for transaction synchronization
 * Returns data + actions, no JSX (Pillar L)
 * Uses FSM for state management (Pillar D)
 *
 * @param userId - User ID to sync transactions for
 * @param autoSync - Whether to auto-sync on mount (default: true)
 */
export function useSyncLogic(userId: UserId | null, autoSync: boolean = true) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const hasAutoSynced = useRef(false);

  // Load last synced timestamp from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_SYNCED_KEY);
      if (stored) {
        setLastSyncedAt(stored);
      }
    } catch (error) {
      logger.warn('sync_load_timestamp_failed', { error: String(error) });
    }
  }, []);

  /**
   * Sync transactions from cloud to local
   * Pillar Q: Idempotent - safe to call multiple times
   */
  const sync = useCallback(
    async (startDate?: string, endDate?: string) => {
      if (!userId) {
        logger.warn('sync_skipped_no_user');
        return;
      }

      setState({ status: 'syncing' });
      logger.info('sync_started', { userId, startDate, endDate });

      try {
        const traceId = createTraceId();
        const result = await pullTransactions(userId, traceId, startDate, endDate);

        if (result.errors.length > 0) {
          // Partial failure - show error but keep result
          setState({ status: 'error', error: result.errors.join('; ') });
          logger.warn('sync_partial_failure', { userId, result });
        } else {
          setState({ status: 'success', result });
          logger.info('sync_success', { userId, result });
        }

        // Update last synced timestamp
        const now = new Date().toISOString();
        setLastSyncedAt(now);

        try {
          localStorage.setItem(LAST_SYNCED_KEY, now);
        } catch (error) {
          logger.warn('sync_save_timestamp_failed', { error: String(error) });
        }
      } catch (error) {
        setState({ status: 'error', error: String(error) });
        logger.error('sync_failed', { userId, error: String(error) });
      }
    },
    [userId]
  );

  /**
   * Check if auto-sync should run
   * Returns true if last sync was more than 5 minutes ago
   */
  const shouldAutoSync = useCallback((): boolean => {
    if (!lastSyncedAt) return true; // Never synced

    try {
      const lastSyncTime = new Date(lastSyncedAt).getTime();
      const now = Date.now();
      const elapsed = now - lastSyncTime;

      return elapsed > AUTO_SYNC_THRESHOLD_MS;
    } catch {
      return true; // Invalid timestamp, sync anyway
    }
  }, [lastSyncedAt]);

  /**
   * Auto-sync on mount if enabled and conditions are met
   * Only runs once per userId, doesn't depend on sync callback
   */
  useEffect(() => {
    console.log('[useSyncLogic] useEffect triggered:', { autoSync, userId, shouldAutoSync: shouldAutoSync(), hasAutoSynced: hasAutoSynced.current });

    // Reset flag when userId changes
    hasAutoSynced.current = false;

    if (!autoSync || !userId) {
      return;
    }

    if (shouldAutoSync()) {
      console.log('[useSyncLogic] Triggering auto-sync');
      logger.info('sync_auto_triggered', { userId, reason: 'mount' });
      hasAutoSynced.current = true;
      sync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, userId]); // Removed sync from deps to prevent infinite loop

  /**
   * Get time since last sync in human-readable format
   */
  const getTimeSinceLastSync = useCallback((): string | null => {
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
  }, [lastSyncedAt]);

  return {
    state,
    lastSyncedAt,
    sync,
    shouldAutoSync,
    getTimeSinceLastSync,
  };
}
