// Transaction Store - Zustand vanilla store for transaction management
// Pillar D: FSM - no boolean flags
// Pillar J: Locality - state near usage

import { createStore } from 'zustand/vanilla';
import type { TransactionId } from '../../../00_kernel/types';
import type { Transaction, TransactionFilters, TransactionType, TransactionCategory } from '../../../01_domains/transaction';

// FSM State (union type for status)
export type TransactionUIStatus = 'idle' | 'loading' | 'saving' | 'error';

export interface TransactionState {
  status: TransactionUIStatus;
  transactions: Transaction[];
  error: string | null;
  totalCount: number;
  filters: TransactionFilters;
}

export interface TransactionActions {
  // State setters
  setStatus: (status: TransactionUIStatus) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setTotalCount: (count: number) => void;
  setFilters: (filters: TransactionFilters) => void;
  setError: (error: string | null) => void;

  // Mutations - queue operations
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: TransactionId, fields: Partial<Transaction>) => void;
  removeTransaction: (id: TransactionId) => void;
  confirmTransaction: (id: TransactionId) => void;

  // Getters - for service layer to read state
  getTransactions: () => Transaction[];
  getStatus: () => TransactionUIStatus;
  getTotalCount: () => number;
  getFilters: () => TransactionFilters;
  getError: () => string | null;
}

export type TransactionStore = TransactionState & TransactionActions;

// Helper: update transaction in queue
function updateInQueue(
  queue: Transaction[],
  id: TransactionId,
  fields: Partial<Transaction>
): Transaction[] {
  return queue.map((tx) =>
    tx.id === id ? { ...tx, ...fields, updatedAt: new Date().toISOString() } : tx
  );
}

export const transactionStore = createStore<TransactionStore>((set, get) => ({
  // Initial state
  status: 'idle',
  transactions: [],
  error: null,
  totalCount: 0,
  filters: {},

  // State setters
  setStatus: (status) => set({ status }),

  setTransactions: (transactions) => set({ transactions }),

  setTotalCount: (count) => set({ totalCount: count }),

  setFilters: (filters) => set({ filters }),

  setError: (error) => set({ error }),

  // Mutations
  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [...state.transactions, transaction],
      error: null,
    })),

  updateTransaction: (id, fields) =>
    set((state) => ({
      transactions: updateInQueue(state.transactions, id, fields),
      error: null,
    })),

  removeTransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.filter((tx) => tx.id !== id),
      error: null,
    })),

  confirmTransaction: (id) =>
    set((state) => ({
      transactions: updateInQueue(state.transactions, id, {
        status: 'confirmed',
      }),
      error: null,
    })),

  // Getters (for service layer)
  getTransactions: () => get().transactions,

  getStatus: () => get().status,

  getTotalCount: () => get().totalCount,

  getFilters: () => get().filters,

  getError: () => get().error,
}));
