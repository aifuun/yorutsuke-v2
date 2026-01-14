// Presign Adapter
// Pillar B: Airlock - validate all API responses
// Pillar I: Adapter layer isolates AWS API from business logic

import { fetch } from '@tauri-apps/plugin-http';
import { z } from 'zod';

// Response schema for presign Lambda
const PresignDownloadResponseSchema = z.object({
  url: z.string(),
  key: z.string(),
});

/**
 * Get S3 presigned download URL
 * Calls presign Lambda to generate temporary download URL
 *
 * @param s3Key - S3 object key (e.g., "processed/device-xxx/123.jpg")
 * @returns Presigned GET URL (valid for 1 hour)
 * @throws Error if presign Lambda URL not configured or request fails
 */
export async function getS3DownloadUrl(s3Key: string): Promise<string> {
  const presignUrl = import.meta.env.VITE_LAMBDA_PRESIGN_URL;
  if (!presignUrl) {
    throw new Error('Presign Lambda URL not configured');
  }

  const response = await fetch(presignUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'download',
      s3Key,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to get presigned URL: ${errorData.message || response.statusText}`
    );
  }

  const data = await response.json();

  // Pillar B: Validate response at boundary
  const parsed = PresignDownloadResponseSchema.parse(data);

  return parsed.url;
}
