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
  type FetchTransactionsOptions,
} from '../adapters';

// Re-export types for views/hooks (Pillar I: Firewall)
export type { FetchTransactionsOptions };

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
 */
export async function removeTransaction(id: TransactionId): Promise<void> {
  return deleteTransaction(id);
}

/**
 * Confirm a transaction
 */
export async function confirmExistingTransaction(id: TransactionId): Promise<void> {
  return confirmTransaction(id);
}
