import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTransactions } from './transactionApi';
import { UserId } from '../../../00_kernel/types';

// Mock Tauri fetch
const mockFetch = vi.fn();
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

// Mock config
let mockOnline = false;
let mockOffline = false;
vi.mock('../../../00_kernel/config/mock', () => ({
  isMockingOnline: () => mockOnline,
  isMockingOffline: () => mockOffline,
  mockDelay: (_ms: number) => Promise.resolve(),
}));

// Mock logger
vi.mock('../../../00_kernel/telemetry/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
  EVENTS: {
    APP_ERROR: 'app_error',
  },
}));

describe('transactionApi', () => {
  const testUserId = UserId('user-123');

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnline = false;
    mockOffline = false;
  });

  describe('fetchTransactions', () => {
    it('TC-1.1: Successfully fetches and parses transactions', async () => {
      const mockResponse = {
        transactions: [
          {
            userId: 'user-123',
            transactionId: 'tx-1',
            imageId: 'img-1',
            amount: 1000,
            type: 'expense',
            date: '2026-01-01',
            merchant: 'Test Merchant',
            category: 'shopping',
            description: 'Test description',
            status: 'unconfirmed',
            createdAt: '2026-01-01T10:00:00Z',
            updatedAt: '2026-01-01T10:00:00Z',
            confirmedAt: null,
            version: 1,
          },
          {
            userId: 'user-123',
            transactionId: 'tx-2',
            imageId: null,
            amount: 2000,
            type: 'income',
            date: '2026-01-02',
            merchant: 'Another Merchant',
            category: 'other',
            description: 'Sale description',
            status: 'confirmed',
            createdAt: '2026-01-02T10:00:00Z',
            updatedAt: '2026-01-02T10:00:00Z',
            confirmedAt: '2026-01-02T12:00:00Z',
            version: 1,
          },
        ],
        nextCursor: null,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await fetchTransactions(testUserId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('tx-1');
      expect(result[0].amount).toBe(1000);
      expect(result[0].type).toBe('expense');
      expect(result[1].id).toBe('tx-2');
      expect(result[1].amount).toBe(2000);
      expect(result[1].type).toBe('income');
    });

    it('TC-1.2: Throws error on network timeout', async () => {
      // Simulate timeout by never resolving
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Never resolve, let timeout occur
            setTimeout(resolve, 15000); // Longer than 10s timeout
          })
      );

      await expect(fetchTransactions(testUserId)).rejects.toThrow(
        'Transaction fetch timeout (10s)'
      );
    }, 15000); // Extended timeout for this test (10s API timeout + buffer)

    it('TC-1.3: Throws error on invalid JSON response (Zod validation fails)', async () => {
      const invalidResponse = {
        transactions: [
          {
            // Missing required fields
            userId: 'user-123',
            // transactionId: missing!
            amount: 'invalid', // Should be number
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => invalidResponse,
      });

      await expect(fetchTransactions(testUserId)).rejects.toThrow(
        /Invalid transaction response/
      );
    });

    it('TC-1.4: Handles 403 Unauthorized error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
      });

      await expect(fetchTransactions(testUserId)).rejects.toThrow(
        '403: Unauthorized'
      );
    });

    it('TC-1.4b: Handles 400 Bad Request error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(fetchTransactions(testUserId)).rejects.toThrow(
        '400: Invalid request parameters'
      );
    });

    it('TC-1.4c: Handles 429 Rate Limit error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
      });

      await expect(fetchTransactions(testUserId)).rejects.toThrow(
        '429: Rate limit exceeded'
      );
    });

    it('TC-1.4d: Handles 500 Server Error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(fetchTransactions(testUserId)).rejects.toThrow(
        '500: Server error'
      );
    });

    it('TC-1.5: Returns mock transactions when mocking online', async () => {
      mockOnline = true;

      const result = await fetchTransactions(testUserId);

      expect(result).toHaveLength(3);
      expect(result[0].id).toContain('mock-tx-');
      expect(result[0].userId).toBe(testUserId);
      // Should not call real fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('TC-1.6: Throws error when mocking offline', async () => {
      mockOffline = true;

      await expect(fetchTransactions(testUserId)).rejects.toThrow(
        'Network error: offline mode'
      );

      // Should not call real fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('TC-1.7: Sends correct request body with filters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ transactions: [], nextCursor: null }),
      });

      await fetchTransactions(
        testUserId,
        '2026-01-01',
        '2026-01-31',
        'confirmed'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: testUserId,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            status: 'confirmed',
            limit: 100,
          }),
        })
      );
    });

    it('TC-1.8: Maps cloud transaction fields to domain transaction correctly', async () => {
      const mockResponse = {
        transactions: [
          {
            userId: 'user-123',
            transactionId: 'tx-cloud',
            imageId: 'img-cloud',
            amount: 5000,
            type: 'expense',
            date: '2026-01-05',
            merchant: 'Cloud Merchant',
            category: 'transport',
            description: 'Shipping cost',
            status: 'confirmed',
            createdAt: '2026-01-05T08:00:00Z',
            updatedAt: '2026-01-05T09:00:00Z',
            confirmedAt: '2026-01-05T10:00:00Z',
            version: 2,
            // Extra cloud-only fields (should be ignored)
            aiProcessed: true,
            validationErrors: [],
            isGuest: false,
            ttl: 1234567890,
          },
        ],
        nextCursor: null,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await fetchTransactions(testUserId);

      expect(result).toHaveLength(1);
      const tx = result[0];

      // Verify mapping
      expect(tx.id).toBe('tx-cloud'); // transactionId → id
      expect(tx.userId).toBe('user-123');
      expect(tx.imageId).toBe('img-cloud');
      expect(tx.amount).toBe(5000);
      expect(tx.type).toBe('expense');
      expect(tx.category).toBe('transport');
      expect(tx.currency).toBe('JPY'); // Default
      expect(tx.confidence).toBe(null); // Not in cloud
      expect(tx.rawText).toBe(null); // Not in cloud
    });
  });
});
