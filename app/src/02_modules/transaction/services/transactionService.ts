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
import { emit } from '../../../00_kernel/eventBus';

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
 * Issue #86: Emits event for auto-sync (debounced)
 */
export async function removeTransaction(id: TransactionId, _userId: UserId): Promise<void> {
  // IO-First Pattern: Complete DB operation first
  await deleteTransaction(id);

  // Emit event for AutoSyncService (debounced sync)
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
