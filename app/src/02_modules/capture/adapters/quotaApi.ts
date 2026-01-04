// Pillar B: Airlock - validate all API responses with Zod
import { z } from 'zod';
import type { UserId } from '../../../00_kernel/types';
import { USE_MOCK, mockDelay } from '../../../00_kernel/config/mock';

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

// Seeded random for reproducibility
function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Mock quota data for UI development
function createMockQuota(scenario: QuotaMockScenario = 'default'): QuotaResponse {
  // Use hour-based seed for some daily variance
  const seed = Math.floor(Date.now() / (1000 * 60 * 60));
  const random = createSeededRandom(seed);

  const resetsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  switch (scenario) {
    case 'fresh-guest':
      return {
        used: 0,
        limit: TIER_LIMITS.guest,
        remaining: TIER_LIMITS.guest,
        resetsAt,
        tier: 'guest',
        guest: {
          dataExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiration: 60,
        },
      };

    case 'near-limit': {
      const tier: UserTier = 'free';
      const limit = TIER_LIMITS[tier];
      const used = limit - 2;
      return {
        used,
        limit,
        remaining: limit - used,
        resetsAt,
        tier,
      };
    }

    case 'at-limit': {
      const tier: UserTier = 'free';
      const limit = TIER_LIMITS[tier];
      return {
        used: limit,
        limit,
        remaining: 0,
        resetsAt,
        tier,
      };
    }

    case 'expiring-soon':
      return {
        used: Math.floor(random() * 5),
        limit: TIER_LIMITS.guest,
        remaining: TIER_LIMITS.guest - Math.floor(random() * 5),
        resetsAt,
        tier: 'guest',
        guest: {
          dataExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiration: 3,
        },
      };

    case 'free-tier': {
      const used = Math.floor(random() * 15);
      return {
        used,
        limit: TIER_LIMITS.free,
        remaining: TIER_LIMITS.free - used,
        resetsAt,
        tier: 'free',
      };
    }

    case 'basic-tier': {
      const used = Math.floor(random() * 40);
      return {
        used,
        limit: TIER_LIMITS.basic,
        remaining: TIER_LIMITS.basic - used,
        resetsAt,
        tier: 'basic',
      };
    }

    case 'pro-tier': {
      const used = Math.floor(random() * 100);
      return {
        used,
        limit: TIER_LIMITS.pro,
        remaining: TIER_LIMITS.pro - used,
        resetsAt,
        tier: 'pro',
      };
    }

    case 'default':
    default: {
      const used = Math.floor(random() * 5);
      return {
        used,
        limit: TIER_LIMITS.guest,
        remaining: TIER_LIMITS.guest - used,
        resetsAt,
        tier: 'guest',
        guest: {
          dataExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiration: 60,
        },
      };
    }
  }
}

/**
 * Get all available quota mock scenarios (for dev tools / testing UI)
 */
export function getQuotaMockScenarios(): QuotaMockScenario[] {
  return ['default', 'fresh-guest', 'near-limit', 'at-limit', 'expiring-soon', 'free-tier', 'basic-tier', 'pro-tier'];
}

// Current mock scenario (can be changed via dev tools)
let currentQuotaMockScenario: QuotaMockScenario = 'default';

/**
 * Set the current quota mock scenario (for dev tools)
 */
export function setQuotaMockScenario(scenario: QuotaMockScenario): void {
  currentQuotaMockScenario = scenario;
}

/**
 * Get the current quota mock scenario
 */
export function getQuotaMockScenario(): QuotaMockScenario {
  return currentQuotaMockScenario;
}

/**
 * Fetch current quota status for user
 */
export async function fetchQuota(userId: UserId): Promise<QuotaResponse> {
  // Mock mode for UI development
  if (USE_MOCK) {
    await mockDelay();
    return createMockQuota(currentQuotaMockScenario);
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
