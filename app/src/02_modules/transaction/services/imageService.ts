// Image Service
// Provides image URL resolution for transaction image preview
// Pillar L: Business logic separated from UI

import type { ImageId as ImageIdType } from '../../../00_kernel/types';
import { getImageById } from '../../capture';
import { checkFileExists, getLocalImageUrl, getS3DownloadUrl } from '../adapters';

/**
 * Result of image URL resolution
 */
export interface ImageUrlResult {
  /** Image URL for display (local file or presigned S3 URL) */
  url: string | null;
  /** Image source type */
  source: 'local' | 's3' | 'missing';
  /** Error message if resolution failed */
  error?: string;
}

/**
 * Get displayable image URL for a given imageId
 *
 * Priority:
 * 1. Local compressed file (if exists) - fastest, offline-capable
 * 2. S3 presigned URL (if s3_key exists) - requires network
 * 3. null - image deleted or missing
 *
 * @param imageId - Image identifier
 * @returns Image URL result with source type
 */
export async function getImageUrl(imageId: ImageIdType): Promise<ImageUrlResult> {
  try {
    // Step 1: Query image record from database
    const imageRow = await getImageById(imageId);
    if (!imageRow) {
      return { url: null, source: 'missing', error: 'Image record not found' };
    }

    // Step 2: Try local compressed file first (fastest, offline-capable)
    if (imageRow.compressed_path) {
      const fileExists = await checkFileExists(imageRow.compressed_path);
      if (fileExists) {
        const url = getLocalImageUrl(imageRow.compressed_path);
        return { url, source: 'local' };
      }
    }

    // Step 3: Try S3 presigned URL (requires network)
    if (imageRow.s3_key) {
      try {
        const url = await getS3DownloadUrl(imageRow.s3_key);
        return { url, source: 's3' };
      } catch (error) {
        return {
          url: null,
          source: 's3',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Step 4: No local file and no S3 key - image truly missing
    return { url: null, source: 'missing', error: 'Image deleted or never uploaded' };

  } catch (error) {
    return {
      url: null,
      source: 'missing',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
