/**
 * Transaction Sync Adapter Tests
 * Verifies adapter correctly delegates to underlying transaction adapters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserId, TransactionId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import * as transactionSyncAdapter from './transactionSyncAdapter';

// Mock transaction module adapters
vi.mock('../../transaction/adapters/transactionDb', () => ({
  fetchDirtyTransactions: vi.fn(),
  clearDirtyFlags: vi.fn(),
}));

vi.mock('../../transaction/adapters/transactionApi', () => ({
  syncTransactions: vi.fn(),
}));

vi.mock('../../transaction/adapters', () => ({
  fetchTransactionsFromCloud: vi.fn(),
  fetchTransactions: vi.fn(),
  upsertTransaction: vi.fn(),
  checkFileExists: vi.fn(),
}));

import * as transactionDb from '../../transaction/adapters/transactionDb';
import * as transactionApi from '../../transaction/adapters/transactionApi';
import * as transactionAdapters from '../../transaction/adapters';

describe('transactionSyncAdapter', () => {
  const mockUserId = UserId('user-123');
  const mockTransactionId = TransactionId('txn-456');

  const mockTransaction: Transaction = {
    id: mockTransactionId,
    userId: mockUserId,
    date: '2026-01-22',
    amount: 1000,
    merchant: 'Test Store',
    category: 'groceries',
    status: 'confirmed',
    isDirty: false,
    createdAt: '2026-01-22T10:00:00.000Z',
    updatedAt: '2026-01-22T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchDirtyTransactions', () => {
    it('should delegate to transactionDb.fetchDirtyTransactions', async () => {
      const mockDirtyTxs = [mockTransaction];
      vi.mocked(transactionDb.fetchDirtyTransactions).mockResolvedValue(mockDirtyTxs);

      const result = await transactionSyncAdapter.fetchDirtyTransactions(mockUserId);

      expect(transactionDb.fetchDirtyTransactions).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockDirtyTxs);
    });
  });

  describe('clearDirtyFlags', () => {
    it('should delegate to transactionDb.clearDirtyFlags', async () => {
      const mockIds = [mockTransactionId];
      vi.mocked(transactionDb.clearDirtyFlags).mockResolvedValue();

      await transactionSyncAdapter.clearDirtyFlags(mockIds);

      expect(transactionDb.clearDirtyFlags).toHaveBeenCalledWith(mockIds);
    });
  });

  describe('syncTransactionsToCloud', () => {
    it('should delegate to transactionApi.syncTransactions', async () => {
      const mockResult = { synced: 1, failed: [] };
      vi.mocked(transactionApi.syncTransactions).mockResolvedValue(mockResult);

      const result = await transactionSyncAdapter.syncTransactionsToCloud(
        mockUserId,
        [mockTransaction]
      );

      expect(transactionApi.syncTransactions).toHaveBeenCalledWith(mockUserId, [mockTransaction]);
      expect(result).toEqual(mockResult);
    });
  });

  describe('fetchTransactionsFromCloud', () => {
    it('should delegate to fetchTransactionsFromCloud with date filters', async () => {
      const mockTxs = [mockTransaction];
      vi.mocked(transactionAdapters.fetchTransactionsFromCloud).mockResolvedValue(mockTxs);

      const result = await transactionSyncAdapter.fetchTransactionsFromCloud(
        mockUserId,
        '2026-01-01',
        '2026-01-31'
      );

      expect(transactionAdapters.fetchTransactionsFromCloud).toHaveBeenCalledWith(
        mockUserId,
        '2026-01-01',
        '2026-01-31'
      );
      expect(result).toEqual(mockTxs);
    });

    it('should work without date filters', async () => {
      const mockTxs = [mockTransaction];
      vi.mocked(transactionAdapters.fetchTransactionsFromCloud).mockResolvedValue(mockTxs);

      const result = await transactionSyncAdapter.fetchTransactionsFromCloud(mockUserId);

      expect(transactionAdapters.fetchTransactionsFromCloud).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        undefined
      );
      expect(result).toEqual(mockTxs);
    });
  });

  describe('fetchLocalTransactions', () => {
    it('should delegate to fetchTransactions with options', async () => {
      const mockTxs = [mockTransaction];
      vi.mocked(transactionAdapters.fetchTransactions).mockResolvedValue(mockTxs);

      const options = { startDate: '2026-01-01', includeDeleted: true };
      const result = await transactionSyncAdapter.fetchLocalTransactions(mockUserId, options);

      expect(transactionAdapters.fetchTransactions).toHaveBeenCalledWith(mockUserId, options);
      expect(result).toEqual(mockTxs);
    });

    it('should work with empty options', async () => {
      const mockTxs = [mockTransaction];
      vi.mocked(transactionAdapters.fetchTransactions).mockResolvedValue(mockTxs);

      const result = await transactionSyncAdapter.fetchLocalTransactions(mockUserId);

      expect(transactionAdapters.fetchTransactions).toHaveBeenCalledWith(mockUserId, {});
      expect(result).toEqual(mockTxs);
    });
  });

  describe('upsertLocalTransaction', () => {
    it('should delegate to upsertTransaction', async () => {
      vi.mocked(transactionAdapters.upsertTransaction).mockResolvedValue();

      await transactionSyncAdapter.upsertLocalTransaction(mockTransaction);

      expect(transactionAdapters.upsertTransaction).toHaveBeenCalledWith(mockTransaction);
    });
  });

  describe('checkFileExists', () => {
    it('should delegate to checkFileExists', async () => {
      const mockPath = '/path/to/file.jpg';
      vi.mocked(transactionAdapters.checkFileExists).mockResolvedValue(true);

      const result = await transactionSyncAdapter.checkFileExists(mockPath);

      expect(transactionAdapters.checkFileExists).toHaveBeenCalledWith(mockPath);
      expect(result).toBe(true);
    });
  });
});
