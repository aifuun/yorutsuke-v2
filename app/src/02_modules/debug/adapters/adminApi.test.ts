import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { deleteUserData } from './adminApi';
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
  mockDelay: (ms?: number) => Promise.resolve(),
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

describe('adminApi', () => {
  const testUserId = UserId('user-123');

  beforeAll(() => {
    // Set environment variable for all tests
    import.meta.env.VITE_LAMBDA_ADMIN_DELETE_URL = 'https://test-lambda.example.com/';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnline = false;
    mockOffline = false;
  });

  describe('deleteUserData', () => {
    it('TC-1.1: Successfully deletes user data and returns counts', async () => {
      const mockResponse = {
        userId: 'user-123',
        deleted: {
          transactions: 15,
          images: 8,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await deleteUserData(testUserId, ['transactions', 'images']);

      expect(result).toEqual(mockResponse);
      expect(result.deleted.transactions).toBe(15);
      expect(result.deleted.images).toBe(8);
    });

    it('TC-1.2: Handles empty data (no items to delete)', async () => {
      const mockResponse = {
        userId: 'user-123',
        deleted: {
          transactions: 0,
          images: 0,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await deleteUserData(testUserId, ['transactions', 'images']);

      expect(result.deleted.transactions).toBe(0);
      expect(result.deleted.images).toBe(0);
    });

    it('TC-1.3: Deletes only transactions when specified', async () => {
      const mockResponse = {
        userId: 'user-123',
        deleted: {
          transactions: 10,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await deleteUserData(testUserId, ['transactions']);

      expect(result.deleted.transactions).toBe(10);
      expect(result.deleted.images).toBeUndefined();
    });

    it('TC-1.4: Deletes only images when specified', async () => {
      const mockResponse = {
        userId: 'user-123',
        deleted: {
          images: 5,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await deleteUserData(testUserId, ['images']);

      expect(result.deleted.images).toBe(5);
      expect(result.deleted.transactions).toBeUndefined();
    });

    it('TC-2.1: Throws error when userId is missing', async () => {
      await expect(
        deleteUserData('' as UserId, ['transactions'])
      ).rejects.toThrow('userId is required');
    });

    it('TC-2.2: Throws error when types array is empty', async () => {
      await expect(
        deleteUserData(testUserId, [])
      ).rejects.toThrow('types must be a non-empty array');
    });

    it('TC-3.1: Handles 400 error (invalid request)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid userId' }),
      });

      await expect(
        deleteUserData(testUserId, ['transactions'])
      ).rejects.toThrow('400: Invalid userId');
    });

    it('TC-3.2: Handles 500 error (server error)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(
        deleteUserData(testUserId, ['transactions'])
      ).rejects.toThrow('500: Internal server error');
    });

    it('TC-3.3: Handles network timeout', async () => {
      mockFetch.mockImplementation(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(
        deleteUserData(testUserId, ['transactions'])
      ).rejects.toThrow();
    });

    it('TC-4.1: Returns mock data in offline mode', async () => {
      mockOffline = true;

      await expect(
        deleteUserData(testUserId, ['transactions'])
      ).rejects.toThrow('Network error: offline mode');
    });

    it('TC-4.2: Returns mock data in online mode', async () => {
      mockOnline = true;

      const result = await deleteUserData(testUserId, ['transactions', 'images']);

      expect(result.userId).toBe(testUserId);
      expect(result.deleted.transactions).toBe(5);
      expect(result.deleted.images).toBe(3);
    });

    it('TC-5.1: Validates response schema (rejects invalid response)', async () => {
      const invalidResponse = {
        // Missing required fields
        deleted: 'invalid',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => invalidResponse,
      });

      await expect(
        deleteUserData(testUserId, ['transactions'])
      ).rejects.toThrow('Invalid delete response');
    });

    it('TC-6.1: Security - Only deletes data for specified userId', async () => {
      const mockResponse = {
        userId: 'user-123',
        deleted: {
          transactions: 10,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await deleteUserData(testUserId, ['transactions']);

      // Verify the request body contains the correct userId
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body as string);
      expect(requestBody.userId).toBe('user-123');
      expect(requestBody.types).toEqual(['transactions']);
    });
  });
});
