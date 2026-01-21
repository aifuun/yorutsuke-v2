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
import { logger } from '../../../00_kernel/telemetry/logger';

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
  logger.debug('PERMIT_FETCH_START', {
    userId,
    validDays,
    mockMode: isMockingOnline() ? 'online' : isMockingOffline() ? 'offline' : 'production',
    permitUrlConfigured: !!PERMIT_URL,
  });

  // Mocking offline - simulate network failure
  if (isMockingOffline()) {
    logger.info('PERMIT_FETCH_MOCK_OFFLINE', { userId });
    await mockDelay(100);
    throw mockNetworkError('fetch permit');
  }

  // Mocking online - return mock permit
  if (isMockingOnline()) {
    logger.info('PERMIT_FETCH_MOCK_ONLINE', { userId, validDays });
    await mockDelay();
    const mockPermit = generateMockPermit(userId, validDays);
    logger.debug('PERMIT_FETCH_MOCK_GENERATED', {
      userId,
      tier: mockPermit.tier,
      totalLimit: mockPermit.totalLimit,
      dailyRate: mockPermit.dailyRate,
    });
    return mockPermit;
  }

  // Production mode - call Lambda
  if (!PERMIT_URL) {
    logger.error('PERMIT_FETCH_NO_URL', { userId, env: 'VITE_LAMBDA_ISSUE_PERMIT_URL' });
    throw new Error('VITE_LAMBDA_ISSUE_PERMIT_URL not configured');
  }

  logger.info('PERMIT_FETCH_PRODUCTION', {
    userId,
    url: PERMIT_URL.substring(0, 50) + '...',
    timeoutMs: PERMIT_TIMEOUT_MS,
  });

  const body: { userId: string; validDays?: number } = { userId };
  if (validDays !== undefined) {
    body.validDays = validDays;
  }

  const fetchPromise = fetch(PERMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let response;
  try {
    response = await withTimeout(
      fetchPromise,
      PERMIT_TIMEOUT_MS,
      'Permit request timeout (5s)'
    );
    logger.debug('PERMIT_FETCH_RESPONSE_OK', {
      userId,
      status: response.status,
    });
  } catch (error) {
    logger.error('PERMIT_FETCH_TIMEOUT_OR_ERROR', {
      userId,
      error: String(error),
    });
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('PERMIT_FETCH_HTTP_ERROR', {
      userId,
      status: response.status,
      errorText: errorText.substring(0, 200),
    });
    throw new Error(`Permit fetch failed (${response.status}): ${errorText}`);
  }

  let data;
  try {
    data = await response.json();
    logger.debug('PERMIT_FETCH_JSON_PARSED', {
      userId,
      hasPermit: !!data.permit,
    });
  } catch (error) {
    logger.error('PERMIT_FETCH_JSON_PARSE_ERROR', {
      userId,
      error: String(error),
    });
    throw error;
  }

  // Pillar B: Validate response with Zod schema
  const parsed = PermitResponseSchema.safeParse(data);
  if (!parsed.success) {
    logger.error('PERMIT_FETCH_VALIDATION_FAILED', {
      userId,
      error: parsed.error.message,
      receivedData: JSON.stringify(data).substring(0, 200),
    });
    throw new Error(`Invalid permit response: ${parsed.error.message}`);
  }

  const permit = parsed.data.permit;
  logger.info('PERMIT_FETCH_SUCCESS', {
    userId,
    tier: permit.tier,
    totalLimit: permit.totalLimit,
    dailyRate: permit.dailyRate,
    expiresAt: permit.expiresAt,
  });

  return permit;
}
