// Pillar L: Headless - logic without UI
// Pillar D: FSM - no boolean flags
import { useReducer, useCallback, useEffect, useState, useMemo } from 'react';
import type { TransactionId, UserId } from '../../../00_kernel/types';
import type { Transaction, TransactionFilters } from '../../../01_domains/transaction';
import { filterTransactions } from '../../../01_domains/transaction';
import { on } from '../../../00_kernel/eventBus';
import { subscribeMockMode } from '../../../00_kernel/config/mock';
import {
  loadTransactions,
  countTotalTransactions,
  saveNewTransaction,
  removeTransaction,
  confirmExistingTransaction,
  updateExistingTransaction,
  type FetchTransactionsOptions,
  type UpdateTransactionFields,
} from '../services/transactionService';

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
  | { type: 'UPDATE_SUCCESS'; id: TransactionId; fields: UpdateTransactionFields }
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
          t.id === action.id ? { ...t, status: 'confirmed', updatedAt: new Date().toISOString() } : t
        ),
      };

    case 'UPDATE_SUCCESS':
      if (state.status !== 'success' && state.status !== 'error') return state;
      return {
        status: 'success',
        transactions: state.transactions.map(t =>
          t.id === action.id ? { ...t, ...action.fields, updatedAt: new Date().toISOString() } : t
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
    if (!userId) return null;
    dispatch({ type: 'LOAD' });
    try {
      const transactions = await loadTransactions(userId, options);
      dispatch({ type: 'LOAD_SUCCESS', transactions });

      // Also fetch total count for pagination
      if (options.limit !== undefined) {
        const count = await countTotalTransactions(userId, {
          startDate: options.startDate,
          endDate: options.endDate,
        });
        setTotalCount(count);
      }

      return transactions;
    } catch (e) {
      dispatch({ type: 'ERROR', error: String(e) });
      return null;
    }
  }, [userId]);

  const save = useCallback(async (transaction: Transaction) => {
    dispatch({ type: 'SAVE_START' });
    try {
      await saveNewTransaction(transaction);
      dispatch({ type: 'SAVE_SUCCESS', transaction });
    } catch (e) {
      dispatch({ type: 'ERROR', error: String(e) });
    }
  }, []);

  const remove = useCallback(async (id: TransactionId) => {
    if (!userId) return;
    try {
      await removeTransaction(id, userId);
      dispatch({ type: 'DELETE_SUCCESS', id });
    } catch (e) {
      dispatch({ type: 'ERROR', error: String(e) });
    }
  }, [userId]);

  const confirm = useCallback(async (id: TransactionId) => {
    if (!userId) return;
    try {
      await confirmExistingTransaction(id, userId);
      dispatch({ type: 'CONFIRM_SUCCESS', id });
    } catch (e) {
      dispatch({ type: 'ERROR', error: String(e) });
    }
  }, [userId]);

  const update = useCallback(async (id: TransactionId, fields: UpdateTransactionFields) => {
    if (!userId) return;
    try {
      await updateExistingTransaction(id, fields, userId);
      dispatch({ type: 'UPDATE_SUCCESS', id, fields });
    } catch (e) {
      dispatch({ type: 'ERROR', error: String(e) });
    }
  }, [userId]);

  // Auto-load on mount
  useEffect(() => {
    if (userId) {
      load();
    }
  }, [userId, load]);

  // Listen for data refresh events (e.g., after seeding, image processing, etc.)
  useEffect(() => {
    const unsubscribe = on('data:refresh', async (event: any) => {
      if (userId) {
        // For image_processed events, Lambda runs async after S3 upload
        // Poll with exponential backoff until transaction appears in DynamoDB (max 30s)
        if (event?.source === 'image_processed') {
          let pollCount = 0;
          const maxPolls = 30;  // Max 30 seconds of polling
          const pollInterval = 1000;  // Start with 1 second, increase exponentially

          // Capture initial count from current state before polling
          const initialCount = state.status === 'success' || state.status === 'error'
            ? state.transactions.length
            : 0;

          while (pollCount < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, pollInterval * (1 + pollCount * 0.2)));
            pollCount++;

            try {
              // Load returns the fetched transactions
              const loadedTransactions = await load();

              // If we got new data, stop polling
              if (loadedTransactions && loadedTransactions.length > initialCount) {
                break;  // Transaction appeared, stop polling
              }
            } catch (e) {
              // Continue polling on error
            }
          }
        } else {
          // For other refresh events (seed, etc), load immediately
          load();
        }
      }
    });
    return unsubscribe;
  }, [userId, load]);

  // Listen for mock mode changes and reload data when switching databases
  useEffect(() => {
    const unsubscribe = subscribeMockMode(() => {
      if (userId) {
        load(); // Reload from the correct database (production or mock)
      }
    });
    return unsubscribe;
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
    ? state.transactions.filter(t => t.status !== 'confirmed').length
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
    update,
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
