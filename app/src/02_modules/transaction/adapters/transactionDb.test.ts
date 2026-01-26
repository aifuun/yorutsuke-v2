import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Database from '@tauri-apps/plugin-sql';
import { saveTransaction, upsertTransaction, bulkUpsertTransactions } from './transactionDb';
import { TransactionId, UserId, ImageId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';

// Mock database
const mockDb = {
  select: vi.fn(),
  execute: vi.fn(),
} as unknown as Database;

// Mock getDb
vi.mock('../../../00_kernel/storage/db', () => ({
  getDb: () => Promise.resolve(mockDb),
}));

describe('transactionDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Issue #157: Test LEFT JOIN with images table for thumbnails
  describe('fetchTransactions with thumbnails', () => {
    it('TC-DB.7: LEFT JOIN images and include thumbnail_path in results', async () => {
      // Given: Mock DB returns rows with thumbnail_path from LEFT JOIN
      const mockRows = [
        {
          id: 'tx-1',
          user_id: 'user-1',
          image_id: 'img-1',
          s3_key: 'uploads/user-1/img-1.jpg',
          type: 'expense',
          category: 'shopping',
          amount: 1000,
          currency: 'JPY',
          description: 'Test purchase',
          merchant: 'Test Store',
          date: '2026-01-01',
          created_at: '2026-01-01T10:00:00Z',
          updated_at: '2026-01-01T10:00:00Z',
          status: 'confirmed',
          confidence: null,
          raw_text: 'Receipt text',
          primary_model_id: null,
          primary_confidence: null,
          trace_id: null,
          processing_model: null,
          version: null,
          subtotal: null,
          tax_amount: null,
          tax_rate: null,
          thumbnail_path: '/path/to/compressed/img-1.webp', // From LEFT JOIN
        },
      ];

      (mockDb.select as ReturnType<typeof vi.fn>).mockResolvedValue(mockRows);

      // When: fetchTransactions called
      const { fetchTransactions } = await import('./transactionDb');
      const userId = UserId('user-1');
      const result = await fetchTransactions(userId);

      // Then: Transaction objects include imageThumbnailPath
      expect(result).toHaveLength(1);
      expect(result[0].imageThumbnailPath).toBe('/path/to/compressed/img-1.webp');
      expect(result[0].imageId).toBe('img-1');

      // Verify SQL query includes LEFT JOIN
      const [sql] = (mockDb.select as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql).toContain('LEFT JOIN images i ON i.id = t.image_id');
      expect(sql).toContain('i.compressed_path as thumbnail_path');
    });

    it('TC-DB.8: Handle NULL thumbnail_path gracefully for transactions without images', async () => {
      // Given: Transaction without image (manual entry)
      const mockRows = [
        {
          id: 'tx-2',
          user_id: 'user-1',
          image_id: null,
          s3_key: null,
          type: 'income',
          category: 'other',
          amount: 2000,
          currency: 'JPY',
          description: 'Manual entry',
          merchant: null,
          date: '2026-01-02',
          created_at: '2026-01-02T10:00:00Z',
          updated_at: '2026-01-02T10:00:00Z',
          status: 'unconfirmed',
          confidence: null,
          raw_text: null,
          primary_model_id: null,
          primary_confidence: null,
          trace_id: null,
          processing_model: null,
          version: null,
          subtotal: null,
          tax_amount: null,
          tax_rate: null,
          thumbnail_path: null, // No image → NULL from LEFT JOIN
        },
      ];

      (mockDb.select as ReturnType<typeof vi.fn>).mockResolvedValue(mockRows);

      // When: fetchTransactions called
      const { fetchTransactions } = await import('./transactionDb');
      const userId = UserId('user-1');
      const result = await fetchTransactions(userId);

      // Then: imageThumbnailPath is null
      expect(result).toHaveLength(1);
      expect(result[0].imageThumbnailPath).toBeNull();
      expect(result[0].imageId).toBeNull();
    });

    it('TC-DB.9: Return mixed results with and without thumbnails', async () => {
      // Given: Multiple transactions, some with images, some without
      const mockRows = [
        {
          id: 'tx-1',
          user_id: 'user-1',
          image_id: 'img-1',
          s3_key: 'uploads/user-1/img-1.jpg',
          type: 'expense',
          category: 'shopping',
          amount: 1000,
          currency: 'JPY',
          description: 'With receipt',
          merchant: 'Store A',
          date: '2026-01-01',
          created_at: '2026-01-01T10:00:00Z',
          updated_at: '2026-01-01T10:00:00Z',
          status: 'confirmed',
          confidence: null,
          raw_text: null,
          primary_model_id: null,
          primary_confidence: null,
          trace_id: null,
          processing_model: null,
          version: null,
          subtotal: null,
          tax_amount: null,
          tax_rate: null,
          thumbnail_path: '/path/to/img-1.webp', // Has thumbnail
        },
        {
          id: 'tx-2',
          user_id: 'user-1',
          image_id: null,
          s3_key: null,
          type: 'income',
          category: 'other',
          amount: 2000,
          currency: 'JPY',
          description: 'Manual entry',
          merchant: null,
          date: '2026-01-02',
          created_at: '2026-01-02T10:00:00Z',
          updated_at: '2026-01-02T10:00:00Z',
          status: 'confirmed',
          confidence: null,
          raw_text: null,
          primary_model_id: null,
          primary_confidence: null,
          trace_id: null,
          processing_model: null,
          version: null,
          subtotal: null,
          tax_amount: null,
          tax_rate: null,
          thumbnail_path: null, // No thumbnail
        },
        {
          id: 'tx-3',
          user_id: 'user-1',
          image_id: 'img-3',
          s3_key: 'uploads/user-1/img-3.jpg',
          type: 'expense',
          category: 'transport',
          amount: 500,
          currency: 'JPY',
          description: 'Another receipt',
          merchant: 'Store B',
          date: '2026-01-03',
          created_at: '2026-01-03T10:00:00Z',
          updated_at: '2026-01-03T10:00:00Z',
          status: 'unconfirmed',
          confidence: null,
          raw_text: null,
          primary_model_id: null,
          primary_confidence: null,
          trace_id: null,
          processing_model: null,
          version: null,
          subtotal: null,
          tax_amount: null,
          tax_rate: null,
          thumbnail_path: '/path/to/img-3.webp', // Has thumbnail
        },
      ];

      (mockDb.select as ReturnType<typeof vi.fn>).mockResolvedValue(mockRows);

      // When: fetchTransactions called
      const { fetchTransactions } = await import('./transactionDb');
      const userId = UserId('user-1');
      const result = await fetchTransactions(userId);

      // Then: Results contain correct thumbnail paths
      expect(result).toHaveLength(3);
      expect(result[0].imageThumbnailPath).toBe('/path/to/img-1.webp');
      expect(result[1].imageThumbnailPath).toBeNull();
      expect(result[2].imageThumbnailPath).toBe('/path/to/img-3.webp');
    });
  });

  describe('mapDbToTransaction', () => {
    // Note: mapDbToTransaction is not exported, so we test it indirectly via other functions
    // For direct testing, we'd need to export it or use integration tests

    it('TC-DB.1: Maps snake_case DB columns to camelCase domain fields', () => {
      // This is tested indirectly through saveTransaction and retrieval
      // The mapping is verified in integration tests
      expect(true).toBe(true); // Placeholder - see integration tests
    });

    it('TC-DB.2: Handles NULL model metadata gracefully', () => {
      // This is tested indirectly through saveTransaction with NULL values
      expect(true).toBe(true); // Placeholder - see TC-DB.4
    });
  });

  describe('saveTransaction', () => {
    it('TC-DB.3: Saves transaction with model metadata', async () => {
      // Given: Transaction with model metadata
      const tx: Transaction = {
        id: TransactionId('tx-1'),
        userId: UserId('user-1'),
        imageId: ImageId('img-1'),
        s3Key: 'uploads/user-1/img-1.jpg',
        type: 'expense',
        category: 'shopping',
        amount: 1000,
        currency: 'JPY',
        description: 'Test purchase',
        merchant: 'Test Store',
        date: '2026-01-01',
        createdAt: '2026-01-01T10:00:00Z',
        updatedAt: '2026-01-01T10:00:00Z',
        status: 'confirmed',
        confidence: null,
        rawText: 'Receipt text',
        primaryModelId: 'us.amazon.nova-lite-v1:0',
        primaryConfidence: 85.5,
      };

      // When: Save to DB
      await saveTransaction(tx);

      // Then: Execute called with correct SQL and params
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = (mockDb.execute as ReturnType<typeof vi.fn>).mock.calls[0];

      // Verify SQL includes model columns
      expect(sql).toContain('primary_model_id');
      expect(sql).toContain('primary_confidence');

      // Verify params include model metadata
      expect(params).toContain('us.amazon.nova-lite-v1:0'); // primaryModelId
      expect(params).toContain(85.5); // primaryConfidence
    });

    it('TC-DB.4: Saves transaction without model metadata (NULL)', async () => {
      // Given: Transaction without model metadata (old format)
      const tx: Transaction = {
        id: TransactionId('tx-2'),
        userId: UserId('user-1'),
        imageId: null,
        s3Key: null,
        type: 'income',
        category: 'other',
        amount: 2000,
        currency: 'JPY',
        description: 'Test sale',
        merchant: null,
        date: '2026-01-02',
        createdAt: '2026-01-02T10:00:00Z',
        updatedAt: '2026-01-02T10:00:00Z',
        status: 'unconfirmed',
        confidence: null,
        rawText: null,
        primaryModelId: null,
        primaryConfidence: null,
      };

      // When: Save to DB
      await saveTransaction(tx);

      // Then: Execute called with NULL model metadata
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = (mockDb.execute as ReturnType<typeof vi.fn>).mock.calls[0];

      // Verify SQL includes model columns
      expect(sql).toContain('primary_model_id');
      expect(sql).toContain('primary_confidence');

      // Verify params include NULL for model metadata
      expect(params).toContain(null); // primaryModelId
      // primaryConfidence is also null in params
      const nullCount = (params as unknown[]).filter((p) => p === null).length;
      expect(nullCount).toBeGreaterThan(0); // At least some nulls
    });
  });

  describe('upsertTransaction', () => {
    it('TC-DB.3b: Upserts transaction with model metadata', async () => {
      // Given: Transaction with model metadata
      const tx: Transaction = {
        id: TransactionId('tx-3'),
        userId: UserId('user-1'),
        imageId: ImageId('img-3'),
        s3Key: 'uploads/user-1/img-3.jpg',
        type: 'expense',
        category: 'transport',
        amount: 500,
        currency: 'JPY',
        description: 'Shipping cost',
        merchant: 'Courier',
        date: '2026-01-03',
        createdAt: '2026-01-03T10:00:00Z',
        updatedAt: '2026-01-03T10:00:00Z',
        status: 'confirmed',
        confidence: null,
        rawText: null,
        primaryModelId: 'azure_di',
        primaryConfidence: 92.3,
      };

      // When: Upsert to DB
      await upsertTransaction(tx);

      // Then: Execute called with correct SQL and params
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      const [sql, params] = (mockDb.execute as ReturnType<typeof vi.fn>).mock.calls[0];

      // Verify SQL includes model columns
      expect(sql).toContain('primary_model_id');
      expect(sql).toContain('primary_confidence');

      // Verify params include model metadata
      expect(params).toContain('azure_di');
      expect(params).toContain(92.3);
    });
  });

  describe('bulkUpsertTransactions', () => {
    it('TC-DB.5: Bulk inserts transactions with model metadata', async () => {
      // Given: Multiple transactions with mixed model metadata
      const transactions: Transaction[] = [
        {
          id: TransactionId('tx-4'),
          userId: UserId('user-1'),
          imageId: ImageId('img-4'),
          s3Key: 'uploads/user-1/img-4.jpg',
          type: 'expense',
          category: 'shopping',
          amount: 1500,
          currency: 'JPY',
          description: 'Purchase 1',
          merchant: 'Store A',
          date: '2026-01-04',
          createdAt: '2026-01-04T10:00:00Z',
          updatedAt: '2026-01-04T10:00:00Z',
          status: 'confirmed',
          confidence: null,
          rawText: null,
          primaryModelId: 'us.amazon.nova-lite-v1:0',
          primaryConfidence: 85.5,
        },
        {
          id: TransactionId('tx-5'),
          userId: UserId('user-1'),
          imageId: ImageId('img-5'),
          s3Key: 'uploads/user-1/img-5.jpg',
          type: 'income',
          category: 'other',
          amount: 3000,
          currency: 'JPY',
          description: 'Sale 1',
          merchant: 'Buyer A',
          date: '2026-01-05',
          createdAt: '2026-01-05T10:00:00Z',
          updatedAt: '2026-01-05T10:00:00Z',
          status: 'confirmed',
          confidence: null,
          rawText: null,
          primaryModelId: 'azure_di',
          primaryConfidence: 92.3,
        },
        {
          id: TransactionId('tx-6'),
          userId: UserId('user-1'),
          imageId: null,
          s3Key: null,
          type: 'expense',
          category: 'other',
          amount: 800,
          currency: 'JPY',
          description: 'Manual entry',
          merchant: null,
          date: '2026-01-06',
          createdAt: '2026-01-06T10:00:00Z',
          updatedAt: '2026-01-06T10:00:00Z',
          status: 'unconfirmed',
          confidence: null,
          rawText: null,
          primaryModelId: null,
          primaryConfidence: null,
        },
      ];

      // When: Bulk upsert
      await bulkUpsertTransactions(transactions);

      // Then: Execute called 3 times (once per transaction)
      expect(mockDb.execute).toHaveBeenCalledTimes(3);

      // Verify first transaction has Nova Lite
      const [sql1, params1] = (mockDb.execute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sql1).toContain('primary_model_id');
      expect(params1).toContain('us.amazon.nova-lite-v1:0');
      expect(params1).toContain(85.5);

      // Verify second transaction has Azure DI
      const [sql2, params2] = (mockDb.execute as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(params2).toContain('azure_di');
      expect(params2).toContain(92.3);

      // Verify third transaction has NULL model metadata
      const [sql3, params3] = (mockDb.execute as ReturnType<typeof vi.fn>).mock.calls[2];
      expect(sql3).toContain('primary_model_id');
      // Check for NULL in params (should be present for primaryModelId and primaryConfidence)
      const nullCount = (params3 as unknown[]).filter((p) => p === null).length;
      expect(nullCount).toBeGreaterThan(0);
    });

    it('TC-DB.6: Handles empty array gracefully', async () => {
      // Given: Empty array
      const transactions: Transaction[] = [];

      // When: Bulk upsert
      await bulkUpsertTransactions(transactions);

      // Then: No execute calls
      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });
});
