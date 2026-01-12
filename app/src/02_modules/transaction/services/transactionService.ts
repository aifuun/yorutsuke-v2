// Transaction Service
// Pillar L: Pure TS functions, no React dependencies
// Wraps adapters to enforce 4-layer architecture

import type { TransactionId, UserId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import {
  fetchTransactions,
  countTransactions,
  saveTransaction,
  deleteTransaction,
  confirmTransaction,
  updateTransaction,
  type FetchTransactionsOptions,
  type UpdateTransactionFields,
} from '../adapters';
import { pushTransactions } from '../../sync';
import { logger } from '../../../00_kernel/telemetry/logger';

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
 * Delete a transaction (soft delete via status)
 * Issue #86: Triggers cloud sync after local delete
 */
export async function removeTransaction(id: TransactionId, userId: UserId): Promise<void> {
  // IO-First Pattern: Complete DB operation first
  await deleteTransaction(id);

  // Trigger cloud sync (async, non-blocking)
  triggerSync(userId, 'delete');
}

/**
 * Confirm a transaction
 * Issue #86: Triggers cloud sync after local confirm
 */
export async function confirmExistingTransaction(id: TransactionId, userId: UserId): Promise<void> {
  // IO-First Pattern: Complete DB operation first
  await confirmTransaction(id);

  // Trigger cloud sync (async, non-blocking)
  triggerSync(userId, 'confirm');
}

/**
 * Update transaction fields (Issue #116: Transaction editing)
 * Issue #86: Triggers cloud sync after local update
 * Supports partial updates: amount, category, description, merchant, date
 */
export async function updateExistingTransaction(
  id: TransactionId,
  fields: UpdateTransactionFields,
  userId: UserId
): Promise<void> {
  // IO-First Pattern: Complete DB operation first
  await updateTransaction(id, fields);

  // Trigger cloud sync (async, non-blocking)
  triggerSync(userId, 'update');
}

/**
 * Trigger cloud sync (async, non-blocking)
 * Catches errors to avoid blocking user operations
 * @private
 */
function triggerSync(userId: UserId, operation: string): void {
  pushTransactions(userId).catch((error) => {
    logger.error('sync_trigger_failed', {
      module: 'transaction-service',
      operation,
      error: String(error),
    });
    // Don't throw - sync failure shouldn't block user operations
  });
}
