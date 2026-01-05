// File Service - Handles compression, hash checking, DB operations
// Pillar L: Pure business logic, no React dependencies
// Pillar Q: Intent-ID for idempotency
// Pillar N: TraceId for lifecycle tracking

import type { ImageId, UserId, TraceId, IntentId } from '../../../00_kernel/types';
import { createIntentId, createTraceId, ImageId as createImageId } from '../../../00_kernel/types';
import type { ReceiptImage, ImageStatus } from '../../../01_domains/receipt';
import { emit } from '../../../00_kernel/eventBus';
import { logger } from '../../../00_kernel/telemetry';
import { compressImage, deleteLocalImage } from '../adapters/imageIpc';
import {
  findImageByMd5,
  saveImage,
  updateImageStatus as dbUpdateStatus,
  loadUnfinishedImages,
  resetInterruptedUploads,
} from '../adapters/imageDb';
import { captureStore } from '../stores/captureStore';
import type { ImageRow } from '../../../00_kernel/storage';

/**
 * Convert database row to ReceiptImage for queue restoration
 */
function rowToReceiptImage(row: ImageRow, userId: UserId): ReceiptImage {
  // Reset 'uploading' to 'compressed' since upload was interrupted
  const status = (row.status === 'uploading' ? 'compressed' : row.status) as ImageStatus;

  return {
    id: createImageId(row.id),
    userId,
    intentId: (row.intent_id || createIntentId()) as IntentId,
    traceId: (row.trace_id || createTraceId()) as TraceId,
    status,
    localPath: row.original_path,
    s3Key: row.s3_key,
    thumbnailPath: row.compressed_path,
    originalSize: row.original_size ?? 0,
    compressedSize: row.compressed_size,
    createdAt: row.created_at,
    uploadedAt: null,
    processedAt: null,
  };
}

class FileService {
  private processingIds = new Set<string>();

  /**
   * Process a dropped file: compress → check duplicate → save to DB
   * Returns true if successful, false if duplicate or failed
   */
  async processFile(
    id: ImageId,
    userId: UserId,
    inputPath: string,
    traceId: TraceId,
    intentId: IntentId
  ): Promise<boolean> {
    // Prevent duplicate processing
    if (this.processingIds.has(id)) {
      logger.warn('[FileService] Already processing', { id, traceId });
      return false;
    }

    this.processingIds.add(id);
    captureStore.getState().startProcess(id);

    let compressedPath: string | null = null;

    try {
      logger.debug('[FileService] Starting compression', { id, traceId, intentId });

      // Compress image (MD5 is calculated on WebP output)
      const result = await compressImage(inputPath, id);
      compressedPath = result.outputPath;
      logger.info('[FileService] Compression complete', { id, traceId, md5: result.md5 });

      // Emit image:compressing event
      emit('image:compressing', { id, traceId });

      // Check for duplicate in database
      const existingId = await findImageByMd5(result.md5, traceId);
      if (existingId) {
        logger.info('[FileService] Duplicate detected in database', { id, traceId, duplicateWith: existingId });

        // Clean up compressed file since it's a duplicate
        try {
          await deleteLocalImage(compressedPath);
          logger.debug('[FileService] Cleaned up duplicate file', { id, path: compressedPath });
        } catch {
          // Ignore cleanup errors
        }

        // Emit duplicate event
        emit('image:duplicate', {
          id,
          traceId,
          duplicateWith: String(existingId),
          reason: 'database',
        });

        captureStore.getState().duplicateDetected(id);
        return false;
      }

      // Save to database
      await saveImage(id, userId, traceId, intentId, {
        originalPath: result.originalPath,
        compressedPath: result.outputPath,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        width: result.width,
        height: result.height,
        md5: result.md5,
        status: 'compressed',
        s3Key: null,
      });

      // Emit compressed event
      emit('image:compressed', {
        id,
        traceId,
        compressedPath: result.outputPath,
        preview: result.outputPath,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        md5: result.md5,
      });

      captureStore.getState().processSuccess(id, result.outputPath, result.compressedSize, result.md5);

      logger.info('[FileService] Image processed successfully', { id, traceId, intentId });
      return true;
    } catch (e) {
      logger.error('[FileService] Processing failed', { id, traceId, intentId, error: String(e) });

      // Clean up orphaned compressed file if it was created
      if (compressedPath) {
        try {
          await deleteLocalImage(compressedPath);
          logger.debug('[FileService] Cleaned up orphaned file', { id, path: compressedPath });
        } catch {
          // Ignore cleanup errors
        }
      }

      captureStore.getState().failure(id, String(e));
      return false;
    } finally {
      this.processingIds.delete(id);
    }
  }

  /**
   * Restore queue from database on app startup
   */
  async restoreQueue(userId: UserId): Promise<void> {
    const restoreTraceId = createTraceId();
    logger.info('[FileService] Restoring queue from database', { traceId: restoreTraceId, userId });

    try {
      // Reset any interrupted uploads in DB
      await resetInterruptedUploads(userId, restoreTraceId);

      // Load unfinished images
      const unfinished = await loadUnfinishedImages(userId);

      if (unfinished.length === 0) {
        logger.info('[FileService] No unfinished images to restore');
        return;
      }

      // Convert to ReceiptImage and update store
      const images = unfinished.map(row => rowToReceiptImage(row, userId));
      captureStore.getState().restoreQueue(images);

      logger.info('[FileService] Queue restored', {
        traceId: restoreTraceId,
        count: images.length,
        statuses: images.reduce((acc, img) => {
          acc[img.status] = (acc[img.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });
    } catch (e) {
      logger.error('[FileService] Failed to restore queue', {
        traceId: restoreTraceId,
        error: String(e),
      });
    }
  }

  /**
   * Delete a file and its DB record
   */
  async deleteFile(id: ImageId): Promise<void> {
    const image = captureStore.getState().queue.find(img => img.id === id);
    if (image?.thumbnailPath) {
      try {
        await deleteLocalImage(image.thumbnailPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    captureStore.getState().removeImage(id);
  }

  /**
   * Update image status in database
   */
  async updateStatus(id: ImageId, status: ImageStatus, traceId: TraceId, extra?: Record<string, unknown>): Promise<void> {
    await dbUpdateStatus(id, status, traceId, extra);
  }

  /**
   * Check if a file is being processed
   */
  isProcessing(id: ImageId): boolean {
    return this.processingIds.has(id);
  }
}

export const fileService = new FileService();
