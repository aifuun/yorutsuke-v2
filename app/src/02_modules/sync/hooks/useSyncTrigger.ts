/**
 * Sync Trigger Hook
 * Ultra-thin React bridge for triggering auto-sync on component mount
 *
 * Migrated from transaction/headless/useSyncLogic.ts (Issue #141)
 * This hook ONLY handles React lifecycle - all business logic is in manualSyncService
 */

import { useEffect, useRef } from 'react';
import type { UserId } from '../../../00_kernel/types';
import { manualSyncService } from '../services/manualSyncService';
import { logger } from '../../../00_kernel/telemetry/logger';

/**
 * Triggers auto-sync on component mount if conditions are met
 * Pure side-effect hook - returns nothing
 *
 * @param userId - User ID to sync for (null if not logged in)
 * @param enabled - Whether auto-sync is enabled (default: true)
 */
export function useSyncTrigger(userId: UserId | null, enabled = true): void {
  const hasTriggered = useRef(false);

  useEffect(() => {
    // Reset flag when userId changes
    hasTriggered.current = false;

    if (!enabled || !userId) {
      return;
    }

    // Only trigger once per userId
    if (hasTriggered.current) {
      return;
    }

    // Check if auto-sync should run
    if (manualSyncService.shouldAutoSync()) {
      logger.info('sync_auto_triggered', { userId, reason: 'mount' });
      hasTriggered.current = true;
      manualSyncService.sync(userId);
    }
  }, [userId, enabled]);
}
