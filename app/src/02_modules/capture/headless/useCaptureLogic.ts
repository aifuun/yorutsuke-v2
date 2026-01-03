// Pillar L: Headless - logic without UI
// Pillar D: FSM - no boolean flags
// Pillar Q: Intent-ID for idempotency
// Pillar N: TraceId for lifecycle tracking
import { useReducer, useCallback, useEffect, useRef } from 'react';
import type { ImageId, UserId, TraceId, IntentId } from '../../../00_kernel/types';
import { ImageId as createImageId, createTraceId, createIntentId } from '../../../00_kernel/types';
import type { ReceiptImage, ImageStatus } from '../../../01_domains/receipt';
import { compressImage, deleteLocalImage } from '../adapters/imageIpc';
import {
  findImageByMd5,
  saveImage,
  updateImageStatus as dbUpdateStatus,
  loadUnfinishedImages,
  resetInterruptedUploads,
} from '../adapters/imageDb';
import { emit } from '../../../00_kernel/eventBus';
import { logger } from '../../../00_kernel/telemetry';
import { useUploadQueue } from './useUploadQueue';
import type { ImageRow } from '../../../00_kernel/storage';

// FSM State
// Note: 'error' state removed - errors are stored per-image, not globally
// This allows processing to continue even when some images fail
type State =
  | { status: 'idle'; queue: ReceiptImage[] }
  | { status: 'processing'; queue: ReceiptImage[]; currentId: ImageId }
  | { status: 'uploading'; queue: ReceiptImage[]; currentId: ImageId };

type Action =
  | { type: 'ADD_IMAGE'; image: ReceiptImage }
  | { type: 'RESTORE_QUEUE'; images: ReceiptImage[] }  // Bulk restore from DB on startup
  | { type: 'START_PROCESS'; id: ImageId }
  | { type: 'PROCESS_SUCCESS'; id: ImageId; compressedPath: string; compressedSize: number; md5: string }
  | { type: 'DUPLICATE_DETECTED'; id: ImageId; duplicateWith: ImageId }
  | { type: 'START_UPLOAD'; id: ImageId }
  | { type: 'UPLOAD_SUCCESS'; id: ImageId; s3Key: string }
  | { type: 'FAILURE'; id: ImageId; error: string }
  | { type: 'REMOVE'; id: ImageId };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_IMAGE':
      return {
        ...state,
        queue: [...state.queue, action.image],
      };

    case 'RESTORE_QUEUE':
      // Bulk add restored images, avoiding duplicates
      return {
        ...state,
        queue: [
          ...state.queue,
          ...action.images.filter(img => !state.queue.some(q => q.id === img.id)),
        ],
      };

    case 'START_PROCESS':
      return {
        status: 'processing',
        queue: updateImageStatus(state.queue, action.id, 'pending'),
        currentId: action.id,
      };

    case 'PROCESS_SUCCESS':
      return {
        status: 'idle',
        queue: state.queue.map(img =>
          img.id === action.id
            ? { ...img, status: 'compressed' as ImageStatus, compressedSize: action.compressedSize }
            : img
        ),
      };

    case 'DUPLICATE_DETECTED':
      // Remove duplicate from queue (it's a duplicate, don't process)
      return {
        status: 'idle',
        queue: state.queue.filter(img => img.id !== action.id),
      };

    case 'START_UPLOAD':
      return {
        status: 'uploading',
        queue: updateImageStatus(state.queue, action.id, 'uploading'),
        currentId: action.id,
      };

    case 'UPLOAD_SUCCESS':
      return {
        status: 'idle',
        queue: state.queue.map(img =>
          img.id === action.id
            ? { ...img, status: 'uploaded' as ImageStatus, s3Key: action.s3Key, uploadedAt: new Date().toISOString() }
            : img
        ),
      };

    case 'FAILURE':
      // Return to 'idle' so other pending images can continue processing
      // Error is stored on individual image, not globally
      return {
        status: 'idle',
        queue: state.queue.map(img =>
          img.id === action.id
            ? { ...img, status: 'failed' as ImageStatus, error: action.error }
            : img
        ),
      };

    case 'REMOVE':
      return {
        ...state,
        queue: state.queue.filter(img => img.id !== action.id),
      };

    default:
      return state;
  }
}

function updateImageStatus(queue: ReceiptImage[], id: ImageId, status: ImageStatus): ReceiptImage[] {
  return queue.map(img => (img.id === id ? { ...img, status } : img));
}

/**
 * Convert database row to ReceiptImage for queue restoration
 * Handles status mapping for interrupted operations
 */
