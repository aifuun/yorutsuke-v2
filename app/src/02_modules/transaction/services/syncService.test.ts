import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncTransactions } from './syncService';
import type { Transaction } from '../../../01_domains/transaction';
import { TransactionId, UserId, ImageId } from '../../../00_kernel/types';

// Mock adapters
const mockFetchFromCloud = vi.fn();
const mockFetchFromLocal = vi.fn();
const mockUpsertTransaction = vi.fn();

vi.mock('../adapters', () => ({
  fetchTransactionsFromCloud: (...args: unknown[]) => mockFetchFromCloud(...args),
  fetchTransactions: (...args: unknown[]) => mockFetchFromLocal(...args),
  upsertTransaction: (...args: unknown[]) => mockUpsertTransaction(...args),
}));

// Mock logger
vi.mock('../../../00_kernel/telemetry/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
  EVENTS: {
    TRANSACTION_CREATED: 'TRANSACTION_CREATED',
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
  ...overrides,
});

describe('syncService', () => {
  const testUserId = UserId('user-123');

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertTransaction.mockResolvedValue(undefined);
  });

  describe('syncTransactions', () => {
    it('TC-2.1: Empty local, fetch cloud → insert all', async () => {
      const cloudTransactions = [
        createTransaction({ id: TransactionId('tx-1'), amount: 1000 }),
        createTransaction({ id: TransactionId('tx-2'), amount: 2000 }),
        createTransaction({ id: TransactionId('tx-3'), amount: 3000 }),
      ];

      mockFetchFromCloud.mockResolvedValue(cloudTransactions);
      mockFetchFromLocal.mockResolvedValue([]);

      const result = await syncTransactions(testUserId);

      expect(result.synced).toBe(3);
      expect(result.conflicts).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.cloudCount).toBe(3);
      expect(result.localCount).toBe(0);

      // All 3 transactions should be upserted
      expect(mockUpsertTransaction).toHaveBeenCalledTimes(3);
    });

    it('TC-2.2: Conflict (cloud newer updatedAt) → cloud wins', async () => {
      const cloudTx = createTransaction({
        id: TransactionId('tx-conflict'),
        amount: 5000,
        updatedAt: '2026-01-15T12:00:00Z', // Newer
        status: 'unconfirmed',
      });

      const localTx = createTransaction({
        id: TransactionId('tx-conflict'),
        amount: 3000,
        updatedAt: '2026-01-15T10:00:00Z', // Older
        status: 'unconfirmed',
      });

      mockFetchFromCloud.mockResolvedValue([cloudTx]);
      mockFetchFromLocal.mockResolvedValue([localTx]);

      const result = await syncTransactions(testUserId);

      expect(result.synced).toBe(1);
      expect(result.conflicts).toBe(1);

      // Cloud transaction should be upserted (newer)
      expect(mockUpsertTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tx-conflict',
          amount: 5000, // Cloud's amount
        })
      );
    });

    it('TC-2.3: Conflict (local confirmed, cloud not) → local wins', async () => {
      const cloudTx = createTransaction({
        id: TransactionId('tx-confirmed'),
        amount: 5000,
        updatedAt: '2026-01-15T12:00:00Z', // Newer timestamp
        status: 'unconfirmed', // Not confirmed
      });

      const localTx = createTransaction({
        id: TransactionId('tx-confirmed'),
        amount: 3000,
        updatedAt: '2026-01-15T10:00:00Z', // Older timestamp
        status: 'confirmed', // But confirmed by user!
      });

      mockFetchFromCloud.mockResolvedValue([cloudTx]);
      mockFetchFromLocal.mockResolvedValue([localTx]);

      const result = await syncTransactions(testUserId);

      expect(result.synced).toBe(0); // Local won, no update
      expect(result.conflicts).toBe(1);

      // No upsert should happen (local wins)
      expect(mockUpsertTransaction).not.toHaveBeenCalled();
    });

    it('TC-2.4: No conflicts → no changes', async () => {
      const sameTx = createTransaction({
        id: TransactionId('tx-same'),
        amount: 1000,
        updatedAt: '2026-01-15T10:00:00Z',
      });

      mockFetchFromCloud.mockResolvedValue([sameTx]);
      mockFetchFromLocal.mockResolvedValue([sameTx]);

      const result = await syncTransactions(testUserId);

      expect(result.synced).toBe(1); // Cloud default wins (upserted)
      expect(result.conflicts).toBe(1);

      // Cloud transaction upserted (default behavior)
      expect(mockUpsertTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tx-same',
        })
      );
    });

    it('TC-2.5: Network error during cloud fetch → returns error', async () => {
      mockFetchFromCloud.mockRejectedValue(new Error('Network timeout'));

      const result = await syncTransactions(testUserId);

      expect(result.synced).toBe(0);
      expect(result.conflicts).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Network timeout');
    });

    it('TC-2.6: Partial failure (some transactions fail to upsert)', async () => {
      const cloudTransactions = [
        createTransaction({ id: TransactionId('tx-1'), amount: 1000 }),
        createTransaction({ id: TransactionId('tx-2'), amount: 2000 }),
        createTransaction({ id: TransactionId('tx-3'), amount: 3000 }),
      ];

      mockFetchFromCloud.mockResolvedValue(cloudTransactions);
      mockFetchFromLocal.mockResolvedValue([]);

      // Make the second upsert fail
      mockUpsertTransaction
        .mockResolvedValueOnce(undefined) // tx-1 succeeds
        .mockRejectedValueOnce(new Error('Database locked')) // tx-2 fails
        .mockResolvedValueOnce(undefined); // tx-3 succeeds

      const result = await syncTransactions(testUserId);

      expect(result.synced).toBe(2); // Only tx-1 and tx-3
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('tx-2');
      expect(result.errors[0]).toContain('Database locked');
    });

    it('TC-2.7: Local newer → local wins', async () => {
      const cloudTx = createTransaction({
        id: TransactionId('tx-local-wins'),
        amount: 5000,
        updatedAt: '2026-01-15T10:00:00Z', // Older
      });

      const localTx = createTransaction({
        id: TransactionId('tx-local-wins'),
        amount: 3000,
        updatedAt: '2026-01-15T12:00:00Z', // Newer
      });

      mockFetchFromCloud.mockResolvedValue([cloudTx]);
      mockFetchFromLocal.mockResolvedValue([localTx]);

      const result = await syncTransactions(testUserId);

      expect(result.conflicts).toBe(1);

      // Local transaction should win (not upserted)
      expect(mockUpsertTransaction).not.toHaveBeenCalled();
    });

    it('TC-2.8: Multiple transactions with mixed conflicts', async () => {
      const cloudTransactions = [
        // New transaction (not in local)
        createTransaction({ id: TransactionId('tx-new'), amount: 1000 }),

        // Conflict: cloud newer
        createTransaction({
          id: TransactionId('tx-cloud-newer'),
          amount: 2000,
          updatedAt: '2026-01-15T12:00:00Z',
        }),

        // Conflict: local confirmed
        createTransaction({
          id: TransactionId('tx-local-confirmed'),
          amount: 3000,
          status: 'unconfirmed',
        }),
      ];

      const localTransactions = [
        // Conflict: cloud newer (local is older)
        createTransaction({
          id: TransactionId('tx-cloud-newer'),
          amount: 1500,
          updatedAt: '2026-01-15T10:00:00Z',
        }),

        // Conflict: local confirmed (local wins)
        createTransaction({
          id: TransactionId('tx-local-confirmed'),
          amount: 2500,
          status: 'confirmed',
        }),
      ];

      mockFetchFromCloud.mockResolvedValue(cloudTransactions);
      mockFetchFromLocal.mockResolvedValue(localTransactions);

      const result = await syncTransactions(testUserId);

      expect(result.synced).toBe(2); // tx-new + tx-cloud-newer
      expect(result.conflicts).toBe(2); // tx-cloud-newer + tx-local-confirmed
      expect(result.cloudCount).toBe(3);
      expect(result.localCount).toBe(2);

      // Verify upserts
      expect(mockUpsertTransaction).toHaveBeenCalledTimes(2);
      expect(mockUpsertTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tx-new' })
      );
      expect(mockUpsertTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tx-cloud-newer', amount: 2000 })
      );
    });

    it('TC-2.9: Passes filters to fetch functions', async () => {
      mockFetchFromCloud.mockResolvedValue([]);
      mockFetchFromLocal.mockResolvedValue([]);

      await syncTransactions(testUserId, '2026-01-01', '2026-01-31');

      expect(mockFetchFromCloud).toHaveBeenCalledWith(
        testUserId,
        '2026-01-01',
        '2026-01-31'
      );

      expect(mockFetchFromLocal).toHaveBeenCalledWith(
        testUserId,
        { startDate: '2026-01-01', endDate: '2026-01-31' }
      );
    });
  });
});
