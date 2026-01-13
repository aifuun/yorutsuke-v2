// Image Sync Service
// Syncs image metadata for transactions from cloud
// Pillar L: Business logic separated from UI
// Pillar Q: Idempotent - safe to retry

import type { UserId, TraceId } from '../../../00_kernel/types';
import { ImageId } from '../../../00_kernel/types';
import { getImageById, updateImageS3Key, createImageRecord } from '../../capture';
import { checkFileExists } from '../../transaction/adapters';
import { logger, EVENTS } from '../../../00_kernel/telemetry/logger';
import type { Transaction } from '../../../01_domains/transaction';

/**
 * Image sync result for a single transaction
 */
export type ImageSyncStatus = 'skipped_no_image' | 'skipped_local_exists' | 's3_key_updated' | 'created' | 'orphaned' | 'error';

/**
 * Image sync summary result
 */
export interface ImageSyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  orphaned: number;  // Images with no s3Key - potential data issue
  errors: number;
  orphanedIds: string[];  // List of orphaned imageIds for monitoring
}

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
 * @returns Status of the sync operation
 */
export async function syncImageForTransaction(
  transaction: Transaction,
  userId: UserId,
  traceId: TraceId
): Promise<ImageSyncStatus> {
  // Skip if transaction has no image
  if (!transaction.imageId) {
    return 'skipped_no_image';
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
          return 'skipped_local_exists';
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
        return 's3_key_updated';
      }
      return 'skipped_local_exists';
    }

    // Step 4: No local record - create one with s3_key for on-demand download
    if (!transaction.s3Key) {
      // @ai-intent: Log as error (not warn) with ORPHAN event for monitoring/alerting
      // This indicates a data integrity issue: transaction has imageId but Lambda failed to store s3Key
      logger.error(EVENTS.IMAGE_ORPHANED, {
        imageId: String(imageId),
        transactionId: transaction.id,
        reason: 'no_s3_key_in_cloud_transaction',
        message: 'Transaction has imageId but no s3Key. Lambda may have failed to process or store the image path.',
        traceId,
      });
      return 'orphaned';
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

    return 'created';

  } catch (error) {
    logger.error('image_sync_error', {
      imageId: String(imageId),
      error: String(error),
      traceId,
    });
    // Don't throw - image sync failure shouldn't block transaction sync
    return 'error';
  }
}

/**
 * Sync images for multiple transactions
 * Called after transaction sync completes
 *
 * @param transactions - Synced transactions from cloud
 * @param userId - User ID
 * @param traceId - Trace ID for logging
 * @returns Detailed sync result including orphaned images
 */
export async function syncImagesForTransactions(
  transactions: Transaction[],
  userId: UserId,
  traceId: TraceId
): Promise<ImageSyncResult> {
  logger.info('images_sync_started', {
    userId: String(userId),
    transactionCount: transactions.length,
    traceId,
  });

  const result: ImageSyncResult = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    orphaned: 0,
    errors: 0,
    orphanedIds: [],
  };

  for (const transaction of transactions) {
    if (transaction.imageId) {
      result.total++;
      const status = await syncImageForTransaction(transaction, userId, traceId);

      switch (status) {
        case 'created':
          result.created++;
          break;
        case 's3_key_updated':
          result.updated++;
          break;
        case 'skipped_local_exists':
        case 'skipped_no_image':
          result.skipped++;
          break;
        case 'orphaned':
          result.orphaned++;
          result.orphanedIds.push(transaction.imageId);
          break;
        case 'error':
          result.errors++;
          break;
      }
    }
  }

  // Log summary with orphan alert if any
  if (result.orphaned > 0) {
    logger.error(EVENTS.IMAGE_SYNC_ORPHANS_DETECTED, {
      userId: String(userId),
      orphanedCount: result.orphaned,
      orphanedIds: result.orphanedIds,
      message: `${result.orphaned} transactions have imageId but no s3Key. Check Lambda processing.`,
      traceId,
    });
  }

  logger.info('images_sync_complete', {
    userId: String(userId),
    ...result,
    traceId,
  });

  return result;
}
