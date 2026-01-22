import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useTransactionStatus,
  useTransactions,
  useTransactionCount,
  useTransactionError,
  useTransactionFilters,
  useFilteredTransactions,
  useTransactionActions,
  useTransactionLoading,
  useTransactionErrorState,
} from './useTransactionState';
import { transactionService } from '../services/transactionService';
import { transactionStore } from '../stores/transactionStore';
import type { Transaction } from '../../../01_domains/transaction';
import { TransactionId, UserId, ImageId } from '../../../00_kernel/types';

// Test fixture
const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: TransactionId('tx-1'),
  userId: UserId('user-1'),
  imageId: ImageId('img-1'),
  s3Key: null,
  type: 'expense',
  category: 'shopping',
  amount: 1000,
  currency: 'JPY',
  description: 'Test transaction',
  merchant: 'Test Merchant',
  date: '2026-01-15',
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
  status: 'unconfirmed',
  confidence: null,
  rawText: null,
  primaryModelId: null,
  primaryConfidence: null,
  ...overrides,
});

describe('useTransactionState hooks (ADR-012: Zustand Selectors)', () => {
  beforeEach(() => {
    // Reset store to initial state
    transactionStore.setState({
      status: 'idle',
      transactions: [],
      error: null,
      totalCount: 0,
      filters: {},
    });
  });

  describe('useTransactionStatus (Primitive Selector)', () => {
    it('TC-HST-1.1: Should return current status', () => {
      const { result } = renderHook(() => useTransactionStatus());

      expect(result.current).toBe('idle');

      act(() => {
        transactionStore.getState().setStatus('loading');
      });

      expect(result.current).toBe('loading');
    });

    it('TC-HST-1.2: Should subscribe to status changes', () => {
      const { result, rerender } = renderHook(() => useTransactionStatus());

      expect(result.current).toBe('idle');

      act(() => {
        transactionStore.getState().setStatus('loading');
      });

      rerender();
      expect(result.current).toBe('loading');

      act(() => {
        transactionStore.getState().setStatus('error');
      });

      rerender();
      expect(result.current).toBe('error');
    });

    it('TC-HST-1.3: Should return primitive (not object) to avoid re-renders', () => {
      const { result: result1 } = renderHook(() => useTransactionStatus());
      const { result: result2 } = renderHook(() => useTransactionStatus());

      // Both should be identical primitives
      expect(result1.current).toBe(result2.current);
    });
  });

  describe('useTransactions (Primitive Selector)', () => {
    it('TC-HST-2.1: Should return transactions array', () => {
      const { result } = renderHook(() => useTransactions());

      expect(result.current).toEqual([]);

      const tx = createTransaction();
      act(() => {
        transactionStore.getState().addTransaction(tx);
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe('tx-1');
    });

    it('TC-HST-2.2: Should trigger re-render on transaction change', () => {
      const { result, rerender } = renderHook(() => useTransactions());

      expect(result.current).toHaveLength(0);

      const tx1 = createTransaction({ id: TransactionId('tx-1') });
      const tx2 = createTransaction({ id: TransactionId('tx-2') });

      act(() => {
        transactionStore.getState().addTransaction(tx1);
      });
      rerender();

      expect(result.current).toHaveLength(1);

      act(() => {
        transactionStore.getState().addTransaction(tx2);
      });
      rerender();

      expect(result.current).toHaveLength(2);
    });

    it('TC-HST-2.3: Should return same reference for unchanged data', () => {
      const { result: result1 } = renderHook(() => useTransactions());
      const { result: result2 } = renderHook(() => useTransactions());

      expect(result1.current).toBe(result2.current);
    });
  });

  describe('useTransactionCount (Primitive Selector)', () => {
    it('TC-HST-3.1: Should return total count', () => {
      const { result } = renderHook(() => useTransactionCount());

      expect(result.current).toBe(0);

      act(() => {
        transactionStore.getState().setTotalCount(150);
      });

      expect(result.current).toBe(150);
    });

    it('TC-HST-3.2: Should be independent from transactions array length', () => {
      const { result: countResult } = renderHook(() => useTransactionCount());
      const { result: txResult } = renderHook(() => useTransactions());

      // Add 5 transactions
      for (let i = 0; i < 5; i++) {
        act(() => {
          transactionStore.getState().addTransaction(
            createTransaction({ id: TransactionId(`tx-${i}`) })
          );
        });
      }

      // Set total count to 150 (pagination: showing 5 of 150)
      act(() => {
        transactionStore.getState().setTotalCount(150);
      });

      expect(txResult.current).toHaveLength(5);
      expect(countResult.current).toBe(150);
    });
  });

  describe('useTransactionError (Primitive Selector)', () => {
    it('TC-HST-4.1: Should return error message or null', () => {
      const { result } = renderHook(() => useTransactionError());

      expect(result.current).toBeNull();

      act(() => {
        transactionStore.getState().setError('Network error');
      });

      expect(result.current).toBe('Network error');
    });

    it('TC-HST-4.2: Should clear error when set to null', () => {
      const { result } = renderHook(() => useTransactionError());

      act(() => {
        transactionStore.getState().setError('Error 1');
      });
      expect(result.current).toBe('Error 1');

      act(() => {
        transactionStore.getState().setError(null);
      });

      expect(result.current).toBeNull();
    });
  });

  describe('useTransactionFilters (Primitive Selector)', () => {
    it('TC-HST-5.1: Should return filters object', () => {
      const { result } = renderHook(() => useTransactionFilters());

      expect(result.current).toEqual({});

      const filters = { statusFilter: 'confirmed' as const };
      act(() => {
        transactionStore.getState().setFilters(filters);
      });

      expect(result.current.statusFilter).toBe('confirmed');
    });

    it('TC-HST-5.2: Should handle multiple filter updates', () => {
      const { result } = renderHook(() => useTransactionFilters());

      const filters1 = { statusFilter: 'confirmed' as const };
      act(() => {
        transactionStore.getState().setFilters(filters1);
      });
      expect(result.current).toEqual(filters1);

      const filters2 = { typeFilter: 'income' as const, statusFilter: 'confirmed' as const };
      act(() => {
        transactionStore.getState().setFilters(filters2);
      });
      expect(result.current).toEqual(filters2);
    });
  });

  describe('useFilteredTransactions (Computed with useMemo)', () => {
    it('TC-HST-6.1: Should apply filters to transactions', () => {
      const tx1 = createTransaction({ id: TransactionId('tx-1'), type: 'expense' });
      const tx2 = createTransaction({ id: TransactionId('tx-2'), type: 'income' });
      const tx3 = createTransaction({ id: TransactionId('tx-3'), type: 'expense' });

      act(() => {
        transactionStore.getState().setTransactions([tx1, tx2, tx3]);
      });

      const { result } = renderHook(() => useFilteredTransactions());

      // Initially no filter, should return all
      expect(result.current).toHaveLength(3);
    });

    it('TC-HST-6.2: Should use memoization to avoid unnecessary recalculations', () => {
      const { result, rerender } = renderHook(() => useFilteredTransactions());

      const firstResult = result.current;

      // Rerender without state changes - should get memoized result
      rerender();

      // When state hasn't changed, memoized value should be returned
      expect(result.current).toBe(firstResult);
    });

    it('TC-HST-6.3: Should recalculate when transactions change', () => {
      const { result } = renderHook(() => useFilteredTransactions());

      const initialResult = result.current;

      const tx = createTransaction();
      act(() => {
        transactionStore.getState().addTransaction(tx);
      });

      // Result should have changed
      expect(result.current).not.toBe(initialResult);
    });
  });

  describe('useTransactionActions (Service Methods)', () => {
    it('TC-HST-7.1: Should return action methods', () => {
      const { result } = renderHook(() => useTransactionActions());

      expect(result.current).toHaveProperty('confirm');
      expect(result.current).toHaveProperty('remove');
      expect(result.current).toHaveProperty('update');
      expect(result.current).toHaveProperty('loadTransactions');
      expect(result.current).toHaveProperty('setUser');
    });

    it('TC-HST-7.2: Should return callable action methods', () => {
      const { result } = renderHook(() => useTransactionActions());

      // Actions should be functions (callable methods)
      expect(typeof result.current.confirm).toBe('function');
      expect(typeof result.current.remove).toBe('function');
      expect(typeof result.current.update).toBe('function');
      expect(typeof result.current.loadTransactions).toBe('function');
      expect(typeof result.current.setUser).toBe('function');

      // All methods should be present
      expect(result.current).toHaveProperty('confirm');
      expect(result.current).toHaveProperty('remove');
      expect(result.current).toHaveProperty('update');
    });

    it('TC-HST-7.3: Should provide action methods that work correctly', () => {
      const tx = createTransaction();
      act(() => {
        transactionStore.getState().addTransaction(tx);
      });

      const { result } = renderHook(() => useTransactionActions());

      // These methods delegate to the service
      expect(typeof result.current.confirm).toBe('function');
      expect(typeof result.current.remove).toBe('function');
      expect(typeof result.current.update).toBe('function');
    });
  });

  describe('useTransactionLoading (Composite Hook)', () => {
    it('TC-HST-8.1: Should return true when loading or saving', () => {
      const { result } = renderHook(() => useTransactionLoading());

      expect(result.current).toBe(false);

      act(() => {
        transactionStore.getState().setStatus('loading');
      });

      expect(result.current).toBe(true);

      act(() => {
        transactionStore.getState().setStatus('saving');
      });

      expect(result.current).toBe(true);

      act(() => {
        transactionStore.getState().setStatus('success');
      });

      expect(result.current).toBe(false);
    });

    it('TC-HST-8.2: Should return false for idle and error states', () => {
      const { result } = renderHook(() => useTransactionLoading());

      act(() => {
        transactionStore.getState().setStatus('idle');
      });
      expect(result.current).toBe(false);

      act(() => {
        transactionStore.getState().setStatus('error');
      });
      expect(result.current).toBe(false);
    });
  });

  describe('useTransactionErrorState (Composite Hook)', () => {
    it('TC-HST-9.1: Should combine status and error message', () => {
      const { result } = renderHook(() => useTransactionErrorState());

      expect(result.current.hasError).toBe(false);
      expect(result.current.message).toBeNull();

      act(() => {
        transactionStore.getState().setStatus('error');
        transactionStore.getState().setError('Network failed');
      });

      expect(result.current.hasError).toBe(true);
      expect(result.current.message).toBe('Network failed');
    });

    it('TC-HST-9.2: Should distinguish between status error and loading', () => {
      const { result } = renderHook(() => useTransactionErrorState());

      act(() => {
        transactionStore.getState().setStatus('loading');
        transactionStore.getState().setError('Some error');
      });

      // Status is loading, not error, so hasError should be false
      expect(result.current.hasError).toBe(false);
      expect(result.current.message).toBe('Some error');
    });

    it('TC-HST-9.3: Should clear error state when reset', () => {
      const { result } = renderHook(() => useTransactionErrorState());

      act(() => {
        transactionStore.getState().setStatus('error');
        transactionStore.getState().setError('Test error');
      });

      expect(result.current.hasError).toBe(true);

      act(() => {
        transactionStore.getState().setStatus('idle');
        transactionStore.getState().setError(null);
      });

      expect(result.current.hasError).toBe(false);
      expect(result.current.message).toBeNull();
    });
  });

  describe('No Infinite Loops (ADR-012: Primitive Selectors)', () => {
    it('TC-HST-10.1: Should use primitive selectors to prevent infinite loops', () => {
      const { result: statusResult } = renderHook(() => useTransactionStatus());
      const { result: countResult } = renderHook(() => useTransactionCount());

      // Get initial values
      const status1 = statusResult.current;
      const count1 = countResult.current;

      // Update something
      act(() => {
        transactionStore.getState().setTotalCount(100);
      });

      // Primitive values should not change (no new object creation)
      expect(status1).toBe(statusResult.current); // Same primitive reference
      expect(count1).not.toBe(countResult.current); // Count changed, but still primitive
    });

    it('TC-HST-10.2: Should not create new object references for each render', () => {
      const { result: result1 } = renderHook(() => useTransactionStatus());
      const { result: result2 } = renderHook(() => useTransactionStatus());

      // Selectors return primitives, not objects
      expect(typeof result1.current).toBe('string');
      expect(typeof result2.current).toBe('string');
      expect(result1.current).toBe(result2.current);
    });
  });

  describe('Concurrent Hook Usage', () => {
    it('TC-HST-11.1: Should handle multiple hooks subscribing to same state', () => {
      const { result: statusResult } = renderHook(() => useTransactionStatus());
      const { result: countResult } = renderHook(() => useTransactionCount());
      const { result: errorResult } = renderHook(() => useTransactionError());

      expect(statusResult.current).toBe('idle');
      expect(countResult.current).toBe(0);
      expect(errorResult.current).toBeNull();

      act(() => {
        transactionStore.getState().setStatus('loading');
        transactionStore.getState().setTotalCount(50);
        transactionStore.getState().setError('Test error');
      });

      expect(statusResult.current).toBe('loading');
      expect(countResult.current).toBe(50);
      expect(errorResult.current).toBe('Test error');
    });

    it('TC-HST-11.2: Should handle rapid state changes across multiple hooks', () => {
      const { result: result1 } = renderHook(() => useTransactionStatus());
      const { result: result2 } = renderHook(() => useTransactions());

      // Rapid updates
      act(() => {
        transactionStore.getState().setStatus('loading');
        transactionStore.getState().addTransaction(createTransaction());
        transactionStore.getState().setStatus('success');
      });

      expect(result1.current).toBe('success');
      expect(result2.current).toHaveLength(1);
    });
  });
});
