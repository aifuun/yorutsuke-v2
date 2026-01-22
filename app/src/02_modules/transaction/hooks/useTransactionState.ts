// React hooks to subscribe to transaction store
// Pillar L: Bridge between Service layer and React components
// CRITICAL: Use primitive selectors only to avoid infinite loops (ADR-012)

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { transactionService } from '../services/transactionService';
import { filterTransactions } from '../../../01_domains/transaction';
import type { TransactionUIStatus } from '../stores/transactionStore';
import type { Transaction, TransactionFilters } from '../../../01_domains/transaction';
import type { FetchTransactionsOptions } from '../adapters';

/**
 * Subscribe to complete transaction state
 * Returns all state at once (primitive references preserved)
 */
export function useTransactionStore() {
  return useStore(transactionService.store);
}

/**
 * Subscribe to transaction loading status
 * Status: 'idle' | 'loading' | 'saving' | 'error'
 */
export function useTransactionStatus(): TransactionUIStatus {
  return useStore(transactionService.store, (s) => s.status);
}

/**
 * Subscribe to transactions array
 */
export function useTransactions(): Transaction[] {
  return useStore(transactionService.store, (s) => s.transactions);
}

/**
 * Subscribe to total transaction count (for pagination)
 */
export function useTransactionCount(): number {
  return useStore(transactionService.store, (s) => s.totalCount);
}

/**
 * Subscribe to error message
 * Returns null if no error
 */
export function useTransactionError(): string | null {
  return useStore(transactionService.store, (s) => s.error);
}

/**
 * Subscribe to current filters
 */
export function useTransactionFilters(): TransactionFilters {
  return useStore(transactionService.store, (s) => s.filters);
}

/**
 * Computed hook: Filter and sort transactions based on current filters
 * Memoized to avoid unnecessary recalculations
 */
export function useFilteredTransactions(): Transaction[] {
  const transactions = useStore(transactionService.store, (s) => s.transactions);
  const filters = useStore(transactionService.store, (s) => s.filters);

  return useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
}

/**
 * Hook to get access to service methods for components
 * Provides: confirm, remove, update, loadMore, etc.
 * NOTE: Wrapped in useMemo to provide stable references
 */
export function useTransactionActions() {
  return useMemo(() => ({
    confirm: (id: Transaction['id']) => transactionService.confirmTransaction(id),
    remove: (id: Transaction['id']) => transactionService.removeTransaction(id),
    update: (id: Transaction['id'], fields: Parameters<typeof transactionService.updateTransaction>[1]) =>
      transactionService.updateTransaction(id, fields),
    loadTransactions: (options?: Parameters<typeof transactionService.loadTransactions>[0]) =>
      transactionService.loadTransactions(options),
    setUser: (userId: Parameters<typeof transactionService.setUser>[0], options?: FetchTransactionsOptions) =>
      transactionService.setUser(userId, options),
  }), []);
}

/**
 * Hook for loading state indicator
 * Useful for spinners, disabled buttons during operations
 */
export function useTransactionLoading(): boolean {
  return useStore(transactionService.store, (s) => s.status === 'loading' || s.status === 'saving');
}

/**
 * Hook for error display
 * Combines status + error message
 */
export function useTransactionErrorState(): { hasError: boolean; message: string | null } {
  const status = useStore(transactionService.store, (s) => s.status);
  const error = useStore(transactionService.store, (s) => s.error);

  return {
    hasError: status === 'error',
    message: error,
  };
}
