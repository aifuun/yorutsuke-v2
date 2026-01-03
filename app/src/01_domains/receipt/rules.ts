import type { ImageStatus } from './types';
import { IMAGE_TRANSITIONS } from './types';

// Pure business rules - no side effects

export function canTransition(from: ImageStatus, to: ImageStatus): boolean {
  const allowed = IMAGE_TRANSITIONS[from];
  return allowed.includes(to);
}

export function isTerminalState(status: ImageStatus): boolean {
  return status === 'confirmed' || status === 'failed';
}

export function isUploadable(status: ImageStatus): boolean {
  return status === 'compressed';
}

export function needsRetry(status: ImageStatus): boolean {
  return status === 'failed';
}

// Compression rules
export const MAX_IMAGE_SIZE_MB = 10;
export const TARGET_WEBP_QUALITY = 80;
export const MAX_DIMENSION = 2048;

export function shouldCompress(originalSizeBytes: number): boolean {
  return originalSizeBytes > 100 * 1024; // Compress if > 100KB
}

// Quota rules - limit is now dynamic based on user tier
export const MIN_UPLOAD_INTERVAL_MS = 2_000; // 2 seconds (per QUOTA.md)

export function canUpload(
  uploadedToday: number,
  dailyLimit: number,
  lastUploadTime: number | null,
): { allowed: boolean; reason?: string } {
  if (uploadedToday >= dailyLimit) {
    return { allowed: false, reason: `Daily limit reached (${dailyLimit})` };
  }

  if (lastUploadTime && Date.now() - lastUploadTime < MIN_UPLOAD_INTERVAL_MS) {
    const waitSeconds = Math.ceil((MIN_UPLOAD_INTERVAL_MS - (Date.now() - lastUploadTime)) / 1000);
    return { allowed: false, reason: `Please wait ${waitSeconds}s` };
  }

  return { allowed: true };
}
