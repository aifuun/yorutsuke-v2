import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transactionService } from './transactionService';
import type { Transaction } from '../../../01_domains/transaction';
import { TransactionId, UserId, ImageId, createTraceId } from '../../../00_kernel/types';
import * as adapters from '../adapters';
import { fileService } from '../../capture';
import { emit, on } from '../../../00_kernel/eventBus';

// Mock adapters
vi.mock('../adapters', () => ({
  fetchTransactions: vi.fn(),
  countTransactions: vi.fn(),
  saveTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  confirmTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  getTransactionById: vi.fn(),
}));

// Mock file service
vi.mock('../../capture', () => ({
  fileService: {
    deleteImageComplete: vi.fn(),
  },
}));

// Mock event bus
vi.mock('../../../00_kernel/eventBus', () => ({
  emit: vi.fn(),
  on: vi.fn(),
}));

// Mock logger
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

// Test fixture factory
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

describe('transactionService', () => {
  const testUserId = UserId('user-123');

  beforeEach(() => {
    vi.clearAllMocks();
    transactionService.destroy(); // Reset service state
  });

  afterEach(() => {
    transactionService.destroy();
  });

  describe('Service Initialization (ADR-001)', () => {
    it('TC-SVC-1.1: Should initialize once', () => {
      transactionService.init();
      transactionService.init(); // Call again

      // Event listener should only be set once
      expect(on).toHaveBeenCalledTimes(1);
    });

    it('TC-SVC-1.2: Should not reinitialize if already initialized', () => {
      transactionService.init();
      const callCountBefore = (on as any).mock.calls.length;

      transactionService.init();
      const callCountAfter = (on as any).mock.calls.length;

      expect(callCountAfter).toBe(callCountBefore);
    });

    it('TC-SVC-1.3: Should register transaction:confirmed listener', () => {
      transactionService.init();

      expect(on).toHaveBeenCalledWith('transaction:confirmed', expect.any(Function));
    });
  });

  describe('setUser Method', () => {
    beforeEach(() => {
      transactionService.init();
      (adapters.fetchTransactions as any).mockResolvedValue([]);
      (adapters.countTransactions as any).mockResolvedValue(0);
    });

    it('TC-SVC-2.1: Should load transactions when user is set', async () => {
      await transactionService.setUser(testUserId);

      expect(adapters.fetchTransactions).toHaveBeenCalledWith(testUserId, {});
      expect(adapters.countTransactions).toHaveBeenCalledWith(testUserId, {
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('TC-SVC-2.2: Should clear store when user is set to null', async () => {
      await transactionService.setUser(testUserId);
      const store = transactionService.store.getState();
      // After setUser completes with mocked adapters, status should be idle
      expect(store.getStatus()).toBe('idle');

      await transactionService.setUser(null);

      const storeAfter = transactionService.store.getState();
      expect(storeAfter.getTransactions()).toHaveLength(0);
      expect(storeAfter.getStatus()).toBe('idle');
    });

    it('TC-SVC-2.3: Should set store to success state after loading', async () => {
      const tx = createTransaction();
      (adapters.fetchTransactions as any).mockResolvedValue([tx]);
      (adapters.countTransactions as any).mockResolvedValue(1);

      await transactionService.setUser(testUserId);

      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('idle');
      expect(store.getTransactions()).toHaveLength(1);
    });
  });

  describe('loadTransactions Method (IO-First Pattern)', () => {
    beforeEach(() => {
      transactionService.init();
      (adapters.fetchTransactions as any).mockClear();
      (adapters.countTransactions as any).mockClear();
      // Ensure userId is not set (this is the initial state)
      // userId is private field, so we can only test by not calling setUser
    });

    it('TC-SVC-3.1: Should set userId before loading transactions', async () => {
      // This test ensures setUser properly initializes the service
      await transactionService.setUser(testUserId);

      expect(adapters.fetchTransactions).toHaveBeenCalledWith(testUserId, {});
    });

    it('TC-SVC-3.2: Should set loading status immediately', async () => {
      await transactionService.setUser(testUserId);
      (adapters.fetchTransactions as any).mockImplementation(() => new Promise(r => setTimeout(r, 100)));

      const loadPromise = transactionService.loadTransactions();
      const storeWhileLoading = transactionService.store.getState();
      expect(storeWhileLoading.getStatus()).toBe('loading');

      await loadPromise;
    });

    it('TC-SVC-3.3: Should update store after successful fetch (IO-First)', async () => {
      const tx = createTransaction();
      (adapters.fetchTransactions as any).mockResolvedValue([tx]);
      (adapters.countTransactions as any).mockResolvedValue(1);

      await transactionService.setUser(testUserId);
      await transactionService.loadTransactions();

      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('idle');
      expect(store.getTransactions()).toHaveLength(1);
      expect(store.getError()).toBeNull();
    });

    it('TC-SVC-3.4: Should handle fetch error gracefully', async () => {
      (adapters.fetchTransactions as any).mockRejectedValue(new Error('Network error'));

      await transactionService.setUser(testUserId);
      await transactionService.loadTransactions();

      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('error');
      expect(store.getError()).toContain('Network error');
    });

    it('TC-SVC-3.5: Should pass filter options to adapter', async () => {
      (adapters.fetchTransactions as any).mockResolvedValue([]);
      (adapters.countTransactions as any).mockResolvedValue(0);

      await transactionService.setUser(testUserId);
      const options = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        limit: 20,
        offset: 0,
      };
      await transactionService.loadTransactions(options);

      expect(adapters.fetchTransactions).toHaveBeenCalledWith(testUserId, options);
    });

    it('TC-SVC-3.6: Should update total count', async () => {
      const tx = createTransaction();
      (adapters.fetchTransactions as any).mockResolvedValue([tx]);
      (adapters.countTransactions as any).mockResolvedValue(150);

      await transactionService.setUser(testUserId);
      await transactionService.loadTransactions();

      const store = transactionService.store.getState();
      expect(store.getTotalCount()).toBe(150);
    });

    it('TC-SVC-3.7: Should handle partial fetch failure', async () => {
      (adapters.fetchTransactions as any).mockResolvedValue([createTransaction()]);
      (adapters.countTransactions as any).mockRejectedValue(new Error('Count failed'));

      await transactionService.setUser(testUserId);
      await transactionService.loadTransactions();

      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('error');
    });
  });

  describe('saveTransaction Method (IO-First Pattern)', () => {
    beforeEach(() => {
      transactionService.init();
      (adapters.saveTransaction as any).mockResolvedValue(undefined);
    });

    it('TC-SVC-4.1: Should set saving status', async () => {
      const tx = createTransaction();
      (adapters.saveTransaction as any).mockImplementation(
        () => new Promise(r => setTimeout(r, 50))
      );

      const savePromise = transactionService.saveTransaction(tx);
      const storeWhileSaving = transactionService.store.getState();
      expect(storeWhileSaving.getStatus()).toBe('saving');

      await savePromise;
    });

    it('TC-SVC-4.2: Should add transaction to store after save', async () => {
      const tx = createTransaction();
      await transactionService.saveTransaction(tx);

      const store = transactionService.store.getState();
      expect(store.getTransactions()).toContainEqual(tx);
    });

    it('TC-SVC-4.3: Should set success status after save', async () => {
      const tx = createTransaction();
      await transactionService.saveTransaction(tx);

      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('idle');
      expect(store.getError()).toBeNull();
    });

    it('TC-SVC-4.4: Should handle save error', async () => {
      const tx = createTransaction();
      (adapters.saveTransaction as any).mockRejectedValue(new Error('Save failed'));

      try {
        await transactionService.saveTransaction(tx);
      } catch (e) {
        // Expected to throw
      }

      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('error');
      expect(store.getError()).toContain('Save failed');
    });

    it('TC-SVC-4.5: Should throw error after setting error state', async () => {
      const tx = createTransaction();
      (adapters.saveTransaction as any).mockRejectedValue(new Error('Save failed'));

      let threwError = false;
      try {
        await transactionService.saveTransaction(tx);
      } catch (e) {
        threwError = true;
        expect(e).toEqual(new Error('Save failed'));
      }

      expect(threwError).toBe(true);
    });
  });

  describe('removeTransaction Method (IO-First + Image cleanup)', () => {
    beforeEach(() => {
      transactionService.init();
      (adapters.getTransactionById as any).mockResolvedValue(
        createTransaction({ imageId: ImageId('img-123') })
      );
      (adapters.deleteTransaction as any).mockResolvedValue(undefined);
      (fileService.deleteImageComplete as any).mockResolvedValue(undefined);
    });

    it('TC-SVC-5.1: Should fetch transaction before deletion', async () => {
      await transactionService.removeTransaction(TransactionId('tx-1'));

      expect(adapters.getTransactionById).toHaveBeenCalledWith(TransactionId('tx-1'));
    });

    it('TC-SVC-5.2: Should delete image if imageId exists', async () => {
      await transactionService.removeTransaction(TransactionId('tx-1'));

      expect(fileService.deleteImageComplete).toHaveBeenCalledWith(
        ImageId('img-123'),
        expect.any(String)
      );
    });

    it('TC-SVC-5.3: Should delete transaction after image cleanup', async () => {
      await transactionService.removeTransaction(TransactionId('tx-1'));

      expect(adapters.deleteTransaction).toHaveBeenCalledWith(TransactionId('tx-1'));
    });

    it('TC-SVC-5.4: Should remove transaction from store', async () => {
      // Add transaction to store first
      const tx = createTransaction({ id: TransactionId('tx-1') });
      transactionService.store.getState().addTransaction(tx);

      await transactionService.removeTransaction(TransactionId('tx-1'));

      const store = transactionService.store.getState();
      expect(store.getTransactions().filter(t => t.id === 'tx-1')).toHaveLength(0);
    });

    it('TC-SVC-5.5: Should emit sync event', async () => {
      await transactionService.removeTransaction(TransactionId('tx-1'));

      expect(emit).toHaveBeenCalledWith('transaction:deleted', { id: 'tx-1' });
    });

    it('TC-SVC-5.6: Should handle transaction with no image', async () => {
      (adapters.getTransactionById as any).mockResolvedValue(
        createTransaction({ imageId: null })
      );

      await transactionService.removeTransaction(TransactionId('tx-1'));

      expect(fileService.deleteImageComplete).not.toHaveBeenCalled();
      expect(adapters.deleteTransaction).toHaveBeenCalled();
    });

    it('TC-SVC-5.7: Should handle image deletion failure', async () => {
      (fileService.deleteImageComplete as any).mockRejectedValue(new Error('Image not found'));

      let threwError = false;
      try {
        await transactionService.removeTransaction(TransactionId('tx-1'));
      } catch (e) {
        threwError = true;
      }

      expect(threwError).toBe(true);
    });
  });

  describe('confirmTransaction Method (IO-First + Event)', () => {
    beforeEach(() => {
      transactionService.init();
      (adapters.confirmTransaction as any).mockResolvedValue(undefined);
    });

    it('TC-SVC-6.1: Should confirm transaction in DB', async () => {
      await transactionService.confirmTransaction(TransactionId('tx-1'));

      expect(adapters.confirmTransaction).toHaveBeenCalledWith(TransactionId('tx-1'));
    });

    it('TC-SVC-6.2: Should update store status to confirmed', async () => {
      const tx = createTransaction({ id: TransactionId('tx-1'), status: 'unconfirmed' });
      transactionService.store.getState().addTransaction(tx);

      await transactionService.confirmTransaction(TransactionId('tx-1'));

      const confirmedTx = transactionService.store.getState().getTransactions()[0];
      expect(confirmedTx.status).toBe('confirmed');
    });

    it('TC-SVC-6.3: Should emit sync event after confirmation', async () => {
      await transactionService.confirmTransaction(TransactionId('tx-1'));

      expect(emit).toHaveBeenCalledWith('transaction:confirmed', { id: 'tx-1' });
    });

    it('TC-SVC-6.4: Should handle confirmation error', async () => {
      (adapters.confirmTransaction as any).mockRejectedValue(new Error('DB error'));

      let threwError = false;
      try {
        await transactionService.confirmTransaction(TransactionId('tx-1'));
      } catch (e) {
        threwError = true;
      }

      expect(threwError).toBe(true);
      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('error');
    });
  });

  describe('updateTransaction Method (IO-First + Event)', () => {
    beforeEach(() => {
      transactionService.init();
      (adapters.updateTransaction as any).mockResolvedValue(undefined);
    });

    it('TC-SVC-7.1: Should update transaction in DB', async () => {
      const fields = { amount: 2000, merchant: 'Updated' };
      await transactionService.updateTransaction(TransactionId('tx-1'), fields);

      expect(adapters.updateTransaction).toHaveBeenCalledWith(TransactionId('tx-1'), fields);
    });

    it('TC-SVC-7.2: Should update transaction in store', async () => {
      const tx = createTransaction({ id: TransactionId('tx-1'), amount: 1000 });
      transactionService.store.getState().addTransaction(tx);

      const fields = { amount: 2000 };
      await transactionService.updateTransaction(TransactionId('tx-1'), fields);

      const updatedTx = transactionService.store.getState().getTransactions()[0];
      expect(updatedTx.amount).toBe(2000);
    });

    it('TC-SVC-7.3: Should emit sync event after update', async () => {
      const fields = { amount: 2000 };
      await transactionService.updateTransaction(TransactionId('tx-1'), fields);

      expect(emit).toHaveBeenCalledWith('transaction:updated', { id: 'tx-1' });
    });

    it('TC-SVC-7.4: Should handle update error', async () => {
      (adapters.updateTransaction as any).mockRejectedValue(new Error('Update failed'));

      let threwError = false;
      try {
        await transactionService.updateTransaction(TransactionId('tx-1'), { amount: 2000 });
      } catch (e) {
        threwError = true;
      }

      expect(threwError).toBe(true);
      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('error');
    });
  });

  describe('Cleanup & Destroy', () => {
    it('TC-SVC-8.1: Should cleanup listener on destroy', () => {
      const mockUnsubscribe = vi.fn();
      (on as any).mockReturnValue(mockUnsubscribe);

      transactionService.init();
      transactionService.destroy();

      // Cleanup should be called
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('TC-SVC-8.2: Should allow reinitialize after destroy', () => {
      transactionService.init();
      transactionService.destroy();

      (on as any).mockClear();
      transactionService.init();

      expect(on).toHaveBeenCalled();
    });
  });

  describe('Concurrency & Race Conditions', () => {
    beforeEach(() => {
      transactionService.init();
      (adapters.fetchTransactions as any).mockResolvedValue([]);
      (adapters.countTransactions as any).mockResolvedValue(0);
      (adapters.saveTransaction as any).mockResolvedValue(undefined);
    });

    it('TC-SVC-9.1: Should handle concurrent load requests', async () => {
      await transactionService.setUser(testUserId);

      const promise1 = transactionService.loadTransactions();
      const promise2 = transactionService.loadTransactions();

      await Promise.all([promise1, promise2]);

      // Should complete without errors
      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('idle');
    });

    it('TC-SVC-9.2: Should handle concurrent save operations', async () => {
      const tx1 = createTransaction({ id: TransactionId('tx-1') });
      const tx2 = createTransaction({ id: TransactionId('tx-2') });

      const promise1 = transactionService.saveTransaction(tx1);
      const promise2 = transactionService.saveTransaction(tx2);

      await Promise.all([promise1, promise2]);

      const store = transactionService.store.getState();
      expect(store.getTransactions()).toHaveLength(2);
    });

    it('TC-SVC-9.3: Should handle rapid state transitions', async () => {
      await transactionService.setUser(testUserId);

      const loadPromise = transactionService.loadTransactions();
      const savePromise = transactionService.saveTransaction(createTransaction());

      await Promise.all([loadPromise, savePromise]);

      const store = transactionService.store.getState();
      expect(store.getStatus()).toBe('idle');
    });
  });
});
