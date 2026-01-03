// Pillar B: Airlock - validate all API responses with Zod
import { z } from 'zod';
import type { UserId } from '../../../00_kernel/types';

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

/**
 * Fetch current quota status for user
 */
export async function fetchQuota(userId: UserId): Promise<QuotaResponse> {
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
