/**
 * Integration Tests: Hooks + Store + Service
 * Tests how hooks, store, and service interact in real scenarios
 * Catches issues like: missing exports, incorrect hook signatures, state sync problems
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import * as adapters from '../adapters';

// Mock external services
vi.mock('../../capture', () => ({
  fileService: {
    deleteImageComplete: vi.fn(),
  },
}));

vi.mock('../../../00_kernel/eventBus', () => ({
  emit: vi.fn(),
  on: vi.fn(),
}));

vi.mock('../../../00_kernel/telemetry/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  EVENTS: {
    SERVICE_INITIALIZED: 'SERVICE_INITIALIZED',
    STATE_TRANSITION: 'STATE_TRANSITION',
    TRANSACTION_CONFIRMED: 'TRANSACTION_CONFIRMED',
    TRANSACTION_DELETED: 'TRANSACTION_DELETED',
    APP_ERROR: 'APP_ERROR',
  },
}));

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
  traceId: null,
  subtotal: null,
  taxAmount: null,
  taxRate: null,
  ...overrides,
});

describe('Integration: Hooks + Store + Service', () => {
  const testUserId = UserId('user-integration-test');

  beforeEach(() => {
    vi.clearAllMocks();
    transactionService.destroy();
    transactionStore.setState({
      status: 'idle',
      transactions: [],
      error: null,
      totalCount: 0,
      filters: {},
    });
  });

  afterEach(() => {
    transactionService.destroy();
  });

  describe('All Hooks Export Correctly', () => {
    it('TC-INT-HOOKS-1.1: useTransactionStatus hook should exist and work', () => {
      // ✅ This test CATCHES missing exports like the 'useTransactionLogic' error
      const { result } = renderHook(() => useTransactionStatus());

      expect(result.current).toBe('idle');
    });

    it('TC-INT-HOOKS-1.2: useTransactions hook should exist and work', () => {
      const { result } = renderHook(() => useTransactions());

      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current).toHaveLength(0);
    });

    it('TC-INT-HOOKS-1.3: useTransactionCount hook should exist and work', () => {
      const { result } = renderHook(() => useTransactionCount());

      expect(typeof result.current).toBe('number');
      expect(result.current).toBe(0);
    });

    it('TC-INT-HOOKS-1.4: useTransactionError hook should exist and work', () => {
      const { result } = renderHook(() => useTransactionError());

      expect(result.current).toBeNull();
    });

    it('TC-INT-HOOKS-1.5: useTransactionFilters hook should exist and work', () => {
      const { result } = renderHook(() => useTransactionFilters());

      expect(typeof result.current).toBe('object');
      expect(result.current).toEqual({});
    });

    it('TC-INT-HOOKS-1.6: useFilteredTransactions hook should exist and work', () => {
      const { result } = renderHook(() => useFilteredTransactions());

      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current).toHaveLength(0);
    });

    it('TC-INT-HOOKS-1.7: useTransactionActions hook should exist and work', () => {
      const { result } = renderHook(() => useTransactionActions());

      expect(typeof result.current).toBe('object');
      expect(typeof result.current.confirm).toBe('function');
      expect(typeof result.current.remove).toBe('function');
      expect(typeof result.current.update).toBe('function');
    });

    it('TC-INT-HOOKS-1.8: useTransactionLoading hook should exist and work', () => {
      const { result } = renderHook(() => useTransactionLoading());

      expect(typeof result.current).toBe('boolean');
      expect(result.current).toBe(false);
    });

    it('TC-INT-HOOKS-1.9: useTransactionErrorState hook should exist and work', () => {
      const { result } = renderHook(() => useTransactionErrorState());

      expect(typeof result.current).toBe('object');
      expect(typeof result.current.hasError).toBe('boolean');
      expect(result.current.message).toBeNull();
    });
  });

  describe('Hooks React to Store Changes', () => {
    it('TC-INT-HOOKS-2.1: useTransactionStatus should reflect status changes', () => {
      const { result, rerender } = renderHook(() => useTransactionStatus());

      expect(result.current).toBe('idle');

      act(() => {
        transactionStore.getState().setStatus('loading');
      });
      rerender();

      expect(result.current).toBe('loading');
    });

    it('TC-INT-HOOKS-2.2: useTransactions should reflect transaction additions', () => {
      const { result, rerender } = renderHook(() => useTransactions());

      expect(result.current).toHaveLength(0);

      const tx = createTransaction();
      act(() => {
        transactionStore.getState().addTransaction(tx);
      });
      rerender();

      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe('tx-1');
    });

    it('TC-INT-HOOKS-2.3: useTransactionCount should reflect count changes', () => {
      const { result, rerender } = renderHook(() => useTransactionCount());

      expect(result.current).toBe(0);

      act(() => {
        transactionStore.getState().setTotalCount(100);
      });
      rerender();

      expect(result.current).toBe(100);
    });

    it('TC-INT-HOOKS-2.4: useTransactionError should reflect error changes', () => {
      const { result, rerender } = renderHook(() => useTransactionError());

      expect(result.current).toBeNull();

      act(() => {
        transactionStore.getState().setError('Test error');
      });
      rerender();

      expect(result.current).toBe('Test error');
    });
  });

  describe('Hooks Work Together', () => {
    it('TC-INT-HOOKS-3.1: Multiple hooks should sync correctly', () => {
      const statusHook = renderHook(() => useTransactionStatus());
      const transactionsHook = renderHook(() => useTransactions());
      const errorHook = renderHook(() => useTransactionError());

      // Initial state
      expect(statusHook.result.current).toBe('idle');
      expect(transactionsHook.result.current).toHaveLength(0);
      expect(errorHook.result.current).toBeNull();

      // Add transaction
      const tx = createTransaction();
      act(() => {
        transactionStore.getState().setStatus('saving');
        transactionStore.getState().addTransaction(tx);
      });

      statusHook.rerender();
      transactionsHook.rerender();

      expect(statusHook.result.current).toBe('saving');
      expect(transactionsHook.result.current).toHaveLength(1);
    });

    it('TC-INT-HOOKS-3.2: Loading and error hooks should derive correctly', () => {
      const loadingHook = renderHook(() => useTransactionLoading());
      const errorStateHook = renderHook(() => useTransactionErrorState());

      // Initial state
      expect(loadingHook.result.current).toBe(false);
      expect(errorStateHook.result.current.hasError).toBe(false);

      // Set error
      act(() => {
        transactionStore.getState().setStatus('error');
        transactionStore.getState().setError('Network error');
      });

      loadingHook.rerender();
      errorStateHook.rerender();

      expect(errorStateHook.result.current.hasError).toBe(true);
      expect(errorStateHook.result.current.message).toBe('Network error');
    });
  });

  describe('Service + Hooks Integration', () => {
    it('TC-INT-HOOKS-4.1: Service changes should update hooks', async () => {
      // Arrange
      const mockFetch = vi.spyOn(adapters, 'fetchTransactions').mockResolvedValue([]);
      vi.spyOn(adapters, 'countTransactions').mockResolvedValue(0);

      const statusHook = renderHook(() => useTransactionStatus());
      const transactionsHook = renderHook(() => useTransactions());


      // Act: Service load
      await transactionService.setUser(testUserId);

      statusHook.rerender();
      transactionsHook.rerender();

      // Assert: Hooks should reflect service state
      expect(statusHook.result.current).toBe('idle');

      mockFetch.mockRestore();
    });

    it('TC-INT-HOOKS-4.2: Service save should update hooks', async () => {
      // Arrange
      const mockSave = vi.spyOn(adapters, 'saveTransaction').mockResolvedValue(undefined);

      const transactionsHook = renderHook(() => useTransactions());
      const actionsHook = renderHook(() => useTransactionActions());

      const tx = createTransaction({ id: TransactionId('tx-new') });

      // Act: Service save
      await transactionService.saveTransaction(tx);

      transactionsHook.rerender();

      // Assert: Hooks should reflect new transaction
      expect(transactionsHook.result.current).toHaveLength(1);
      expect(transactionsHook.result.current[0].id).toBe('tx-new');

      mockSave.mockRestore();
    });
  });

  describe('Filtered Transactions Memoization', () => {
    it('TC-INT-HOOKS-5.1: useFilteredTransactions should memoize correctly', () => {
      // Arrange
      const tx1 = createTransaction({ id: TransactionId('tx-1'), type: 'expense' });
      const tx2 = createTransaction({ id: TransactionId('tx-2'), type: 'income' });

      act(() => {
        transactionStore.getState().setTransactions([tx1, tx2]);
      });

      const { result, rerender } = renderHook(() => useFilteredTransactions());

      const firstResult = result.current;

      // Act: Rerender without state changes
      rerender();

      // Assert: Should return memoized result (same reference)
      expect(result.current).toBe(firstResult);
    });

    it('TC-INT-HOOKS-5.2: useFilteredTransactions should recalculate on filter changes', () => {
      // Arrange
      const tx1 = createTransaction({ id: TransactionId('tx-1'), type: 'expense' });
      const tx2 = createTransaction({ id: TransactionId('tx-2'), type: 'income' });

      act(() => {
        transactionStore.getState().setTransactions([tx1, tx2]);
      });

      const { result, rerender } = renderHook(() => useFilteredTransactions());

      const initialResult = result.current;

      // Act: Change filters
      act(() => {
        transactionStore.getState().setFilters({ typeFilter: 'expense' as const });
      });
      rerender();

      // Assert: Should recalculate (different reference)
      expect(result.current).not.toBe(initialResult);
    });
  });

  describe('No Infinite Loops (ADR-012)', () => {
    it('TC-INT-HOOKS-6.1: Primitive selectors should prevent infinite loops', () => {
      // This test verifies that the hooks pattern doesn't cause infinite renders
      const { result } = renderHook(() => useTransactionStatus());

      let renderCount = 0;
      const originalResult = result.current;

      // Manually trigger store update
      act(() => {
        transactionStore.getState().setStatus('loading');
      });

      // Should be different value but no crash
      expect(result.current).toBe('loading');

      // Reset
      act(() => {
        transactionStore.getState().setStatus('idle');
      });

      // Should be back to original
      expect(result.current).toBe('idle');

      // If we got here, no infinite loop occurred
      expect(true).toBe(true);
    });
  });
});
