import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageId, UserId } from '../../../00_kernel/types';

// Mock select and execute functions
const mockSelect = vi.fn();
const mockExecute = vi.fn();

// Mock storage module
vi.mock('../../../00_kernel/storage', () => ({
  select: (...args: unknown[]) => mockSelect(...args),
  execute: (...args: unknown[]) => mockExecute(...args),
}));

// Mock logger
vi.mock('../../../00_kernel/telemetry', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  EVENTS: {
    QUOTA_CHECKED: 'QUOTA_CHECKED',
    IMAGE_DUPLICATE: 'IMAGE_DUPLICATE',
    IMAGE_SAVED: 'IMAGE_SAVED',
    STATE_TRANSITION: 'STATE_TRANSITION',
    IMAGE_CLEANUP: 'IMAGE_CLEANUP',
    QUEUE_RESTORED: 'QUEUE_RESTORED',
    DATA_MIGRATED: 'DATA_MIGRATED',
  },
}));

describe('imageDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Issue #157: Test LEFT JOIN with transactions table
  describe('loadRecentImagesWithTransactions', () => {
    it('TC-IMG.1: LEFT JOIN transactions and include transaction fields', async () => {
      // Given: Mock DB returns images with transaction data from LEFT JOIN
      const mockRows = [
        {
          // Image fields
          id: 'img-1',
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 2000000,
          compressed_size: 150000,
          width: 1920,
          height: 1080,
          md5: 'abc123',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-1.jpg',
          uploaded_at: '2026-01-01T10:00:00Z',
          created_at: '2026-01-01T09:00:00Z',
          // Transaction fields from LEFT JOIN
          transaction_id: 'tx-1',
          transaction_merchant: 'Test Store',
          transaction_amount: 1000,
          transaction_status: 'confirmed',
        },
      ];

      mockSelect.mockResolvedValue(mockRows);

      // When: loadRecentImagesWithTransactions called
      const { loadRecentImagesWithTransactions } = await import('./imageDb');
      const userId = UserId('user-1');
      const result = await loadRecentImagesWithTransactions(userId, 50);

      // Then: Results include transaction data
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('img-1');
      expect(result[0].transaction_id).toBe('tx-1');
      expect(result[0].transaction_merchant).toBe('Test Store');
      expect(result[0].transaction_amount).toBe(1000);
      expect(result[0].transaction_status).toBe('confirmed');

      // Verify SQL query includes LEFT JOIN
      const [sql, params] = mockSelect.mock.calls[0];
      expect(sql).toContain('LEFT JOIN transactions t ON t.image_id = i.id');
      expect(sql).toContain('t.id as transaction_id');
      expect(sql).toContain('t.merchant as transaction_merchant');
      expect(sql).toContain('t.amount as transaction_amount');
      expect(sql).toContain('t.status as transaction_status');
      expect(params).toEqual(['user-1', 50]);
    });

    it('TC-IMG.2: Handle NULL transaction fields for images without transactions', async () => {
      // Given: Image without transaction (uploaded but not processed yet)
      const mockRows = [
        {
          // Image fields
          id: 'img-2',
          user_id: 'user-1',
          trace_id: 'trace-2',
          intent_id: null,
          original_path: '/path/to/original2.jpg',
          original_name: 'receipt2.jpg',
          compressed_path: '/path/to/compressed2.webp',
          original_size: 1500000,
          compressed_size: 120000,
          width: 1920,
          height: 1080,
          md5: 'def456',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-2.jpg',
          uploaded_at: '2026-01-02T10:00:00Z',
          created_at: '2026-01-02T09:00:00Z',
          // Transaction fields are NULL (no transaction created yet)
          transaction_id: null,
          transaction_merchant: null,
          transaction_amount: null,
          transaction_status: null,
        },
      ];

      mockSelect.mockResolvedValue(mockRows);

      // When: loadRecentImagesWithTransactions called
      const { loadRecentImagesWithTransactions } = await import('./imageDb');
      const userId = UserId('user-1');
      const result = await loadRecentImagesWithTransactions(userId, 50);

      // Then: Transaction fields are null
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('img-2');
      expect(result[0].transaction_id).toBeNull();
      expect(result[0].transaction_merchant).toBeNull();
      expect(result[0].transaction_amount).toBeNull();
      expect(result[0].transaction_status).toBeNull();
    });

    it('TC-IMG.3: Return mixed results with and without transactions', async () => {
      // Given: Multiple images, some with transactions, some without
      const mockRows = [
        {
          // Image 1: Has transaction
          id: 'img-1',
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 2000000,
          compressed_size: 150000,
          width: 1920,
          height: 1080,
          md5: 'abc123',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-1.jpg',
          uploaded_at: '2026-01-01T10:00:00Z',
          created_at: '2026-01-01T09:00:00Z',
          transaction_id: 'tx-1',
          transaction_merchant: 'Store A',
          transaction_amount: 1000,
          transaction_status: 'confirmed',
        },
        {
          // Image 2: No transaction (processing)
          id: 'img-2',
          user_id: 'user-1',
          trace_id: 'trace-2',
          intent_id: null,
          original_path: '/path/to/original2.jpg',
          original_name: 'receipt2.jpg',
          compressed_path: '/path/to/compressed2.webp',
          original_size: 1500000,
          compressed_size: 120000,
          width: 1920,
          height: 1080,
          md5: 'def456',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-2.jpg',
          uploaded_at: '2026-01-02T10:00:00Z',
          created_at: '2026-01-02T09:00:00Z',
          transaction_id: null,
          transaction_merchant: null,
          transaction_amount: null,
          transaction_status: null,
        },
        {
          // Image 3: Has transaction (unconfirmed)
          id: 'img-3',
          user_id: 'user-1',
          trace_id: 'trace-3',
          intent_id: null,
          original_path: '/path/to/original3.jpg',
          original_name: 'receipt3.jpg',
          compressed_path: '/path/to/compressed3.webp',
          original_size: 1800000,
          compressed_size: 140000,
          width: 1920,
          height: 1080,
          md5: 'ghi789',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-3.jpg',
          uploaded_at: '2026-01-03T10:00:00Z',
          created_at: '2026-01-03T09:00:00Z',
          transaction_id: 'tx-3',
          transaction_merchant: 'Store B',
          transaction_amount: 500,
          transaction_status: 'unconfirmed',
        },
      ];

      mockSelect.mockResolvedValue(mockRows);

      // When: loadRecentImagesWithTransactions called
      const { loadRecentImagesWithTransactions } = await import('./imageDb');
      const userId = UserId('user-1');
      const result = await loadRecentImagesWithTransactions(userId, 50);

      // Then: Results contain correct transaction data
      expect(result).toHaveLength(3);

      // Image 1: Has confirmed transaction
      expect(result[0].id).toBe('img-1');
      expect(result[0].transaction_id).toBe('tx-1');
      expect(result[0].transaction_status).toBe('confirmed');

      // Image 2: No transaction (processing)
      expect(result[1].id).toBe('img-2');
      expect(result[1].transaction_id).toBeNull();

      // Image 3: Has unconfirmed transaction
      expect(result[2].id).toBe('img-3');
      expect(result[2].transaction_id).toBe('tx-3');
      expect(result[2].transaction_status).toBe('unconfirmed');
    });

    it('TC-IMG.4: Respect limit parameter correctly', async () => {
      // Given: More images than limit
      const mockRows = Array.from({ length: 20 }, (_, i) => ({
        id: `img-${i + 1}`,
        user_id: 'user-1',
        trace_id: `trace-${i + 1}`,
        intent_id: null,
        original_path: `/path/to/original${i + 1}.jpg`,
        original_name: `receipt${i + 1}.jpg`,
        compressed_path: `/path/to/compressed${i + 1}.webp`,
        original_size: 2000000,
        compressed_size: 150000,
        width: 1920,
        height: 1080,
        md5: `hash${i + 1}`,
        status: 'uploaded',
        s3_key: `uploads/user-1/img-${i + 1}.jpg`,
        uploaded_at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        created_at: `2026-01-${String(i + 1).padStart(2, '0')}T09:00:00Z`,
        transaction_id: `tx-${i + 1}`,
        transaction_merchant: 'Store',
        transaction_amount: 1000 + i * 100,
        transaction_status: 'confirmed',
      }));

      mockSelect.mockResolvedValue(mockRows);

      // When: loadRecentImagesWithTransactions called with limit=20
      const { loadRecentImagesWithTransactions } = await import('./imageDb');
      const userId = UserId('user-1');
      const result = await loadRecentImagesWithTransactions(userId, 20);

      // Then: Returns exactly 20 images
      expect(result).toHaveLength(20);

      // Verify SQL includes LIMIT parameter
      const [sql, params] = mockSelect.mock.calls[0];
      expect(sql).toContain('LIMIT ?');
      expect(params).toEqual(['user-1', 20]);
    });

    it('TC-IMG.5: Order by created_at DESC (most recent first)', async () => {
      // Given: Multiple images
      const mockRows = [
        {
          id: 'img-3',
          created_at: '2026-01-03T09:00:00Z', // Most recent
          user_id: 'user-1',
          trace_id: 'trace-3',
          intent_id: null,
          original_path: '/path/to/original3.jpg',
          original_name: 'receipt3.jpg',
          compressed_path: '/path/to/compressed3.webp',
          original_size: 2000000,
          compressed_size: 150000,
          width: 1920,
          height: 1080,
          md5: 'hash3',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-3.jpg',
          uploaded_at: '2026-01-03T10:00:00Z',
          transaction_id: 'tx-3',
          transaction_merchant: 'Store C',
          transaction_amount: 1500,
          transaction_status: 'confirmed',
        },
        {
          id: 'img-1',
          created_at: '2026-01-01T09:00:00Z', // Oldest
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 2000000,
          compressed_size: 150000,
          width: 1920,
          height: 1080,
          md5: 'hash1',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-1.jpg',
          uploaded_at: '2026-01-01T10:00:00Z',
          transaction_id: 'tx-1',
          transaction_merchant: 'Store A',
          transaction_amount: 1000,
          transaction_status: 'confirmed',
        },
      ];

      mockSelect.mockResolvedValue(mockRows);

      // When: loadRecentImagesWithTransactions called
      const { loadRecentImagesWithTransactions } = await import('./imageDb');
      const userId = UserId('user-1');
      const result = await loadRecentImagesWithTransactions(userId, 50);

      // Then: Results are ordered by created_at DESC
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('img-3'); // Most recent
      expect(result[1].id).toBe('img-1'); // Oldest

      // Verify SQL includes ORDER BY
      const [sql] = mockSelect.mock.calls[0];
      expect(sql).toContain('ORDER BY i.created_at DESC');
    });

    it('TC-IMG.6: Use default limit of 50 when not specified', async () => {
      // Given: Mock DB
      mockSelect.mockResolvedValue([]);

      // When: loadRecentImagesWithTransactions called without limit parameter
      const { loadRecentImagesWithTransactions } = await import('./imageDb');
      const userId = UserId('user-1');
      await loadRecentImagesWithTransactions(userId);

      // Then: Default limit of 50 is used
      const [sql, params] = mockSelect.mock.calls[0];
      expect(sql).toContain('LIMIT ?');
      expect(params).toEqual(['user-1', 50]);
    });
  });
});
