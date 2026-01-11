/**
 * Integration Tests: Full Sync Flow
 * Tests the complete cloud-to-local synchronization process
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  confirmedAt: null,
  confidence: null,
  rawText: null,
  ...overrides,
});

describe('Integration: Full Sync Flow', () => {
  const testUserId = UserId('user-integration-test');

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertTransaction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('TC-INT-1: First sync (empty local) → inserts all cloud transactions', async () => {
    // Arrange: Cloud has 5 transactions, local is empty
    const cloudTransactions = [
      createTransaction({ id: TransactionId('tx-1'), amount: 1000, date: '2026-01-01' }),
      createTransaction({ id: TransactionId('tx-2'), amount: 2000, date: '2026-01-02' }),
      createTransaction({ id: TransactionId('tx-3'), amount: 3000, date: '2026-01-03' }),
      createTransaction({ id: TransactionId('tx-4'), amount: 4000, date: '2026-01-04' }),
      createTransaction({ id: TransactionId('tx-5'), amount: 5000, date: '2026-01-05' }),
    ];

    mockFetchFromCloud.mockResolvedValue(cloudTransactions);
    mockFetchFromLocal.mockResolvedValue([]);

    // Act
    const result = await syncTransactions(testUserId);

    // Assert
    expect(result.synced).toBe(5);
    expect(result.conflicts).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.cloudCount).toBe(5);
    expect(result.localCount).toBe(0);

    // Verify all transactions were upserted
    expect(mockUpsertTransaction).toHaveBeenCalledTimes(5);
    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-1', amount: 1000 })
    );
    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-5', amount: 5000 })
    );
  });

  it('TC-INT-2: Sync with conflict (cloud newer) → cloud wins', async () => {
    // Arrange: Conflict where cloud has newer data
    const cloudTx = createTransaction({
      id: TransactionId('tx-conflict'),
      amount: 5000,
      merchant: 'Updated Merchant',
      updatedAt: '2026-01-15T12:00:00Z', // Newer
    });

    const localTx = createTransaction({
      id: TransactionId('tx-conflict'),
      amount: 3000,
      merchant: 'Old Merchant',
      updatedAt: '2026-01-15T10:00:00Z', // Older
    });

    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockResolvedValue([localTx]);

    // Act
    const result = await syncTransactions(testUserId);

    // Assert
    expect(result.synced).toBe(1);
    expect(result.conflicts).toBe(1);

    // Verify cloud transaction was upserted
    expect(mockUpsertTransaction).toHaveBeenCalledOnce();
    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-conflict',
        amount: 5000,
        merchant: 'Updated Merchant',
      })
    );
  });

  it('TC-INT-3: Sync with conflict (local confirmed) → local wins', async () => {
    // Arrange: Local confirmed takes priority
    const cloudTx = createTransaction({
      id: TransactionId('tx-confirmed'),
      amount: 5000,
      updatedAt: '2026-01-15T12:00:00Z', // Newer
      confirmedAt: null, // Not confirmed
    });

    const localTx = createTransaction({
      id: TransactionId('tx-confirmed'),
      amount: 3000,
      updatedAt: '2026-01-15T10:00:00Z', // Older
      confirmedAt: '2026-01-15T11:00:00Z', // But confirmed
    });

    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockResolvedValue([localTx]);

    // Act
    const result = await syncTransactions(testUserId);

    // Assert
    expect(result.synced).toBe(0); // Local won, no sync needed
    expect(result.conflicts).toBe(1);

    // Verify no upsert happened (local wins)
    expect(mockUpsertTransaction).not.toHaveBeenCalled();
  });

  it('TC-INT-4: Multiple transactions with mixed scenarios', async () => {
    // Arrange: Mix of new, conflicts, and unchanged transactions
    const cloudTransactions = [
      // New transaction
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
        confirmedAt: null,
      }),

      // Same in both (cloud default wins)
      createTransaction({
        id: TransactionId('tx-same'),
        amount: 4000,
        updatedAt: '2026-01-15T10:00:00Z',
      }),
    ];

    const localTransactions = [
      // Conflict: cloud newer (local older)
      createTransaction({
        id: TransactionId('tx-cloud-newer'),
        amount: 1500,
        updatedAt: '2026-01-15T10:00:00Z',
      }),

      // Conflict: local confirmed
      createTransaction({
        id: TransactionId('tx-local-confirmed'),
        amount: 2500,
        confirmedAt: '2026-01-15T11:00:00Z',
      }),

      // Same in both
      createTransaction({
        id: TransactionId('tx-same'),
        amount: 4000,
        updatedAt: '2026-01-15T10:00:00Z',
      }),
    ];

    mockFetchFromCloud.mockResolvedValue(cloudTransactions);
    mockFetchFromLocal.mockResolvedValue(localTransactions);

    // Act
    const result = await syncTransactions(testUserId);

    // Assert
    expect(result.synced).toBe(3); // tx-new + tx-cloud-newer + tx-same
    expect(result.conflicts).toBe(3); // tx-cloud-newer + tx-local-confirmed + tx-same
    expect(result.cloudCount).toBe(4);
    expect(result.localCount).toBe(3);

    // Verify correct upserts
    expect(mockUpsertTransaction).toHaveBeenCalledTimes(3);
    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-new' })
    );
    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-cloud-newer', amount: 2000 })
    );
    expect(mockUpsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-same' })
    );
  });

  it('TC-INT-5: Network error during cloud fetch → returns error', async () => {
    // Arrange
    mockFetchFromCloud.mockRejectedValue(new Error('Network timeout'));

    // Act
    const result = await syncTransactions(testUserId);

    // Assert
    expect(result.synced).toBe(0);
    expect(result.conflicts).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Network timeout');
    expect(result.cloudCount).toBe(0);
    expect(result.localCount).toBe(0);

    // No upserts attempted
    expect(mockUpsertTransaction).not.toHaveBeenCalled();
  });

  it('TC-INT-6: Partial failure (some upserts fail)', async () => {
    // Arrange
    const cloudTransactions = [
      createTransaction({ id: TransactionId('tx-1'), amount: 1000 }),
      createTransaction({ id: TransactionId('tx-2'), amount: 2000 }),
      createTransaction({ id: TransactionId('tx-3'), amount: 3000 }),
    ];

    mockFetchFromCloud.mockResolvedValue(cloudTransactions);
    mockFetchFromLocal.mockResolvedValue([]);

    // Make second upsert fail
    mockUpsertTransaction
      .mockResolvedValueOnce(undefined) // tx-1 succeeds
      .mockRejectedValueOnce(new Error('Database locked')) // tx-2 fails
      .mockResolvedValueOnce(undefined); // tx-3 succeeds

    // Act
    const result = await syncTransactions(testUserId);

    // Assert
    expect(result.synced).toBe(2); // tx-1 and tx-3
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('tx-2');
    expect(result.errors[0]).toContain('Database locked');

    // Verify all three upserts were attempted
    expect(mockUpsertTransaction).toHaveBeenCalledTimes(3);
  });

  it('TC-INT-7: Date filtering (fetch specific range)', async () => {
    // Arrange
    const startDate = '2026-01-01';
    const endDate = '2026-01-31';

    mockFetchFromCloud.mockResolvedValue([]);
    mockFetchFromLocal.mockResolvedValue([]);

    // Act
    await syncTransactions(testUserId, startDate, endDate);

    // Assert: Verify filters passed to both fetch functions
    expect(mockFetchFromCloud).toHaveBeenCalledWith(
      testUserId,
      startDate,
      endDate
    );

    expect(mockFetchFromLocal).toHaveBeenCalledWith(
      testUserId,
      { startDate, endDate }
    );
  });

  it('TC-INT-8: Large dataset (100 transactions)', async () => {
    // Arrange: Simulate large dataset
    const cloudTransactions: Transaction[] = [];
    for (let i = 1; i <= 100; i++) {
      cloudTransactions.push(
        createTransaction({
          id: TransactionId(`tx-${i}`),
          amount: i * 100,
          date: `2026-01-${String(i % 30 + 1).padStart(2, '0')}`,
        })
      );
    }

    mockFetchFromCloud.mockResolvedValue(cloudTransactions);
    mockFetchFromLocal.mockResolvedValue([]);

    // Act
    const result = await syncTransactions(testUserId);

    // Assert
    expect(result.synced).toBe(100);
    expect(result.conflicts).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify all 100 transactions upserted
    expect(mockUpsertTransaction).toHaveBeenCalledTimes(100);
  });

  it('TC-INT-9: Idempotency (running sync twice produces same result)', async () => {
    // Arrange
    const cloudTransactions = [
      createTransaction({ id: TransactionId('tx-1'), amount: 1000 }),
      createTransaction({ id: TransactionId('tx-2'), amount: 2000 }),
    ];

    mockFetchFromCloud.mockResolvedValue(cloudTransactions);
    mockFetchFromLocal.mockResolvedValue([]);

    // Act: Run sync twice
    const result1 = await syncTransactions(testUserId);

    // Second sync: local now has transactions
    mockFetchFromLocal.mockResolvedValue(cloudTransactions);
    const result2 = await syncTransactions(testUserId);

    // Assert: First sync inserts, second sync finds same timestamps
    expect(result1.synced).toBe(2);
    expect(result2.synced).toBe(2); // Cloud default wins on same timestamps
    expect(result2.conflicts).toBe(2);
  });
});
