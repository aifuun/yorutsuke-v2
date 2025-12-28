// Pillar B: Airlock - validate all API responses
import type { UserId } from '../../../00_kernel/types';

const PRESIGN_URL = import.meta.env.VITE_LAMBDA_PRESIGN_URL;

interface PresignResponse {
  url: string;
  key: string;
}

export async function getPresignedUrl(
  userId: UserId,
  fileName: string,
  contentType: string = 'image/webp',
): Promise<PresignResponse> {
  const response = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, fileName, contentType }),
  });

  if (!response.ok) {
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
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status}`);
  }
}
