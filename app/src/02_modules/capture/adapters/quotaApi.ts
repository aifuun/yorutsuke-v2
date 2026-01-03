// Pillar B: Airlock - validate all API responses
import type { UserId } from '../../../00_kernel/types';

const QUOTA_URL = import.meta.env.VITE_LAMBDA_QUOTA_URL;
const QUOTA_TIMEOUT_MS = 5_000; // 5 seconds

/**
 * User tier for quota limits
 */
export type UserTier = 'guest' | 'free' | 'basic' | 'pro';

/**
 * Quota status from Lambda
 */
export interface QuotaResponse {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string; // ISO 8601 timestamp
  tier: UserTier;
}

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

  // Pillar B: Validate response shape
  if (
    typeof data.used !== 'number' ||
    typeof data.limit !== 'number' ||
    typeof data.remaining !== 'number' ||
    typeof data.resetsAt !== 'string'
  ) {
    throw new Error('Invalid quota response');
  }

  return data as QuotaResponse;
}
