// Transaction Service
// Pillar L: Pure TS functions, no React dependencies
// Wraps adapters to enforce 4-layer architecture

import type { TransactionId, UserId } from '../../../00_kernel/types';
import { createTraceId, ImageId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import {
  fetchTransactions,
  countTransactions,
  saveTransaction,
  deleteTransaction,
  confirmTransaction,
  updateTransaction,
  getTransactionById,
  type FetchTransactionsOptions,
  type UpdateTransactionFields,
} from '../adapters';
import { emit } from '../../../00_kernel/eventBus';
import { fileService } from '../../capture';

// Re-export types for views/hooks (Pillar I: Firewall)
export type { FetchTransactionsOptions, UpdateTransactionFields };

/**
 * Load transactions for a user with optional filters
 */
export async function loadTransactions(
  userId: UserId,
  options: FetchTransactionsOptions = {}
): Promise<Transaction[]> {
  return fetchTransactions(userId, options);
}

/**
 * Count total transactions for a user
 */
export async function countTotalTransactions(
  userId: UserId,
  options: Omit<FetchTransactionsOptions, 'limit' | 'offset'> = {}
): Promise<number> {
  return countTransactions(userId, options);
}

/**
 * Save a new or updated transaction
 */
export async function saveNewTransaction(transaction: Transaction): Promise<void> {
  return saveTransaction(transaction);
}

/**
 * Delete a transaction and its associated image
 * Issue #86: Emits event for auto-sync (debounced)
 *
 * Deletes:
 * - Transaction (soft delete in DB, synced to cloud)
 * - Image from local imageDb
 * - Image file from local filesystem
 * - Image from captureStore queue
 * - S3 image (via cloud sync when status='deleted')
 */
export async function removeTransaction(id: TransactionId, _userId: UserId): Promise<void> {
  const traceId = createTraceId();

  // 1. Get transaction to find associated imageId
  const transaction = await getTransactionById(id);

  // 2. Delete associated image (local DB, file, queue)
  if (transaction?.imageId) {
    await fileService.deleteImageComplete(ImageId(transaction.imageId), traceId);
  }

  // 3. Soft delete transaction (marks status='deleted', dirty_sync=1)
  await deleteTransaction(id);

  // 4. Emit event for AutoSyncService (debounced sync)
  // This will sync the deleted status to cloud, which triggers S3 image deletion
  emitSyncEvent(id, 'deleted');
}

/**
 * Confirm a transaction
 * Issue #86: Emits event for auto-sync (debounced)
 */
export async function confirmExistingTransaction(id: TransactionId, _userId: UserId): Promise<void> {
  // IO-First Pattern: Complete DB operation first
  await confirmTransaction(id);

  // Emit event for AutoSyncService (debounced sync)
  emitSyncEvent(id, 'confirmed');
}

/**
 * Update transaction fields (Issue #116: Transaction editing)
 * Issue #86: Emits event for auto-sync (debounced)
 * Supports partial updates: amount, category, description, merchant, date
 */
export async function updateExistingTransaction(
  id: TransactionId,
  fields: UpdateTransactionFields,
  _userId: UserId
): Promise<void> {
  // IO-First Pattern: Complete DB operation first
  await updateTransaction(id, fields);

  // Emit event for AutoSyncService (debounced sync)
  emitSyncEvent(id, 'updated');
}

/**
 * Emit event to trigger auto-sync (debounced by AutoSyncService)
 * Issue #86: Uses event-driven pattern for decoupled sync triggering
 * @private
 */
function emitSyncEvent(id: TransactionId, operation: 'confirmed' | 'updated' | 'deleted'): void {
  emit(`transaction:${operation}`, { id });
}
