// Pillar B: Airlock - validate all API responses with Zod
// Pillar Q: Intent-ID for idempotency
import { z } from 'zod';
import type { UserId, IntentId } from '../../../00_kernel/types';
import { isMockingOnline, isMockingOffline, mockDelay } from '../../../00_kernel/config/mock';
import { logger, EVENTS } from '../../../00_kernel/telemetry/logger';

const PRESIGN_URL = import.meta.env.VITE_LAMBDA_PRESIGN_URL;

// Timeouts
const PRESIGN_TIMEOUT_MS = 10_000;  // 10 seconds
const UPLOAD_TIMEOUT_MS = 60_000;   // 60 seconds (for large images)

// Zod schema for presign response validation
const PresignResponseSchema = z.object({
  url: z.string().url(),
  key: z.string().min(1),
});

type PresignResponse = z.infer<typeof PresignResponseSchema>;

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

// Mock presign response for UI development
let mockKeyCounter = 0;
function createMockPresign(userId: UserId, fileName: string): PresignResponse {
  mockKeyCounter++;
  return {
    url: `https://mock-s3.local/uploads/${userId}/${Date.now()}-${fileName}?mock=true`,
    key: `uploads/${userId}/${Date.now()}-${mockKeyCounter}-${fileName}`,
  };
}

export async function getPresignedUrl(
  userId: UserId,
  fileName: string,
  intentId: IntentId,  // Pillar Q: Idempotency key
  contentType: string = 'image/webp',
): Promise<PresignResponse> {
  // Mocking offline - simulate network failure
  if (isMockingOffline()) {
    await mockDelay(100);
    throw new Error('Network error: offline mode');
  }

  // Mocking online - return mock presign URL
  if (isMockingOnline()) {
    await mockDelay(100);
    logger.debug(EVENTS.UPLOAD_STARTED, { phase: 'mock_presign', fileName });
    return createMockPresign(userId, fileName);
  }

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

  // Pillar B: Validate response with Zod schema
  const parsed = PresignResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid presign response: ${parsed.error.message}`);
  }

  return parsed.data;
}

export async function uploadToS3(
  presignedUrl: string,
  file: Blob,
  contentType: string = 'image/webp',
): Promise<void> {
  // Mocking offline - simulate network failure
  if (isMockingOffline()) {
    await mockDelay(100);
    throw new Error('Network error: offline mode');
  }

  // Mocking online - simulate successful upload
  if (isMockingOnline() || presignedUrl.includes('mock-s3.local')) {
    await mockDelay(500); // Simulate upload time
    logger.debug(EVENTS.UPLOAD_COMPLETED, { phase: 'mock_s3', size: file.size });
    return;
  }

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
