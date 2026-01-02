// Pillar B: Airlock - validate all API responses
// Pillar Q: Intent-ID for idempotency
import type { UserId, IntentId } from '../../../00_kernel/types';

const PRESIGN_URL = import.meta.env.VITE_LAMBDA_PRESIGN_URL;

// Timeouts
const PRESIGN_TIMEOUT_MS = 10_000;  // 10 seconds
const UPLOAD_TIMEOUT_MS = 60_000;   // 60 seconds (for large images)

interface PresignResponse {
  url: string;
  key: string;
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

export async function getPresignedUrl(
  userId: UserId,
  fileName: string,
  intentId: IntentId,  // Pillar Q: Idempotency key
  contentType: string = 'image/webp',
): Promise<PresignResponse> {
  const fetchPromise = fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, fileName, intentId, contentType }),
  });

  const response = await withTimeout(
    fetchPromise,
    PRESIGN_TIMEOUT_MS,
    'Presign request timeout (10s)'
  );

  if (!response.ok) {
    // Distinguish error types for retry logic
    if (response.status === 429) {
      throw new Error('429: Rate limit exceeded');
    }
    if (response.status === 403) {
      throw new Error('403: Unauthorized');
    }
    throw new Error(`Presign failed: ${response.status}`);
  }

  const data = await response.json();

  // Pillar B: Validate response shape
  if (typeof data.url !== 'string' || typeof data.key !== 'string') {
    throw new Error('Invalid presign response');
  }

  return data as PresignResponse;
}

export async function uploadToS3(
  presignedUrl: string,
  file: Blob,
  contentType: string = 'image/webp',
): Promise<void> {
  const fetchPromise = fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  const response = await withTimeout(
    fetchPromise,
    UPLOAD_TIMEOUT_MS,
    'S3 upload timeout (60s)'
  );

  if (!response.ok) {
    // S3 error responses
    if (response.status === 403) {
      throw new Error('403: S3 access denied (URL expired or invalid)');
    }
    throw new Error(`S3 upload failed: ${response.status}`);
  }
}
