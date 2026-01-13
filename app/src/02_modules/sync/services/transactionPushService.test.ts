/**
 * Transaction Push Service Tests (Issue #86)
 * Tests push sync (Local → Cloud) with offline queue
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transactionPushService } from './transactionPushService';
import type { Transaction } from '../../../01_domains/transaction';
import { TransactionId, UserId, ImageId, TraceId } from '../../../00_kernel/types';

// Mock dependencies
const mockFetchDirtyTransactions = vi.fn();
const mockClearDirtyFlags = vi.fn();
const mockSyncTransactions = vi.fn();
const mockGetStatus = vi.fn();

// Mock transactionDb
vi.mock('../../transaction/adapters/transactionDb', () => ({
  fetchDirtyTransactions: (...args: unknown[]) => mockFetchDirtyTransactions(...args),
  clearDirtyFlags: (...args: unknown[]) => mockClearDirtyFlags(...args),
}));

// Mock transactionApi
vi.mock('../../transaction/adapters/transactionApi', () => ({
  syncTransactions: (...args: unknown[]) => mockSyncTransactions(...args),
}));

// Mock networkMonitor
vi.mock('../utils/networkMonitor', () => ({
  networkMonitor: {
    getStatus: () => mockGetStatus(),
  },
}));

// Mock syncStore
const mockSetSyncStatus = vi.fn();
const mockSetLastSyncedAt = vi.fn();
const mockSetLastError = vi.fn();
const mockAddToQueue = vi.fn();
const mockRemoveFromQueue = vi.fn();
const mockClearQueue = vi.fn();
const mockGetQueue = vi.fn((): unknown[] => []);

vi.mock('../stores/syncStore', () => ({
  syncStore: {
    getState: () => ({
      setSyncStatus: mockSetSyncStatus,
      setLastSyncedAt: mockSetLastSyncedAt,
      setLastError: mockSetLastError,
      addToQueue: mockAddToQueue,
      removeFromQueue: mockRemoveFromQueue,
      clearQueue: mockClearQueue,
      queue: mockGetQueue(),
    }),
  },
}));

// Mock logger
vi.mock('../../../00_kernel/telemetry/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
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

describe('transactionPushService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncDirtyTransactions', () => {
    const userId = UserId('user-1');
    const traceId = TraceId('test-trace-id');

    it('should return early if no dirty transactions', async () => {
      mockFetchDirtyTransactions.mockResolvedValue([]);

      const result = await transactionPushService.syncDirtyTransactions(userId, traceId);

      expect(result).toEqual({ synced: 0, failed: [], queued: 0 });
      expect(mockSyncTransactions).not.toHaveBeenCalled();
    });

    it('should queue transactions when offline', async () => {
      const dirtyTx = createTransaction({ id: TransactionId('tx-1') });
      mockFetchDirtyTransactions.mockResolvedValue([dirtyTx]);
      mockGetStatus.mockReturnValue(false); // Offline

      const result = await transactionPushService.syncDirtyTransactions(userId, traceId);

      expect(result.synced).toBe(0);
      expect(result.queued).toBe(1);
      expect(mockAddToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update',
          transactionId: 'tx-1',
          payload: dirtyTx,
        })
      );
      expect(mockSyncTransactions).not.toHaveBeenCalled();
    });

    it('should sync transactions when online', async () => {
      const dirtyTx1 = createTransaction({ id: TransactionId('tx-1') });
      const dirtyTx2 = createTransaction({ id: TransactionId('tx-2') });
      mockFetchDirtyTransactions.mockResolvedValue([dirtyTx1, dirtyTx2]);
      mockGetStatus.mockReturnValue(true); // Online
      mockSyncTransactions.mockResolvedValue({
        synced: 2,
        failed: [],
      });

      const result = await transactionPushService.syncDirtyTransactions(userId, traceId);

      expect(result.synced).toBe(2);
      expect(result.failed).toEqual([]);
      expect(result.queued).toBe(0);
      expect(mockSyncTransactions).toHaveBeenCalledWith(userId, [dirtyTx1, dirtyTx2]);
      expect(mockClearDirtyFlags).toHaveBeenCalledWith(['tx-1', 'tx-2']);
      expect(mockSetSyncStatus).toHaveBeenCalledWith('success');
    });

    it('should handle partial sync failure', async () => {
      const dirtyTx1 = createTransaction({ id: TransactionId('tx-1') });
      const dirtyTx2 = createTransaction({ id: TransactionId('tx-2') });
      mockFetchDirtyTransactions.mockResolvedValue([dirtyTx1, dirtyTx2]);
      mockGetStatus.mockReturnValue(true);
      mockSyncTransactions.mockResolvedValue({
        synced: 1,
        failed: ['tx-2'],
      });

      const result = await transactionPushService.syncDirtyTransactions(userId, traceId);

      expect(result.synced).toBe(1);
      expect(result.failed).toEqual([TransactionId('tx-2')]);
      expect(result.queued).toBe(1); // Failed transaction queued
      expect(mockClearDirtyFlags).toHaveBeenCalledWith(['tx-1']); // Only synced
      expect(mockAddToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'tx-2',
        })
      );
    });

    it('should handle complete sync failure', async () => {
      const dirtyTx = createTransaction({ id: TransactionId('tx-1') });
      mockFetchDirtyTransactions.mockResolvedValue([dirtyTx]);
      mockGetStatus.mockReturnValue(true);
      mockSyncTransactions.mockRejectedValue(new Error('Network error'));

      await expect(
        transactionPushService.syncDirtyTransactions(userId, traceId)
      ).rejects.toThrow('Network error');

      expect(mockSetSyncStatus).toHaveBeenCalledWith('error');
      // Note: No longer re-queues on failure - dirty flags remain for next sync
      expect(mockAddToQueue).not.toHaveBeenCalled();
    });

    it('should update lastSyncedAt on success', async () => {
      const dirtyTx = createTransaction({ id: TransactionId('tx-1') });
      mockFetchDirtyTransactions.mockResolvedValue([dirtyTx]);
      mockGetStatus.mockReturnValue(true);
      mockSyncTransactions.mockResolvedValue({
        synced: 1,
        failed: [],
      });

      await transactionPushService.syncDirtyTransactions(userId, traceId);

      expect(mockSetLastSyncedAt).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });
  });

  describe('processQueue', () => {
    const userId = UserId('user-1');
    const traceId = TraceId('test-trace-id');

    it('should return early if queue is empty', async () => {
      mockGetQueue.mockReturnValue([]);

      await transactionPushService.processQueue(userId, traceId);

      // Should not clear queue if already empty
      expect(mockClearQueue).not.toHaveBeenCalled();
    });

    it('should clear queue immediately to prevent re-queueing loop', async () => {
      const queueAction = {
        id: 'sync-tx-1-123',
        type: 'update' as const,
        transactionId: TransactionId('tx-1'),
        timestamp: '2026-01-15T10:00:00Z',
        payload: createTransaction(),
      };

      mockGetQueue.mockReturnValue([queueAction]);

      await transactionPushService.processQueue(userId, traceId);

      // Queue should be cleared immediately (not processed individually)
      expect(mockClearQueue).toHaveBeenCalled();
    });
  });

  describe('clearQueue', () => {
    it('should clear the sync queue', () => {
      transactionPushService.clearQueue();

      expect(mockClearQueue).toHaveBeenCalled();
    });
  });
});
