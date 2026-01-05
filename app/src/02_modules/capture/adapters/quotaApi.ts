// Pillar B: Airlock - validate all API responses with Zod
import { z } from 'zod';
import type { UserId } from '../../../00_kernel/types';
import { USE_MOCK, mockDelay } from '../../../00_kernel/config/mock';
import { countTodayUploads } from './imageDb';

const QUOTA_URL = import.meta.env.VITE_LAMBDA_QUOTA_URL;
const QUOTA_TIMEOUT_MS = 5_000; // 5 seconds

// Zod schemas for quota response validation
const UserTierSchema = z.enum(['guest', 'free', 'basic', 'pro']);

const GuestExpirationSchema = z.object({
  dataExpiresAt: z.string(),
  daysUntilExpiration: z.number().int().nonnegative(),
});

const QuotaResponseSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  remaining: z.number().int(),
  resetsAt: z.string(),
  tier: UserTierSchema,
  guest: GuestExpirationSchema.optional(),
});

// Export types derived from schemas
export type UserTier = z.infer<typeof UserTierSchema>;
export type GuestExpirationInfo = z.infer<typeof GuestExpirationSchema>;
export type QuotaResponse = z.infer<typeof QuotaResponseSchema>;

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
// Quota Mock Scenarios
// =========================================================================

export type QuotaMockScenario =
  | 'default'       // Guest with some usage
  | 'fresh-guest'   // New guest, no usage
  | 'near-limit'    // Almost at daily limit
  | 'at-limit'      // Hit daily limit
  | 'expiring-soon' // Guest data expiring soon
  | 'free-tier'     // Free tier user
  | 'basic-tier'    // Basic tier user
  | 'pro-tier';     // Pro tier user

const TIER_LIMITS: Record<UserTier, number> = {
  guest: 10,
  free: 30,
  basic: 100,
  pro: 500,
};


/**
 * Fetch current quota status for user
 * In mock mode, uses local database for accurate upload count
 */
export async function fetchQuota(userId: UserId): Promise<QuotaResponse> {
  // Mock mode - use local database for accurate count
  if (USE_MOCK) {
    await mockDelay();
    // Get actual upload count from local database
    const used = await countTodayUploads(userId);
    const tier: UserTier = 'guest';
    const limit = TIER_LIMITS[tier];
    const resetsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetsAt,
      tier,
      guest: {
        dataExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        daysUntilExpiration: 60,
      },
    };
  }

  if (!QUOTA_URL) {
    throw new Error('VITE_LAMBDA_QUOTA_URL not configured');
  }

  const fetchPromise = fetch(QUOTA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  const response = await withTimeout(
    fetchPromise,
    QUOTA_TIMEOUT_MS,
    'Quota request timeout (5s)'
  );

  if (!response.ok) {
    throw new Error(`Quota fetch failed: ${response.status}`);
  }

  const data = await response.json();

  // Pillar B: Validate response with Zod schema
  const parsed = QuotaResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid quota response: ${parsed.error.message}`);
  }

  return parsed.data;
}