function rowToReceiptImage(row: ImageRow, userId: UserId): ReceiptImage {
  // Reset 'uploading' to 'compressed' since upload was interrupted
  const status = (row.status === 'uploading' ? 'compressed' : row.status) as ImageStatus;

  return {
    id: createImageId(row.id),
    userId,
    // Use existing IDs from DB, or create new ones if missing (legacy data)
    intentId: (row.intent_id || createIntentId()) as IntentId,
    traceId: (row.trace_id || createTraceId()) as TraceId,
    status,
    localPath: row.original_path,
    s3Key: row.s3_key,
    thumbnailPath: row.compressed_path,
    originalSize: row.original_size ?? 0,
    compressedSize: row.compressed_size,
    createdAt: row.created_at,
    // These fields are not in ImageRow yet, set to null for now
    // TODO: Add uploaded_at and processed_at columns to images table
    uploadedAt: null,
    processedAt: null,
  };
}

/**
 * Capture Logic Hook
 *
 * Orchestrates the full image lifecycle:
 * Drop → Compress → Upload → Cloud Processing
 *
 * @param userId - Current user ID
 * @param dailyLimit - Daily upload limit (from useQuota)
 */
export function useCaptureLogic(userId: UserId | null, dailyLimit: number = 30) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle', queue: [] });
  const processingRef = useRef<Set<string>>(new Set()); // Track images being processed
  const restoredRef = useRef(false); // Prevent double restoration in StrictMode

  // Integrate upload queue (Pillar L: composition over inheritance)
  const uploadQueue = useUploadQueue(userId, dailyLimit);

  // =========================================================================
  // Queue Restoration: Load unfinished images from DB on startup
  // =========================================================================
  useEffect(() => {
    if (!userId || restoredRef.current) return;
    restoredRef.current = true;

    async function restoreQueue() {
      const restoreTraceId = createTraceId();
      logger.info('[CaptureLogic] Restoring queue from database', { traceId: restoreTraceId, userId });

      try {
        // Reset any interrupted uploads in DB (filtered by userId for multi-user isolation)
        await resetInterruptedUploads(userId!, restoreTraceId);

        // Load unfinished images (filtered by userId for multi-user isolation)
        const unfinished = await loadUnfinishedImages(userId!);

        if (unfinished.length === 0) {
          logger.info('[CaptureLogic] No unfinished images to restore');
          return;
        }

        // Convert to ReceiptImage and dispatch
        // userId is guaranteed non-null here due to the guard at the top of useEffect
        const images = unfinished.map(row => rowToReceiptImage(row, userId!));
        dispatch({ type: 'RESTORE_QUEUE', images });

        logger.info('[CaptureLogic] Queue restored', {
          traceId: restoreTraceId,
          count: images.length,
          statuses: images.reduce((acc, img) => {
            acc[img.status] = (acc[img.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        });
      } catch (e) {
        logger.error('[CaptureLogic] Failed to restore queue', {
          traceId: restoreTraceId,
          error: String(e),
        });
      }
    }

    restoreQueue();
  }, [userId]);

  const addImage = useCallback((image: ReceiptImage) => {
    dispatch({ type: 'ADD_IMAGE', image });
  }, []);

  const processImage = useCallback(async (id: ImageId, imageUserId: UserId, inputPath: string, traceId: TraceId, intentId: IntentId) => {
    dispatch({ type: 'START_PROCESS', id });
    let compressedPath: string | null = null; // Track for cleanup on failure

    try {
      logger.debug('[CaptureLogic] Starting compression', { id, traceId, intentId });

      // Compress image (MD5 is calculated on WebP output)
      const result = await compressImage(inputPath, id);
      compressedPath = result.outputPath; // Track for potential cleanup
      logger.info('[CaptureLogic] Compression complete', { id, traceId, md5: result.md5 });

      // Emit image:compressing event
      emit('image:compressing', { id, traceId });

      // Check for duplicate in database
      const existingId = await findImageByMd5(result.md5, traceId);
      if (existingId) {
        logger.info('[CaptureLogic] Duplicate detected in database', { id, traceId, duplicateWith: existingId });

        // Clean up compressed file since it's a duplicate - fixes #49
        try {
          await deleteLocalImage(compressedPath);
          logger.debug('[CaptureLogic] Cleaned up duplicate file', { id, path: compressedPath });
        } catch {
          // Ignore cleanup errors
        }

        // @trigger image:duplicate - TraceId continues to track why image was skipped
        emit('image:duplicate', {
          id,
          traceId,
          duplicateWith: String(existingId),
          reason: 'database',
        });

        dispatch({ type: 'DUPLICATE_DETECTED', id, duplicateWith: existingId });
        return;
      }

      // Save to database (Pillar N: traceId, Pillar Q: intentId, #48: userId)
      await saveImage(id, imageUserId, traceId, intentId, {
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

      // @trigger image:compressed
      emit('image:compressed', {
        id,
        traceId,
        compressedPath: result.outputPath,
        preview: result.outputPath, // Use compressed path as preview
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        md5: result.md5,
      });

      dispatch({
        type: 'PROCESS_SUCCESS',
        id,
        compressedPath: result.outputPath,
        compressedSize: result.compressedSize,
        md5: result.md5,
      });

      logger.info('[CaptureLogic] Image processed successfully', { id, traceId, intentId });
    } catch (e) {
      logger.error('[CaptureLogic] Processing failed', { id, traceId, intentId, error: String(e) });

      // Clean up orphaned compressed file if it was created - fixes #49
      if (compressedPath) {
        try {
          await deleteLocalImage(compressedPath);
          logger.debug('[CaptureLogic] Cleaned up orphaned file', { id, path: compressedPath });
        } catch {
          // Ignore cleanup errors - file may not exist or already deleted
        }
      }

      dispatch({ type: 'FAILURE', id, error: String(e) });
    }
  }, []);

  const removeImage = useCallback((id: ImageId) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  // =========================================================================
  // Auto-processing: Pending → Compressed
  // =========================================================================
  useEffect(() => {
    // Only process when FSM is idle
    if (state.status !== 'idle') return;

    // Find pending images that aren't being processed
    const pendingImages = state.queue.filter(
      img => img.status === 'pending' && !processingRef.current.has(img.id)
    );

    if (pendingImages.length === 0) return;

    // Process the first pending image
    const image = pendingImages[0];
    processingRef.current.add(image.id);

    logger.info('[CaptureLogic] Auto-processing pending image', {
      id: image.id,
      traceId: image.traceId,
    });

    // Async IIFE to avoid making useEffect async
    (async () => {
      try {
        await processImage(image.id, image.userId, image.localPath, image.traceId, image.intentId);
      } finally {
        processingRef.current.delete(image.id);
      }
    })();
  }, [state.status, state.queue, processImage]);

  // =========================================================================
  // Auto-enqueue: Compressed → Upload Queue
  // =========================================================================
  useEffect(() => {
    // Find compressed images not yet in upload queue
    const compressedImages = state.queue.filter(img => img.status === 'compressed');

    for (const image of compressedImages) {
      // Check if already in upload queue
      const inQueue = uploadQueue.state.tasks.some(t => t.id === image.id);
      if (inQueue) continue;

      // Get compressed path from local storage (assume it's saved during compression)
      // The compressed path follows pattern: {tempDir}/{imageId}.webp
      const compressedPath = image.thumbnailPath || image.localPath;

      logger.info('[CaptureLogic] Auto-enqueueing for upload', {
        id: image.id,
        traceId: image.traceId,
        intentId: image.intentId,
      });

      uploadQueue.enqueue(image.id, compressedPath, image.intentId, image.traceId);

      // Update local state to uploading
      dispatch({ type: 'START_UPLOAD', id: image.id });
    }
  }, [state.queue, uploadQueue]);

  // =========================================================================
  // Sync upload queue success/failure back to local state
  // =========================================================================
  useEffect(() => {
    for (const task of uploadQueue.state.tasks) {
      const localImage = state.queue.find(img => img.id === task.id);
      if (!localImage) continue;

      // Sync success
      if (task.status === 'success' && localImage.status !== 'uploaded') {
        // Find the s3Key from the task (it's set after upload)
        dispatch({ type: 'UPLOAD_SUCCESS', id: task.id, s3Key: `${task.id}.webp` });

        // Update database
        dbUpdateStatus(task.id, 'uploaded', task.traceId, {
          uploaded_at: new Date().toISOString(),
        });
      }

      // Sync failure (only permanent failures, not retrying)
      if (task.status === 'failed' && localImage.status !== 'failed') {
        dispatch({ type: 'FAILURE', id: task.id, error: task.error || 'Upload failed' });
      }
    }
  }, [uploadQueue.state.tasks, state.queue]);

  // Retry a failed image (reset to pending for reprocessing)
  const retryImage = useCallback((id: ImageId) => {
    dispatch({
      type: 'ADD_IMAGE',
      image: {
        ...state.queue.find(img => img.id === id)!,
        status: 'pending',
        error: undefined,
      },
    });
    dispatch({ type: 'REMOVE', id });
  }, [state.queue]);

  // Computed counts
  const pendingCount = state.queue.filter(img => img.status === 'pending').length;
  const uploadedCount = state.queue.filter(img => img.status === 'uploaded').length;
  const failedCount = state.queue.filter(img => img.status === 'failed').length;
  // Awaiting processing: uploaded but not yet processed by AI batch
  // TODO: Query from backend when batch-process Lambda is implemented
  const awaitingProcessCount = state.queue.filter(img =>
    img.status === 'uploaded' && !img.processedAt
  ).length;

  return {
    state,
    addImage,
    processImage,
    removeImage,
    retryImage,
    // Upload queue pass-through
    retryUpload: uploadQueue.retry,
    retryAllFailed: uploadQueue.retryAllFailed,
    // Computed
    pendingCount,
    uploadedCount,
    failedCount,
    awaitingProcessCount,
    remainingQuota: dailyLimit - uploadedCount,
    // Upload status
    isOnline: uploadQueue.isOnline,
    isPaused: uploadQueue.isPaused,
    pauseReason: uploadQueue.pauseReason,
    uploadFailedCount: uploadQueue.failedCount,
  };
}
