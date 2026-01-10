// Image Sync Service
// Syncs image metadata for transactions from cloud
// Pillar L: Business logic separated from UI
// Pillar Q: Idempotent - safe to retry

import type { UserId, TraceId } from '../../../00_kernel/types';
import { ImageId } from '../../../00_kernel/types';
import { getImageById, updateImageS3Key, createImageRecord } from '../../capture/adapters/imageDb';
import { checkFileExists } from '../adapters/imageAdapter';
import { logger } from '../../../00_kernel/telemetry/logger';
import type { Transaction } from '../../../01_domains/transaction';

/**
 * Sync image metadata for a transaction
 *
 * Strategy:
 * 1. Check if imageId exists in local images table
 * 2. If exists and file exists → use local (no action needed)
 * 3. If exists but file missing → update s3_key (for on-demand download)
 * 4. If not exists → insert record with s3_key (for on-demand download)
 *
 * Note: Actual image download happens on-demand via imageService when user views the image
 *
 * @param transaction - Transaction from cloud with imageId
 * @param userId - User ID for the image
 * @param traceId - Trace ID for logging
 */
export async function syncImageForTransaction(
  transaction: Transaction,
  userId: UserId,
  traceId: TraceId
): Promise<void> {
  // Skip if transaction has no image
  if (!transaction.imageId) {
    return;
  }

  const imageId = ImageId(transaction.imageId);

  try {
    // Step 1: Check if image record exists locally
    const localImage = await getImageById(imageId);

    if (localImage) {
      // Step 2: Check if local file still exists
      if (localImage.compressed_path) {
        const fileExists = await checkFileExists(localImage.compressed_path);

        if (fileExists) {
          // Perfect! Local file exists, no sync needed
          logger.debug('image_sync_skipped', {
            imageId: String(imageId),
            reason: 'local_file_exists',
            path: localImage.compressed_path,
            traceId,
          });
          return;
        }
      }

      // Step 3: Local record exists but file missing
      // Update s3_key from cloud transaction (if available)
      if (transaction.s3Key && transaction.s3Key !== localImage.s3_key) {
        await updateImageS3Key(imageId, transaction.s3Key);

        logger.info('image_sync_updated', {
          imageId: String(imageId),
          action: 's3_key_updated',
          s3Key: transaction.s3Key,
          traceId,
        });
      }
      return;
    }

    // Step 4: No local record - create one with s3_key for on-demand download
    if (!transaction.s3Key) {
      logger.warn('image_sync_failed', {
        imageId: String(imageId),
        reason: 'no_s3_key_in_cloud_transaction',
        traceId,
      });
      return;
    }

    await createImageRecord({
      id: imageId,
      userId,
      traceId,
      s3Key: transaction.s3Key,
      createdAt: transaction.createdAt || new Date().toISOString(),
    });

    logger.info('image_sync_created', {
      imageId: String(imageId),
      userId: String(userId),
      s3Key: transaction.s3Key,
      traceId,
    });

  } catch (error) {
    logger.error('image_sync_error', {
      imageId: String(imageId),
      error: String(error),
      traceId,
    });
    // Don't throw - image sync failure shouldn't block transaction sync
  }
}

/**
 * Sync images for multiple transactions
 * Called after transaction sync completes
 *
 * @param transactions - Synced transactions from cloud
 * @param userId - User ID
 * @param traceId - Trace ID for logging
 * @returns Number of images synced
 */
export async function syncImagesForTransactions(
  transactions: Transaction[],
  userId: UserId,
  traceId: TraceId
): Promise<number> {
  logger.info('images_sync_started', {
    userId: String(userId),
    transactionCount: transactions.length,
    traceId,
  });

  let syncedCount = 0;

  for (const transaction of transactions) {
    if (transaction.imageId) {
      await syncImageForTransaction(transaction, userId, traceId);
      syncedCount++;
    }
  }

  logger.info('images_sync_complete', {
    userId: String(userId),
    syncedCount,
    traceId,
  });

  return syncedCount;
}
