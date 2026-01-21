/**
 * Unit tests for uploadApi - Permit auto-refresh on presign (JIT pattern)
 *
 * Test coverage:
 * 1. Fresh permit - no refresh
 * 2. Expired permit - single refresh succeeds
 * 3. Expired permit - refresh fails
 * 4. Concurrent requests - single Lambda call (Mutex)
 * 5. Permit still expired after refresh - max retry reached
 * 6. Race condition - refresh during presign
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ensurePermitValid } from './uploadApi';
import * as permitApiModule from './permitApi';
import * as localQuotaModule from '../../../01_domains/quota';
import type { UploadPermit } from './permitApi';
import type { UserId, TraceId } from '../../../00_kernel/types';

// Mock dependencies
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

vi.mock('./permitApi', () => ({
  fetchPermit: vi.fn(),
}));

vi.mock('../../../01_domains/quota', () => ({
  localQuota: {
    isExpired: vi.fn(),
    getPermit: vi.fn(),
    setPermit: vi.fn(),
  },
}));

vi.mock('../../../00_kernel/config/mock', () => ({
  isMockingOnline: vi.fn(() => false),
  isMockingOffline: vi.fn(() => false),
  isSlowUpload: vi.fn(() => false),
  mockDelay: vi.fn(),
}));

vi.mock('../../../00_kernel/telemetry/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  EVENTS: {
    PERMIT_EXPIRED_AT_PRESIGN: 'PERMIT_EXPIRED_AT_PRESIGN',
    PERMIT_REFRESHED_AT_PRESIGN: 'PERMIT_REFRESHED_AT_PRESIGN',
    PERMIT_REFRESH_FAILED_AT_PRESIGN: 'PERMIT_REFRESH_FAILED_AT_PRESIGN',
    PERMIT_REFRESH_EXHAUSTED: 'PERMIT_REFRESH_EXHAUSTED',
    UPLOAD_STARTED: 'UPLOAD_STARTED',
  },
}));

// Helper to create mock permit
function createMockPermit(overrides: Partial<UploadPermit> = {}): UploadPermit {
  return {
    userId: 'user-test-123' as UserId,
    totalLimit: 1000,
    dailyRate: 50,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    issuedAt: new Date().toISOString(),
    signature: '0'.repeat(64),
    tier: 'free',
    ...overrides,
  };
}

// Helper to create expired permit
function createExpiredPermit(): UploadPermit {
  return createMockPermit({
    expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
  });
}

describe('uploadApi - Permit Auto-Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('ensurePermitValid()', () => {
    /**
     * Test 1: Fresh Permit - No Refresh
     * Scenario: Permit is valid and not expired
     * Expected: No call to fetchPermit, returns cached permit immediately
     */
    it('should not refresh permit when valid', async () => {
      const freshPermit = createMockPermit();
      const userId = 'user-test-123' as UserId;
      const traceId = 'trace-123' as TraceId;

      vi.mocked(localQuotaModule.localQuota.isExpired).mockReturnValue(false);
      vi.mocked(localQuotaModule.localQuota.getPermit).mockReturnValue(freshPermit);

      // Call ensurePermitValid
      const result = await ensurePermitValid(userId, traceId);

      // Verify: fetchPermit NOT called
      expect(vi.mocked(permitApiModule.fetchPermit)).not.toHaveBeenCalled();
      // Result should be the cached permit
      expect(result).toEqual(freshPermit);
    });

    /**
     * Test 2: Expired Permit - Single Refresh Succeeds
     * Scenario: Permit is expired, refresh succeeds
     * Expected: fetchPermit called once, permit saved, returns refreshed permit
     */
    it('should refresh permit when expired', async () => {
      const expiredPermit = createExpiredPermit();
      const freshPermit = createMockPermit();
      const userId = 'user-test-123' as UserId;
      const traceId = 'trace-123' as TraceId;

      // First call: expired, second call: fresh
      vi.mocked(localQuotaModule.localQuota.isExpired)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      vi.mocked(localQuotaModule.localQuota.getPermit)
        .mockReturnValueOnce(expiredPermit)
        .mockReturnValueOnce(freshPermit);

      vi.mocked(permitApiModule.fetchPermit).mockResolvedValueOnce(freshPermit);

      // Call ensurePermitValid
      const result = await ensurePermitValid(userId, traceId);

      // Verify: fetchPermit called with userId
      expect(vi.mocked(permitApiModule.fetchPermit)).toHaveBeenCalledWith(userId);

      // Verify: setPermit called with fresh permit
      expect(vi.mocked(localQuotaModule.localQuota.setPermit)).toHaveBeenCalledWith(freshPermit);

      // Result should be the fresh permit (check key fields, not timestamps)
      expect(result).toMatchObject({
        userId: freshPermit.userId,
        totalLimit: freshPermit.totalLimit,
        dailyRate: freshPermit.dailyRate,
        tier: freshPermit.tier,
      });
    });

    /**
     * Test 3: Expired Permit - Refresh Fails
     * Scenario: Permit is expired, fetchPermit throws error
     * Expected: Error propagates immediately, no retry
     */
    it('should fail when refresh fails', async () => {
      const expiredPermit = createExpiredPermit();
      const userId = 'user-test-123' as UserId;
      const traceId = 'trace-123' as TraceId;

      vi.mocked(localQuotaModule.localQuota.isExpired).mockReturnValue(true);
      vi.mocked(localQuotaModule.localQuota.getPermit).mockReturnValue(expiredPermit);

      const error = new Error('API Error');
      vi.mocked(permitApiModule.fetchPermit).mockRejectedValueOnce(error);

      // Call ensurePermitValid - should throw
      await expect(ensurePermitValid(userId, traceId)).rejects.toThrow('API Error');

      // Verify: fetchPermit was called
      expect(vi.mocked(permitApiModule.fetchPermit)).toHaveBeenCalled();
    });

    /**
     * Test 4: Permit Still Expired After Refresh (Edge Case)
     * Scenario: Lambda returns already-expired permit (shouldn't happen, but test edge case)
     * Expected: Max retry check fails, throws PERMIT_REFRESH_EXHAUSTED error
     */
    it('should fail with EXHAUSTED error when permit still expired after refresh', async () => {
      const alreadyExpiredPermit = createExpiredPermit();
      const userId = 'user-test-123' as UserId;
      const traceId = 'trace-123' as TraceId;

      // First check: expired, after refresh: still expired
      vi.mocked(localQuotaModule.localQuota.isExpired)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true); // Still expired after refresh!

      vi.mocked(localQuotaModule.localQuota.getPermit)
        .mockReturnValueOnce(alreadyExpiredPermit)
        .mockReturnValueOnce(alreadyExpiredPermit);

      vi.mocked(permitApiModule.fetchPermit).mockResolvedValueOnce(alreadyExpiredPermit);

      // Call ensurePermitValid - should throw EXHAUSTED error
      await expect(ensurePermitValid(userId, traceId)).rejects.toThrow(
        'Permit expired and refresh failed after retries'
      );

      // Verify: fetchPermit was called
      expect(vi.mocked(permitApiModule.fetchPermit)).toHaveBeenCalled();
    });
  });

  describe('Concurrent requests behavior', () => {
    /**
     * Test: Concurrent Requests - Only One Lambda Call (Mutex)
     * Scenario: 3 concurrent calls all discover permit expired simultaneously
     * Expected: Only 1 fetchPermit call, all requests share result
     */
    it('should refresh only once for concurrent requests', async () => {
      const freshPermit = createMockPermit();
      const userId = 'user-test-123' as UserId;
      const traceId = 'trace-123' as TraceId;

      let fetchCallCount = 0;
      vi.mocked(permitApiModule.fetchPermit).mockImplementation(async () => {
        fetchCallCount++;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));
        return freshPermit;
      });

      // Setup mocks for concurrent calls:
      // Each call checks isExpired (expired) → refresh → isExpired (fresh) → getPermit (return)
      // Need: 6 isExpired calls (3 first checks that are true + 3 second checks that are false)
      // Need: 3 getPermit calls (one per request, all after refresh)
      vi.mocked(localQuotaModule.localQuota.isExpired)
        .mockReturnValueOnce(true)   // Request 1 first check
        .mockReturnValueOnce(true)   // Request 2 first check
        .mockReturnValueOnce(true)   // Request 3 first check
        .mockReturnValueOnce(false)  // Request 1 second check (after refresh)
        .mockReturnValueOnce(false)  // Request 2 second check (after refresh)
        .mockReturnValueOnce(false); // Request 3 second check (after refresh)

      vi.mocked(localQuotaModule.localQuota.getPermit)
        .mockReturnValueOnce(freshPermit)  // Request 1 return
        .mockReturnValueOnce(freshPermit)  // Request 2 return
        .mockReturnValueOnce(freshPermit); // Request 3 return

      // Call concurrently
      const [result1, result2, result3] = await Promise.all([
        ensurePermitValid(userId, traceId),
        ensurePermitValid(userId, traceId),
        ensurePermitValid(userId, traceId),
      ]);

      // Verify: fetchPermit called only once (Mutex protection)
      expect(fetchCallCount).toBe(1);

      // All three get the same fresh permit
      expect(result1).toMatchObject({
        userId: freshPermit.userId,
        totalLimit: freshPermit.totalLimit,
        dailyRate: freshPermit.dailyRate,
        tier: freshPermit.tier,
      });
      expect(result2).toMatchObject({
        userId: freshPermit.userId,
        totalLimit: freshPermit.totalLimit,
        dailyRate: freshPermit.dailyRate,
        tier: freshPermit.tier,
      });
      expect(result3).toMatchObject({
        userId: freshPermit.userId,
        totalLimit: freshPermit.totalLimit,
        dailyRate: freshPermit.dailyRate,
        tier: freshPermit.tier,
      });
    });
  });
});
