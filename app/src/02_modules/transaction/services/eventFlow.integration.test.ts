/**
 * Integration Tests: Event Flow Between Modules
 * Tests how transaction events trigger service reactions
 * Catches issues like: missing event listeners, event type mismatches, state sync problems
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transactionService } from './transactionService';
import { transactionStore } from '../stores/transactionStore';
import type { Transaction } from '../../../01_domains/transaction';
import { TransactionId, UserId, ImageId } from '../../../00_kernel/types';
import * as adapters from '../adapters';

// Mock only file service and logger
vi.mock('../../capture', () => ({
  fileService: {
    deleteImageComplete: vi.fn(),
  },
}));

// Mock eventBus with tracking
const mockEmit = vi.fn();
const mockOn = vi.fn();

vi.mock('../../../00_kernel/eventBus', () => ({
  emit: (eventName: string, payload: any) => mockEmit(eventName, payload),
  on: (eventName: string, callback: Function) => mockOn(eventName, callback),
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

describe('Integration: Event Flow Between Modules', () => {
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

  describe('Transaction Event Emissions', () => {
    it('TC-INT-EVT-1.1: confirmTransaction should emit transaction:confirmed event', async () => {
      // Arrange
      vi.spyOn(adapters, 'confirmTransaction').mockResolvedValue(undefined);

      const tx = createTransaction({
        id: TransactionId('tx-confirm'),
        status: 'unconfirmed',
      });

      transactionStore.getState().addTransaction(tx);

      // Act
      await transactionService.confirmTransaction(TransactionId('tx-confirm'));

      // Assert: Should emit event
      const confirmCalls = mockEmit.mock.calls.filter((call: any[]) =>
        call[0] === 'transaction:confirmed'
      );
      expect(confirmCalls).toHaveLength(1);
      expect(confirmCalls[0][1]).toEqual({ id: 'tx-confirm' });
    });

    it('TC-INT-EVT-1.2: removeTransaction should emit transaction:deleted event', async () => {
      // Arrange
      vi.spyOn(adapters, 'deleteTransaction').mockResolvedValue(undefined);
      vi.spyOn(adapters, 'getTransactionById').mockResolvedValue(null);

      const tx = createTransaction({ id: TransactionId('tx-delete') });
      transactionStore.getState().addTransaction(tx);

      // Act
      await transactionService.removeTransaction(TransactionId('tx-delete'));

      // Assert
      const deleteCalls = mockEmit.mock.calls.filter((call: any[]) =>
        call[0] === 'transaction:deleted'
      );
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0][1]).toEqual({ id: 'tx-delete' });
    });

    it('TC-INT-EVT-1.3: updateTransaction should emit transaction:updated event', async () => {
      // Arrange
      vi.spyOn(adapters, 'updateTransaction').mockResolvedValue(undefined);

      const tx = createTransaction({ id: TransactionId('tx-update') });
      transactionStore.getState().addTransaction(tx);

      // Act
      await transactionService.updateTransaction(TransactionId('tx-update'), {
        amount: 2000,
      });

      // Assert
      const updateCalls = mockEmit.mock.calls.filter((call: any[]) =>
        call[0] === 'transaction:updated'
      );
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0][1]).toEqual({ id: 'tx-update' });
    });
  });

  describe('Transaction Event Listeners', () => {
    it('TC-INT-EVT-2.1: Service should register transaction:confirmed listener on init', () => {
      // Act
      transactionService.init();

      // Assert
      const confirmListeners = mockOn.mock.calls.filter((call: any[]) =>
        call[0] === 'transaction:confirmed'
      );
      expect(confirmListeners).toHaveLength(1);
      expect(typeof confirmListeners[0][1]).toBe('function');
    });

    it('TC-INT-EVT-2.2: Service should not double-register listeners', () => {
      // Act: Initialize twice
      transactionService.init();
      transactionService.init();

      // Assert: Should only have registered once
      const confirmListeners = mockOn.mock.calls.filter((call: any[]) =>
        call[0] === 'transaction:confirmed'
      );
      expect(confirmListeners).toHaveLength(1);
    });
  });

  describe('Event Type Safety', () => {
    it('TC-INT-EVT-3.1: Event payloads should have correct structure', async () => {
      // Arrange
      vi.spyOn(adapters, 'confirmTransaction').mockResolvedValue(undefined);

      const tx = createTransaction({ id: TransactionId('tx-type-check') });
      transactionStore.getState().addTransaction(tx);

      mockEmit.mockClear();

      // Act
      await transactionService.confirmTransaction(TransactionId('tx-type-check'));

      // Assert
      const calls = mockEmit.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const confirmCall = calls.find((call: any[]) => call[0] === 'transaction:confirmed');
      expect(confirmCall).toBeDefined();
      expect(confirmCall[1]).toHaveProperty('id');
      expect(typeof confirmCall[1].id).toBe('string');
    });
  });

  describe('Event-Driven Architecture', () => {
    it('TC-INT-EVT-4.1: Service initialization with event listeners', async () => {
      // Arrange
      vi.spyOn(adapters, 'fetchTransactions').mockResolvedValue([]);
      vi.spyOn(adapters, 'countTransactions').mockResolvedValue(0);

      mockOn.mockClear();

      // Act
      transactionService.init();
      await transactionService.setUser(testUserId);

      // Assert: Event listener should be registered
      expect(mockOn).toHaveBeenCalledWith(
        'transaction:confirmed',
        expect.any(Function)
      );
    });

    it('TC-INT-EVT-4.2: Concurrent operations should emit correct events', async () => {
      // Arrange
      vi.spyOn(adapters, 'confirmTransaction').mockResolvedValue(undefined);
      vi.spyOn(adapters, 'deleteTransaction').mockResolvedValue(undefined);
      vi.spyOn(adapters, 'getTransactionById').mockResolvedValue(null);

      const tx1 = createTransaction({ id: TransactionId('tx-1') });
      const tx2 = createTransaction({ id: TransactionId('tx-2') });

      transactionStore.getState().addTransaction(tx1);
      transactionStore.getState().addTransaction(tx2);

      mockEmit.mockClear();

      // Act: Concurrent operations
      await Promise.all([
        transactionService.confirmTransaction(TransactionId('tx-1')),
        transactionService.removeTransaction(TransactionId('tx-2')),
      ]);

      // Assert: Both events should be emitted
      const confirmCalls = mockEmit.mock.calls.filter(
        (call: any[]) => call[0] === 'transaction:confirmed'
      );
      const deleteCalls = mockEmit.mock.calls.filter(
        (call: any[]) => call[0] === 'transaction:deleted'
      );

      expect(confirmCalls).toHaveLength(1);
      expect(deleteCalls).toHaveLength(1);
    });
  });

  describe('Event Flow Stability', () => {
    it('TC-INT-EVT-5.1: Service handles operations in sequence', async () => {
      // Arrange
      vi.spyOn(adapters, 'confirmTransaction').mockResolvedValue(undefined);
      vi.spyOn(adapters, 'deleteTransaction').mockResolvedValue(undefined);
      vi.spyOn(adapters, 'getTransactionById').mockResolvedValue(null);

      const tx1 = createTransaction({ id: TransactionId('tx-seq-1') });
      const tx2 = createTransaction({ id: TransactionId('tx-seq-2') });

      transactionStore.getState().addTransaction(tx1);
      transactionStore.getState().addTransaction(tx2);

      mockEmit.mockClear();

      // Act: Sequential operations
      await transactionService.confirmTransaction(TransactionId('tx-seq-1'));
      await transactionService.removeTransaction(TransactionId('tx-seq-2'));

      // Assert: Both operations should complete
      expect(mockEmit.mock.calls.length).toBeGreaterThanOrEqual(2);

      const state = transactionStore.getState();
      expect(state.status).toBe('idle');
    });
  });
});
