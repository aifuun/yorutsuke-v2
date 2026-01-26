// Transaction Pull Service
// Pulls transactions from cloud to local (Cloud → Local)
// Orchestrates cloud-to-local synchronization with conflict resolution
// Pillar Q: Idempotent - safe to retry
// Pillar N: Context - TraceId for observability

import type { UserId, TraceId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import {
  fetchTransactionsFromCloud,
  fetchLocalTransactions,
  upsertLocalTransaction,
} from '../adapters/transactionSyncAdapter';
import { logger } from '../../../00_kernel/telemetry/logger';
import { emit } from '../../../00_kernel/eventBus';
import { syncImagesForTransactions, type ImageSyncResult } from './imageSyncService';
import { syncStore } from '../stores/syncStore';

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
 * 0. Local deleted → Local wins (user explicitly deleted, must sync to cloud)
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
  // Rule 0: Local deleted takes priority (user explicitly deleted)
  // This prevents deleted transactions from being resurrected by cloud sync
  if (localTx.status === 'deleted') {
    logger.debug('sync_conflict_resolved', {
      txId: localTx.id,
      strategy: 'local_deleted_wins',
      localStatus: localTx.status,
      cloudStatus: cloudTx.status,
    });
    return localTx;
  }

  // Rule 1: Local confirmed takes priority over unconfirmed cloud
  if (localTx.status === 'confirmed' && cloudTx.status !== 'confirmed') {
    logger.debug('sync_conflict_resolved', {
      txId: localTx.id,
      strategy: 'local_confirmed_wins',
      localStatus: localTx.status,
      cloudStatus: cloudTx.status,
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
 * Pillar N: Context - TraceId for log correlation
 *
 * @param userId - User ID to sync transactions for
 * @param traceId - Trace ID for observability
 * @param startDate - Optional start date filter (YYYY-MM-DD)
 * @param endDate - Optional end date filter (YYYY-MM-DD)
 * @returns Sync result summary
 */
export async function pullTransactions(
  userId: UserId,
  traceId: TraceId,
  startDate?: string,
  endDate?: string
): Promise<PullSyncResult> {
  logger.info('transaction_sync_started', { userId, startDate, endDate, traceId });

  const errors: string[] = [];
  let synced = 0;
  let conflicts = 0;

  try {
    // Step 1: Fetch from cloud
    logger.debug('transaction_sync_phase', { phase: 'fetch_cloud', userId, traceId });

    // 🔍 INVESTIGATION: Log fetch parameters
    logger.info('transaction_sync_fetch_params', {
      userId,
      startDate: startDate || 'undefined (no filter)',
      endDate: endDate || 'undefined (no filter)',
      note: 'Fetching from cloud with these date filters',
      traceId,
    });

    const cloudTransactions = await fetchTransactionsFromCloud(userId, startDate, endDate);

    // 🔍 INVESTIGATION: Log fetch result details
    logger.info('transaction_sync_cloud_fetched', {
      userId,
      count: cloudTransactions.length,
      firstTxDate: cloudTransactions.length > 0 ? cloudTransactions[0].date : null,
      lastTxDate: cloudTransactions.length > 0 ? cloudTransactions[cloudTransactions.length - 1].date : null,
      traceId,
    });

    // Step 2: Fetch from local (including deleted for conflict resolution)
    logger.debug('transaction_sync_phase', { phase: 'fetch_local', userId, traceId });
    const localTransactions = await fetchLocalTransactions(userId, { startDate, endDate, includeDeleted: true });
    logger.info('transaction_sync_local_fetched', { userId, count: localTransactions.length, traceId });

    // Create lookup map for local transactions (by ID)
    const localMap = new Map<string, Transaction>();
    for (const tx of localTransactions) {
      localMap.set(tx.id, tx);
    }

    // Step 3: Merge cloud transactions into local
    logger.debug('transaction_sync_phase', { phase: 'merge', cloudCount: cloudTransactions.length, traceId });

    // 🔍 INVESTIGATION: Log first cloud transaction for debugging
    if (cloudTransactions.length > 0) {
      const firstTx = cloudTransactions[0];
      logger.info('transaction_sync_cloud_sample', {
        txId: firstTx.id,
        date: firstTx.date,
        amount: firstTx.amount,
        status: firstTx.status,
        merchant: firstTx.merchant,
        isDirty: firstTx.isDirty,
        traceId,
      });
    }

    for (const cloudTx of cloudTransactions) {
      try {
        const localTx = localMap.get(cloudTx.id);

        if (!localTx) {
          // New transaction from cloud - insert
          // 🔍 INVESTIGATION: Log new transaction details
          logger.info('transaction_sync_new_found', {
            txId: cloudTx.id,
            date: cloudTx.date,
            amount: cloudTx.amount,
            status: cloudTx.status,
            traceId,
          });

          await upsertLocalTransaction(cloudTx);
          synced++;
          logger.debug('transaction_sync_inserted', { txId: cloudTx.id, traceId });
        } else {
          // Conflict - resolve and update
          const resolved = resolveConflict(cloudTx, localTx);

          // 🔍 INVESTIGATION: Log conflict resolution
          logger.info('transaction_sync_conflict', {
            txId: cloudTx.id,
            cloudUpdated: cloudTx.updatedAt,
            localUpdated: localTx.updatedAt,
            localDirty: localTx.isDirty,
            winner: resolved === cloudTx ? 'cloud' : 'local',
            traceId,
          });

          // Only upsert if cloud won (resolved is cloudTx, not localTx)
          if (resolved === cloudTx) {
            await upsertLocalTransaction(resolved);
            synced++;
            conflicts++;
            logger.debug('transaction_sync_updated', { txId: resolved.id, source: 'cloud', traceId });
          } else {
            // Local won - no update needed
            conflicts++;
            logger.debug('transaction_sync_skipped', { txId: resolved.id, source: 'local', traceId });
          }
        }
      } catch (error) {
        const errorMsg = `Failed to sync transaction ${cloudTx.id}: ${String(error)}`;
        errors.push(errorMsg);
        logger.error('transaction_sync_error', {
          txId: cloudTx.id,
          error: String(error),
          traceId,
        });
      }
    }

    // Step 4: Sync images for synced transactions
    // This checks local images first, only downloads from S3 if needed
    const imageSyncResult = await syncImagesForTransactions(cloudTransactions, userId, traceId);

    // Step 5: Emit events for transactions with images (Issue #157)
    // This allows Capture page to update real-time when cloud processing completes
    const transactionsWithImages = cloudTransactions.filter(tx => tx.imageId);
    logger.debug('transaction_sync_emit_events', {
      totalSynced: synced,
      withImages: transactionsWithImages.length,
      traceId,
    });

    for (const tx of transactionsWithImages) {
      // Emit event for Capture page to update transaction info
      emit('transaction:confirmed', { id: tx.id });

      logger.debug('transaction_sync_event_emitted', {
        txId: tx.id,
        imageId: tx.imageId,
        traceId,
      });
    }

    const result: PullSyncResult = {
      synced,
      conflicts,
      errors,
      cloudCount: cloudTransactions.length,
      localCount: localTransactions.length,
      images: imageSyncResult,
    };

    // Step 6: Update lastSyncedAt on successful pull (IO-first pattern)
    // Update happens AFTER all data operations complete
    const timestamp = new Date().toISOString();
    syncStore.getState().setLastSyncedAt(timestamp);

    logger.info('transaction_sync_complete', { ...result, traceId });
    return result;
  } catch (error) {
    logger.error('transaction_sync_failed', {
      userId,
      error: String(error),
      traceId,
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
