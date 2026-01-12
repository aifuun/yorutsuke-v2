/**
 * Sync Coordinator
 * Unified entry point for bidirectional sync operations
 *
 * Orchestrates:
 * - Push: Local → Cloud (dirty records)
 * - Pull: Cloud → Local (new transactions)
 */

import type { UserId } from '../../../00_kernel/types';
import { createTraceId } from '../../../00_kernel/types';
import { transactionPushService } from './transactionPushService';
import { pullTransactions } from './transactionPullService';
import type { PushSyncResult } from './transactionPushService';
import type { PullSyncResult } from './transactionPullService';
import { logger } from '../../../00_kernel/telemetry/logger';

export interface FullSyncResult {
  push: PushSyncResult;
  pull: PullSyncResult;
}

/**
 * Full bidirectional sync
 * Step 1: Push local changes to cloud (confirm/edit/delete)
 * Step 2: Pull new transactions from cloud (Lambda processed)
 *
 * @param userId - User ID
 * @param startDate - Optional start date filter for pull (YYYY-MM-DD)
 * @param endDate - Optional end date filter for pull (YYYY-MM-DD)
 * @returns Combined push and pull results
 */
export async function fullSync(
  userId: UserId,
  startDate?: string,
  endDate?: string
): Promise<FullSyncResult> {
  // Create traceId for this sync operation (Pillar N)
  const traceId = createTraceId();

  logger.info('full_sync_started', {
    module: 'sync-coordinator',
    event: 'FULL_SYNC_STARTED',
    userId,
    traceId,
  });

  // Step 1a: Process offline queue first (queued items from previous failures)
  await transactionPushService.processQueue(userId, traceId);

  // Step 1b: Push local changes (Local → Cloud)
  const pushResult = await transactionPushService.syncDirtyTransactions(userId, traceId);

  logger.info('full_sync_push_complete', {
    module: 'sync-coordinator',
    synced: pushResult.synced,
    failed: pushResult.failed.length,
    queued: pushResult.queued,
    traceId,
  });

  // Step 2: Pull new data (Cloud → Local)
  const pullResult = await pullTransactions(userId, traceId, startDate, endDate);

  logger.info('full_sync_pull_complete', {
    module: 'sync-coordinator',
    synced: pullResult.synced,
    conflicts: pullResult.conflicts,
    errors: pullResult.errors.length,
    traceId,
  });

  logger.info('full_sync_complete', {
    module: 'sync-coordinator',
    event: 'FULL_SYNC_COMPLETE',
    push: pushResult,
    pull: pullResult,
    traceId,
  });

  return {
    push: pushResult,
    pull: pullResult,
  };
}

/**
 * Push only: Sync dirty records to cloud (Local → Cloud)
 * Alias for transactionPushService.syncDirtyTransactions()
 *
 * @param userId - User ID
 * @param traceId - Trace ID for observability (optional, creates new if not provided)
 * @returns Push result
 */
export async function pushTransactions(userId: UserId, traceId?: import('../../../00_kernel/types').TraceId): Promise<PushSyncResult> {
  const tid = traceId || createTraceId();
  return transactionPushService.syncDirtyTransactions(userId, tid);
}

/**
 * Pull only: Sync transactions from cloud (Cloud → Local)
 * Alias for pullTransactions()
 *
 * @param userId - User ID
 * @param startDate - Optional start date filter (YYYY-MM-DD)
 * @param endDate - Optional end date filter (YYYY-MM-DD)
 * @returns Pull result
 */
export { pullTransactions };
