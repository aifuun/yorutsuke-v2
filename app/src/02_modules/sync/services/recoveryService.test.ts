/**
 * Recovery Service Tests (Issue #86)
 * Tests startup recovery detection and cleanup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recoveryService } from './recoveryService';
import type { Transaction } from '../../../01_domains/transaction';
import { TransactionId, UserId, ImageId } from '../../../00_kernel/types';

// Mock dependencies
const mockFetchDirtyTransactions = vi.fn();
const mockClearDirtyFlags = vi.fn();

// Mock transactionDb
vi.mock('../../transaction/adapters/transactionDb', () => ({
  fetchDirtyTransactions: (...args: unknown[]) => mockFetchDirtyTransactions(...args),
  clearDirtyFlags: (...args: unknown[]) => mockClearDirtyFlags(...args),
}));

// Mock syncStore
const mockGetQueue = vi.fn((): unknown[] => []);
const mockClearQueue = vi.fn();
const mockGetLastSyncedAt = vi.fn((): string | null => null);

vi.mock('../stores/syncStore', () => ({
  syncStore: {
    getState: () => ({
      queue: mockGetQueue(),
      clearQueue: mockClearQueue,
      lastSyncedAt: mockGetLastSyncedAt(),
    }),
  },
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
  confirmedAt: null,
  confidence: null,
  rawText: null,
  ...overrides,
});

describe('recoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRecoveryStatus', () => {
    const userId = UserId('user-1');

    it('should return no recovery needed if userId is null', async () => {
      const result = await recoveryService.checkRecoveryStatus(null);

      expect(result).toEqual({
        needsRecovery: false,
        dirtyCount: 0,
        queueCount: 0,
        lastSyncedAt: null,
      });
      expect(mockFetchDirtyTransactions).not.toHaveBeenCalled();
    });

    it('should detect no recovery needed when clean', async () => {
      mockFetchDirtyTransactions.mockResolvedValue([]);
      mockGetQueue.mockReturnValue([]);
      mockGetLastSyncedAt.mockReturnValue('2026-01-15T10:00:00Z');

      const result = await recoveryService.checkRecoveryStatus(userId);

      expect(result).toEqual({
        needsRecovery: false,
        dirtyCount: 0,
        queueCount: 0,
        lastSyncedAt: '2026-01-15T10:00:00Z',
      });
    });

    it('should detect recovery needed with dirty transactions', async () => {
      const dirtyTx1 = createTransaction({ id: TransactionId('tx-1') });
      const dirtyTx2 = createTransaction({ id: TransactionId('tx-2') });

      mockFetchDirtyTransactions.mockResolvedValue([dirtyTx1, dirtyTx2]);
      mockGetQueue.mockReturnValue([]);
      mockGetLastSyncedAt.mockReturnValue('2026-01-15T10:00:00Z');

      const result = await recoveryService.checkRecoveryStatus(userId);

      expect(result).toEqual({
        needsRecovery: true,
        dirtyCount: 2,
        queueCount: 0,
        lastSyncedAt: '2026-01-15T10:00:00Z',
      });
    });

    it('should detect recovery needed with queued items', async () => {
      const queueItem = {
        id: 'sync-tx-1-123',
        type: 'update' as const,
        transactionId: TransactionId('tx-1'),
        timestamp: '2026-01-15T10:00:00Z',
        payload: createTransaction(),
      };

      mockFetchDirtyTransactions.mockResolvedValue([]);
      mockGetQueue.mockReturnValue([queueItem]);
      mockGetLastSyncedAt.mockReturnValue('2026-01-15T10:00:00Z');

      const result = await recoveryService.checkRecoveryStatus(userId);

      expect(result).toEqual({
        needsRecovery: true,
        dirtyCount: 0,
        queueCount: 1,
        lastSyncedAt: '2026-01-15T10:00:00Z',
      });
    });

    it('should detect recovery needed with both dirty and queued', async () => {
      const dirtyTx = createTransaction({ id: TransactionId('tx-1') });
      const queueItem = {
        id: 'sync-tx-2-456',
        type: 'update' as const,
        transactionId: TransactionId('tx-2'),
        timestamp: '2026-01-15T10:00:00Z',
        payload: createTransaction(),
      };

      mockFetchDirtyTransactions.mockResolvedValue([dirtyTx]);
      mockGetQueue.mockReturnValue([queueItem]);
      mockGetLastSyncedAt.mockReturnValue(null);

      const result = await recoveryService.checkRecoveryStatus(userId);

      expect(result).toEqual({
        needsRecovery: true,
        dirtyCount: 1,
        queueCount: 1,
        lastSyncedAt: null,
      });
    });

    it('should handle database errors gracefully', async () => {
      mockFetchDirtyTransactions.mockRejectedValue(new Error('DB error'));

      const result = await recoveryService.checkRecoveryStatus(userId);

      expect(result).toEqual({
        needsRecovery: false,
        dirtyCount: 0,
        queueCount: 0,
        lastSyncedAt: null,
      });
    });
  });

  describe('clearPendingData', () => {
    const userId = UserId('user-1');

    it('should clear dirty flags and queue', async () => {
      const dirtyTx1 = createTransaction({ id: TransactionId('tx-1') });
      const dirtyTx2 = createTransaction({ id: TransactionId('tx-2') });

      mockFetchDirtyTransactions.mockResolvedValue([dirtyTx1, dirtyTx2]);

      await recoveryService.clearPendingData(userId);

      expect(mockClearDirtyFlags).toHaveBeenCalledWith(['tx-1', 'tx-2']);
      expect(mockClearQueue).toHaveBeenCalled();
    });

    it('should clear queue even if no dirty transactions', async () => {
      mockFetchDirtyTransactions.mockResolvedValue([]);

      await recoveryService.clearPendingData(userId);

      expect(mockClearDirtyFlags).not.toHaveBeenCalled();
      expect(mockClearQueue).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockFetchDirtyTransactions.mockRejectedValue(new Error('DB error'));

      await expect(
        recoveryService.clearPendingData(userId)
      ).rejects.toThrow('DB error');

      expect(mockClearQueue).not.toHaveBeenCalled(); // Not called due to error
    });

    it('should handle clearDirtyFlags errors', async () => {
      const dirtyTx = createTransaction({ id: TransactionId('tx-1') });
      mockFetchDirtyTransactions.mockResolvedValue([dirtyTx]);
      mockClearDirtyFlags.mockRejectedValue(new Error('Clear failed'));

      await expect(
        recoveryService.clearPendingData(userId)
      ).rejects.toThrow('Clear failed');
    });
  });
});
