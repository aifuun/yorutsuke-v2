/**
 * Image Sync Adapter
 * Wraps capture module adapters for sync operations
 * Pillar I: Firewalls - Provides single boundary between sync and capture modules
 *
 * This adapter isolates sync module from capture module internals.
 * All sync services MUST use this adapter instead of direct capture imports.
 */

import type { UserId, ImageId, TraceId } from '../../../00_kernel/types';
import type { ImageRow } from '../../../00_kernel/storage';
import {
  getImageById as captureGetImage,
  updateImageS3Key as captureUpdateS3Key,
  createImageRecord as captureCreateImage,
} from '../../capture';

/**
 * Image record creation data
 */
export interface CreateImageData {
  id: ImageId;
  userId: UserId;
  traceId: TraceId;
  s3Key: string;
  createdAt: string;
}

// ============================================================================
// Image Database Operations (Local)
// ============================================================================

/**
 * Get image record by ID from local database
 * @param imageId - Image ID
 * @returns Image record if exists, null otherwise
 */
export async function getImageById(imageId: ImageId): Promise<ImageRow | null> {
  return captureGetImage(imageId);
}

/**
 * Update S3 key for an existing image record
 * Used when local file missing but cloud has S3 reference
 * @param imageId - Image ID
 * @param s3Key - S3 object key
 */
export async function updateImageS3Key(imageId: ImageId, s3Key: string): Promise<void> {
  return captureUpdateS3Key(imageId, s3Key);
}

/**
 * Create new image record in local database
 * Used when transaction from cloud has imageId but no local record exists
 * @param data - Image creation data
 */
export async function createImageRecord(data: CreateImageData): Promise<void> {
  return captureCreateImage(data);
}
