/**
 * Permit API Adapter
 *
 * Fetches signed upload permits from issue-permit Lambda.
 * Pillar B: All responses validated with Zod schemas.
 */

import { z } from 'zod';
import { fetch } from '@tauri-apps/plugin-http';
import type { UserId } from '../../../00_kernel/types';
import { isMockingOnline, isMockingOffline, mockDelay } from '../../../00_kernel/config/mock';
import { mockNetworkError } from '../../../00_kernel/mocks';

const PERMIT_URL = import.meta.env.VITE_LAMBDA_ISSUE_PERMIT_URL;
const PERMIT_TIMEOUT_MS = 5_000; // 5 seconds

// =========================================================================
// Zod Schemas (Pillar B: Boundary Validation)
// =========================================================================

const TierSchema = z.enum(['guest', 'free', 'basic', 'pro']);

const UploadPermitSchema = z.object({
  userId: z.string(),
  totalLimit: z.number().int().positive(),
  dailyRate: z.number().int().nonnegative(), // 0 = unlimited (Pro tier)
  expiresAt: z.string(), // ISO 8601
  issuedAt: z.string(),  // ISO 8601
  signature: z.string().length(64), // HMAC-SHA256 hex
  tier: TierSchema,
});

const PermitResponseSchema = z.object({
  permit: UploadPermitSchema,
});

// Export types derived from schemas
export type UploadPermit = z.infer<typeof UploadPermitSchema>;
export type PermitResponse = z.infer<typeof PermitResponseSchema>;

// =========================================================================
// Helper Functions
// =========================================================================

/**
 * Wrap a promise with timeout protection
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// =========================================================================
// Mock Permit Generation
// =========================================================================

/**
 * Generate a mock permit for testing
 *
 * @param userId - User identifier
 * @param validDays - Permit validity period (default: 30)
 * @returns Mock permit with realistic values
 */
function generateMockPermit(userId: UserId, validDays = 30): UploadPermit {
  const tier = userId.startsWith('device-') ? 'guest' : 'free';

  const tierConfig = {
    guest: { totalLimit: 500, dailyRate: 30 },
    free: { totalLimit: 1000, dailyRate: 50 },
    basic: { totalLimit: 3000, dailyRate: 100 },
    pro: { totalLimit: 10000, dailyRate: 0 }, // 0 = unlimited
  };

  const config = tierConfig[tier];
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    userId,
    totalLimit: config.totalLimit,
    dailyRate: config.dailyRate,
    expiresAt,
    issuedAt,
    signature: 'mock-signature-' + '0'.repeat(49), // 64 chars
    tier,
  };
}

// =========================================================================
// Public API
// =========================================================================

/**
 * Fetch upload permit from issue-permit Lambda
 *
 * @param userId - User identifier (device-* or user-*)
 * @param validDays - Optional validity period (default: tier config)
 * @returns Signed upload permit
 *
 * Mock behavior:
 * - Offline: Throws network error
 * - Online: Returns mock permit (no Lambda call)
 * - Production: Calls Lambda and validates response
 */
export async function fetchPermit(
  userId: UserId,
  validDays?: number
): Promise<UploadPermit> {
  // Mocking offline - simulate network failure
  if (isMockingOffline()) {
    await mockDelay(100);
    throw mockNetworkError('fetch permit');
  }

  // Mocking online - return mock permit
  if (isMockingOnline()) {
    await mockDelay();
    return generateMockPermit(userId, validDays);
  }

  // Production mode - call Lambda
  if (!PERMIT_URL) {
    throw new Error('VITE_LAMBDA_ISSUE_PERMIT_URL not configured');
  }

  const body: { userId: string; validDays?: number } = { userId };
  if (validDays !== undefined) {
    body.validDays = validDays;
  }

  const fetchPromise = fetch(PERMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const response = await withTimeout(
    fetchPromise,
    PERMIT_TIMEOUT_MS,
    'Permit request timeout (5s)'
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Permit fetch failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Pillar B: Validate response with Zod schema
  const parsed = PermitResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid permit response: ${parsed.error.message}`);
  }

  return parsed.data.permit;
}
