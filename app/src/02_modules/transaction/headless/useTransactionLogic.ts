// Pillar L: Headless - logic without UI
// Pillar D: FSM - no boolean flags
import { useReducer, useCallback, useEffect, useState, useMemo } from 'react';
import type { TransactionId, UserId } from '../../../00_kernel/types';
import type { Transaction, TransactionFilters } from '../../../01_domains/transaction';
import { filterTransactions } from '../../../01_domains/transaction';
import {
  fetchTransactions,
  countTransactions,
  saveTransaction,
  deleteTransaction,
  confirmTransaction,
  type FetchTransactionsOptions,
} from '../adapters/transactionDb';

const DEFAULT_FILTERS: TransactionFilters = {};

// FSM State
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; transactions: Transaction[] }
  | { status: 'saving'; transactions: Transaction[] }
  | { status: 'error'; transactions: Transaction[]; error: string };

type Action =
  | { type: 'LOAD' }
  | { type: 'LOAD_SUCCESS'; transactions: Transaction[] }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; transaction: Transaction }
  | { type: 'DELETE_SUCCESS'; id: TransactionId }
  | { type: 'CONFIRM_SUCCESS'; id: TransactionId }
  | { type: 'ERROR'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD':
      return { status: 'loading' };

    case 'LOAD_SUCCESS':
      return { status: 'success', transactions: action.transactions };

    case 'SAVE_START':
      return state.status === 'success' || state.status === 'error'
        ? { status: 'saving', transactions: state.transactions }
        : state;

    case 'SAVE_SUCCESS':
      if (state.status !== 'saving') return state;
      const existing = state.transactions.findIndex(t => t.id === action.transaction.id);
      const updated = existing >= 0
        ? state.transactions.map(t => t.id === action.transaction.id ? action.transaction : t)
        : [...state.transactions, action.transaction];
      return { status: 'success', transactions: updated };

    case 'DELETE_SUCCESS':
      if (state.status !== 'success' && state.status !== 'error') return state;
      return {
        status: 'success',
        transactions: state.transactions.filter(t => t.id !== action.id),
      };

    case 'CONFIRM_SUCCESS':
      if (state.status !== 'success' && state.status !== 'error') return state;
      return {
        status: 'success',
        transactions: state.transactions.map(t =>
          t.id === action.id ? { ...t, confirmedAt: new Date().toISOString() } : t
        ),
      };

    case 'ERROR':
      return state.status === 'success' || state.status === 'saving'
        ? { status: 'error', transactions: state.transactions, error: action.error }
        : { status: 'error', transactions: [], error: action.error };

    default:
      return state;
  }
}

export function useTransactionLogic(userId: UserId | null) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [totalCount, setTotalCount] = useState<number>(0);

  const load = useCallback(async (options: FetchTransactionsOptions = {}) => {
    if (!userId) return;
    dispatch({ type: 'LOAD' });
    try {
      const transactions = await fetchTransactions(userId, options);
      dispatch({ type: 'LOAD_SUCCESS', transactions });

      // Also fetch total count for pagination
      if (options.limit !== undefined) {
        const count = await countTransactions(userId, {
          startDate: options.startDate,
          endDate: options.endDate,
        });
        setTotalCount(count);
      }
    } catch (e) {
      dispatch({ type: 'ERROR', error: String(e) });
    }
  }, [userId]);

  const save = useCallback(async (transaction: Transaction) => {
    dispatch({ type: 'SAVE_START' });
    try {
      await saveTransaction(transaction);
      dispatch({ type: 'SAVE_SUCCESS', transaction });
    } catch (e) {
      dispatch({ type: 'ERROR', error: String(e) });
    }
  }, []);

  const remove = useCallback(async (id: TransactionId) => {
    try {
      await deleteTransaction(id);
      dispatch({ type: 'DELETE_SUCCESS', id });
    } catch (e) {
      dispatch({ type: 'ERROR', error: String(e) });
    }
  }, []);

  const confirm = useCallback(async (id: TransactionId) => {
    try {
      await confirmTransaction(id);
      dispatch({ type: 'CONFIRM_SUCCESS', id });
    } catch (e) {
      dispatch({ type: 'ERROR', error: String(e) });
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (userId) {
      load();
    }
  }, [userId, load]);

  // Computed: all transactions
  const transactions = state.status === 'success' || state.status === 'saving' || state.status === 'error'
    ? state.transactions
    : [];

  // Computed: filtered transactions (using pure domain function)
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters]
  );

  const unconfirmedCount = (state.status === 'success' || state.status === 'error')
    ? state.transactions.filter(t => !t.confirmedAt).length
    : 0;

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    state,
    load,
    save,
    remove,
    confirm,
    // Filter management
    filters,
    setFilters,
    clearFilters,
    // Computed
    transactions,
    filteredTransactions,
    unconfirmedCount,
    totalCount,
  };
}
