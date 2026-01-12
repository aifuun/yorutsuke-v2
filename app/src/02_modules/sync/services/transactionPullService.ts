// Transaction Pull Service
// Pulls transactions from cloud to local (Cloud → Local)
// Orchestrates cloud-to-local synchronization with conflict resolution
// Pillar Q: Idempotent - safe to retry

import type { UserId } from '../../../00_kernel/types';
import { TraceId as makeTraceId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import { fetchTransactionsFromCloud as fetchFromCloud, fetchTransactions as fetchFromLocal, upsertTransaction } from '../../transaction/adapters';
import { logger } from '../../../00_kernel/telemetry/logger';
import { syncImagesForTransactions, type ImageSyncResult } from './imageSyncService';

/**
 * Pull sync result summary
 */
export interface PullSyncResult {
  synced: number; // Number of transactions synced (inserted or updated)
  conflicts: number; // Number of conflicts resolved
  errors: string[]; // Error messages if any
  cloudCount: number; // Total transactions in cloud
  localCount: number; // Total transactions in local before sync
  images?: ImageSyncResult; // Image sync stats (if images were synced)
}

/**
 * Conflict resolution strategy:
 * 1. Local confirmed, cloud not → Local wins (user has manually confirmed)
 * 2. Cloud updatedAt > Local updatedAt → Cloud wins (newer data)
 * 3. Local updatedAt > Cloud updatedAt → Local wins (local edits)
 * 4. Same updatedAt → Cloud wins (default to source of truth)
 *
 * @param cloudTx - Transaction from cloud (DynamoDB)
 * @param localTx - Transaction from local (SQLite)
 * @returns Resolved transaction to save
 */
function resolveConflict(cloudTx: Transaction, localTx: Transaction): Transaction {
  // Rule 1: Local confirmed takes priority over unconfirmed cloud
  if (localTx.confirmedAt && !cloudTx.confirmedAt) {
    logger.debug('sync_conflict_resolved', {
      txId: localTx.id,
      strategy: 'local_confirmed_wins',
      localConfirmedAt: localTx.confirmedAt,
      cloudConfirmedAt: cloudTx.confirmedAt,
    });
    return localTx;
  }

  // Rule 2-4: Compare updatedAt timestamps
  const cloudTime = new Date(cloudTx.updatedAt).getTime();
  const localTime = new Date(localTx.updatedAt).getTime();

  if (cloudTime > localTime) {
    logger.debug('sync_conflict_resolved', {
      txId: cloudTx.id,
      strategy: 'cloud_newer',
      cloudUpdatedAt: cloudTx.updatedAt,
      localUpdatedAt: localTx.updatedAt,
    });
    return cloudTx;
  }

  if (localTime > cloudTime) {
    logger.debug('sync_conflict_resolved', {
      txId: localTx.id,
      strategy: 'local_newer',
      cloudUpdatedAt: cloudTx.updatedAt,
      localUpdatedAt: localTx.updatedAt,
    });
    return localTx;
  }

  // Same updatedAt → default to cloud as source of truth
  logger.debug('sync_conflict_resolved', {
    txId: cloudTx.id,
    strategy: 'cloud_default',
    updatedAt: cloudTx.updatedAt,
  });
  return cloudTx;
}

/**
 * Sync transactions from cloud to local
 * Pillar Q: Idempotent - safe to call multiple times
 * Pillar R: Observability - logs sync progress
 *
 * @param userId - User ID to sync transactions for
 * @param startDate - Optional start date filter (YYYY-MM-DD)
 * @param endDate - Optional end date filter (YYYY-MM-DD)
 * @returns Sync result summary
 */
export async function pullTransactions(
  userId: UserId,
  startDate?: string,
  endDate?: string
): Promise<PullSyncResult> {
  logger.info('transaction_sync_started', { userId, startDate, endDate });

  const errors: string[] = [];
  let synced = 0;
  let conflicts = 0;

  try {
    // Step 1: Fetch from cloud
    logger.debug('transaction_sync_phase', { phase: 'fetch_cloud', userId });
    const cloudTransactions = await fetchFromCloud(userId, startDate, endDate);
    logger.info('transaction_sync_cloud_fetched', { userId, count: cloudTransactions.length });

    // Step 2: Fetch from local
    logger.debug('transaction_sync_phase', { phase: 'fetch_local', userId });
    const localTransactions = await fetchFromLocal(userId, { startDate, endDate });
    logger.info('transaction_sync_local_fetched', { userId, count: localTransactions.length });

    // Create lookup map for local transactions (by ID)
    const localMap = new Map<string, Transaction>();
    for (const tx of localTransactions) {
      localMap.set(tx.id, tx);
    }

    // Step 3: Merge cloud transactions into local
    logger.debug('transaction_sync_phase', { phase: 'merge', cloudCount: cloudTransactions.length });

    for (const cloudTx of cloudTransactions) {
      try {
        const localTx = localMap.get(cloudTx.id);

        if (!localTx) {
          // New transaction from cloud - insert
          await upsertTransaction(cloudTx);
          synced++;
          logger.debug('transaction_sync_inserted', { txId: cloudTx.id });
        } else {
          // Conflict - resolve and update
          const resolved = resolveConflict(cloudTx, localTx);

          // Only upsert if cloud won (resolved is cloudTx, not localTx)
          if (resolved === cloudTx) {
            await upsertTransaction(resolved);
            synced++;
            conflicts++;
            logger.debug('transaction_sync_updated', { txId: resolved.id, source: 'cloud' });
          } else {
            // Local won - no update needed
            conflicts++;
            logger.debug('transaction_sync_skipped', { txId: resolved.id, source: 'local' });
          }
        }
      } catch (error) {
        const errorMsg = `Failed to sync transaction ${cloudTx.id}: ${String(error)}`;
        errors.push(errorMsg);
        logger.error('transaction_sync_error', {
          txId: cloudTx.id,
          error: String(error),
        });
      }
    }

    // Step 4: Sync images for synced transactions
    // This checks local images first, only downloads from S3 if needed
    const traceId = makeTraceId(`sync-${Date.now()}`);
    const imageSyncResult = await syncImagesForTransactions(cloudTransactions, userId, traceId);

    const result: PullSyncResult = {
      synced,
      conflicts,
      errors,
      cloudCount: cloudTransactions.length,
      localCount: localTransactions.length,
      images: imageSyncResult,
    };

    logger.info('transaction_sync_complete', { ...result });
    return result;
  } catch (error) {
    logger.error('transaction_sync_failed', {
      userId,
      error: String(error),
    });

    return {
      synced: 0,
      conflicts: 0,
      errors: [String(error)],
      cloudCount: 0,
      localCount: 0,
    };
  }
}
