/**
 * Transaction Pull Service Tests (Issue #86)
 * Tests pull sync (Cloud → Local) with conflict resolution (LWW)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pullTransactions } from './transactionPullService';
import type { Transaction } from '../../../01_domains/transaction';
import { TransactionId, UserId, ImageId, TraceId } from '../../../00_kernel/types';

// Mock dependencies
const mockFetchFromCloud = vi.fn();
const mockFetchFromLocal = vi.fn();
const mockUpsertTransaction = vi.fn();
const mockSyncImagesForTransactions = vi.fn();

// Mock transaction adapters (barrel export)
vi.mock('../../transaction/adapters', () => ({
  fetchTransactionsFromCloud: (...args: unknown[]) => mockFetchFromCloud(...args),
  fetchTransactions: (...args: unknown[]) => mockFetchFromLocal(...args),
  upsertTransaction: (...args: unknown[]) => mockUpsertTransaction(...args),
}));

// Mock imageSyncService
vi.mock('./imageSyncService', () => ({
  syncImagesForTransactions: (...args: unknown[]) => mockSyncImagesForTransactions(...args),
}));

// Mock logger
vi.mock('../../../00_kernel/telemetry/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  EVENTS: {},
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
  ...overrides,
});

describe('pullTransactions', () => {
  const userId = UserId('user-1');
  const traceId = TraceId('test-trace-id');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sync new transactions from cloud', async () => {
    const cloudTx = createTransaction({ id: TransactionId('tx-cloud') });
    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockResolvedValue([]);
    mockSyncImagesForTransactions.mockResolvedValue({
      synced: 0,
      failed: 0,
      skipped: 0,
    });

    const result = await pullTransactions(userId, traceId);

    expect(result.synced).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(result.cloudCount).toBe(1);
    expect(result.localCount).toBe(0);
    expect(mockUpsertTransaction).toHaveBeenCalledWith(cloudTx);
  });

  it('should resolve conflicts using Last-Write-Wins (cloud newer)', async () => {
    const localTx = createTransaction({
      id: TransactionId('tx-1'),
      updatedAt: '2026-01-15T10:00:00Z',
      amount: 1000,
    });

    const cloudTx = createTransaction({
      id: TransactionId('tx-1'),
      updatedAt: '2026-01-15T11:00:00Z', // Newer
      amount: 2000,
    });

    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockResolvedValue([localTx]);
    mockSyncImagesForTransactions.mockResolvedValue({
      synced: 0,
      failed: 0,
      skipped: 0,
    });

    const result = await pullTransactions(userId, traceId);

    expect(result.synced).toBe(1);
    expect(result.conflicts).toBe(1); // Conflict detected
    expect(mockUpsertTransaction).toHaveBeenCalledWith(cloudTx); // Cloud wins
  });

  it('should keep local version when local is newer', async () => {
    const localTx = createTransaction({
      id: TransactionId('tx-1'),
      updatedAt: '2026-01-15T11:00:00Z', // Newer
      amount: 2000,
    });

    const cloudTx = createTransaction({
      id: TransactionId('tx-1'),
      updatedAt: '2026-01-15T10:00:00Z',
      amount: 1000,
    });

    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockResolvedValue([localTx]);
    mockSyncImagesForTransactions.mockResolvedValue({
      synced: 0,
      failed: 0,
      skipped: 0,
    });

    const result = await pullTransactions(userId, traceId);

    expect(result.synced).toBe(0); // No sync (local is newer)
    expect(result.conflicts).toBe(1); // Still counted as conflict even though local won
    expect(mockUpsertTransaction).not.toHaveBeenCalled();
  });

  it('should handle date range filtering', async () => {
    const cloudTx = createTransaction();
    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockResolvedValue([]);
    mockSyncImagesForTransactions.mockResolvedValue({
      synced: 0,
      failed: 0,
      skipped: 0,
    });

    await pullTransactions(userId, traceId, '2026-01-01', '2026-01-31');

    expect(mockFetchFromCloud).toHaveBeenCalledWith(
      userId,
      '2026-01-01',
      '2026-01-31'
    );
    expect(mockFetchFromLocal).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })
    );
  });

  it('should sync images if not exists locally', async () => {
    const cloudTx = createTransaction({
      imageId: ImageId('img-cloud'),
      s3Key: 'uploads/img-cloud.webp',
    });

    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockResolvedValue([]);
    mockSyncImagesForTransactions.mockResolvedValue({
      synced: 1,
      failed: 0,
      skipped: 0,
    });

    const result = await pullTransactions(userId, traceId);

    expect(mockSyncImagesForTransactions).toHaveBeenCalledWith(
      [cloudTx],
      userId,
      traceId
    );
    expect(result.images).toEqual({
      synced: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it('should skip image sync if already exists locally', async () => {
    const cloudTx = createTransaction({
      imageId: ImageId('img-cloud'),
      s3Key: 'uploads/img-cloud.webp',
    });

    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockResolvedValue([]);
    mockSyncImagesForTransactions.mockResolvedValue({
      synced: 0,
      failed: 0,
      skipped: 1,
    });

    const result = await pullTransactions(userId, traceId);

    expect(mockSyncImagesForTransactions).toHaveBeenCalledWith(
      [cloudTx],
      userId,
      traceId
    );
    expect(result.images).toEqual({
      synced: 0,
      failed: 0,
      skipped: 1,
    });
  });

  it('should handle image sync failures gracefully', async () => {
    const cloudTx = createTransaction({
      imageId: ImageId('img-cloud'),
      s3Key: 'uploads/img-cloud.webp',
    });

    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockResolvedValue([]);
    mockSyncImagesForTransactions.mockResolvedValue({
      synced: 0,
      failed: 1,
      skipped: 0,
    });

    const result = await pullTransactions(userId, traceId);

    expect(result.synced).toBe(1); // Transaction still synced
    expect(result.images).toEqual({
      synced: 0,
      failed: 1, // Image failed
      skipped: 0,
    });
  });

  it('should handle API errors', async () => {
    mockFetchFromCloud.mockRejectedValue(new Error('API error'));

    const result = await pullTransactions(userId, traceId);

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Error: API error');
  });

  it('should handle database errors', async () => {
    const cloudTx = createTransaction();
    mockFetchFromCloud.mockResolvedValue([cloudTx]);
    mockFetchFromLocal.mockRejectedValue(new Error('DB error'));

    const result = await pullTransactions(userId, traceId);

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Error: DB error');
  });

  it('should handle multiple transactions with mixed scenarios', async () => {
    const newCloudTx = createTransaction({
      id: TransactionId('tx-new'),
      updatedAt: '2026-01-15T10:00:00Z',
    });

    const conflictCloudTx = createTransaction({
      id: TransactionId('tx-conflict'),
      updatedAt: '2026-01-15T11:00:00Z', // Cloud newer
      amount: 2000,
    });

    const localNewerTx = createTransaction({
      id: TransactionId('tx-local-newer'),
      updatedAt: '2026-01-15T11:00:00Z', // Local newer
      amount: 3000,
    });

    mockFetchFromCloud.mockResolvedValue([
      newCloudTx,
      conflictCloudTx,
      createTransaction({
        id: TransactionId('tx-local-newer'),
        updatedAt: '2026-01-15T10:00:00Z',
        amount: 2500,
      }),
    ]);

    mockFetchFromLocal.mockResolvedValue([
      createTransaction({
        id: TransactionId('tx-conflict'),
        updatedAt: '2026-01-15T10:00:00Z',
        amount: 1500,
      }),
      localNewerTx,
    ]);

    mockSyncImagesForTransactions.mockResolvedValue({
      synced: 0,
      failed: 0,
      skipped: 0,
    });

    const result = await pullTransactions(userId, traceId);

    expect(result.synced).toBe(2); // newCloudTx + conflictCloudTx
    expect(result.conflicts).toBe(2); // conflictCloudTx + tx-local-newer (both are conflicts)
    expect(result.cloudCount).toBe(3);
    expect(result.localCount).toBe(2);
  });
});
