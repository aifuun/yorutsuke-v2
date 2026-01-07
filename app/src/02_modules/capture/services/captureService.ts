// Capture Service - Entry point for image capture
// Pillar L: Pure orchestration, no React dependencies
// Registers Tauri drag-drop listeners at app startup

import type { ImageId, UserId } from '../../../00_kernel/types';
import { createIntentId } from '../../../00_kernel/types';
import type { ReceiptImage } from '../../../01_domains/receipt';
import { MAX_DROP_COUNT } from '../../../01_domains/receipt';
import { emit, on } from '../../../00_kernel/eventBus';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { setupTauriDragListeners } from '../adapters/tauriDragDrop';
import { captureStore } from '../stores/captureStore';
import { fileService } from './fileService';
import { uploadService } from './uploadService';
import type { DroppedItem, DragState } from '../types';
import { ALLOWED_EXTENSIONS } from '../types';

// Drag state for UI feedback (not in store to avoid re-renders)
let currentDragState: DragState = 'idle';
const dragStateListeners = new Set<(state: DragState) => void>();

// Polling interval for local processing (1 second)
const PROCESS_POLL_INTERVAL_MS = 1000;

class CaptureService {
  private initialized = false;
  private userId: UserId | null = null;
  private cleanupTauri: (() => void) | null = null;
  private cleanupAuthSubscription: (() => void) | null = null;
  private processingTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize capture service
   * Called once at app startup, registers Tauri listeners
   */
  async init(): Promise<void> {
    if (this.initialized) {
      logger.warn(EVENTS.SERVICE_INITIALIZED, { service: 'CaptureService', status: 'already_initialized' });
      return;
    }
    this.initialized = true;

    logger.debug(EVENTS.SERVICE_INITIALIZED, { service: 'CaptureService', phase: 'start' });

    // Initialize upload service
    uploadService.init();

    // Setup Tauri drag-drop listeners (once, not in React lifecycle)
    this.cleanupTauri = await setupTauriDragListeners(
      {
        onDrop: (items, rejectedPaths) => {
          this.handleDrop(items, rejectedPaths);
        },
        onDragEnter: () => {
          this.setDragState('dragging');
        },
        onDragLeave: () => {
          this.setDragState('idle');
        },
      },
      ALLOWED_EXTENSIONS
    );

    // Subscribe to auth:dataClaimed event to clear queue
    this.cleanupAuthSubscription = on('auth:dataClaimed', (payload) => {
      logger.info(EVENTS.AUTH_GUEST_DATA_CLAIMED, {
        count: payload.count,
        oldUserId: payload.oldUserId,
        newUserId: payload.newUserId,
      });
      captureStore.getState().clearQueue();
      // Restore queue with new userId
      if (this.userId) {
        fileService.restoreQueue(this.userId as UserId);
      }
    });

    // Subscribe to store changes for auto-upload enqueue
    captureStore.subscribe((state) => {
      // Auto-enqueue compressed images for upload
      this.enqueueCompressedImages(state.queue);
    });

    logger.info(EVENTS.SERVICE_INITIALIZED, { service: 'CaptureService' });
  }

  /**
   * Start polling for pending images
   * Immediately processes, then polls every 1 second
   * Auto-stops when no pending images remain
   */
  private startProcessingPolling(): void {
    if (this.processingTimer) return; // Already polling

    logger.debug(EVENTS.QUEUE_AUTO_PROCESS, { phase: 'polling_started' });

    // Process immediately, then poll at intervals
    this.processPendingImages();

    this.processingTimer = setInterval(() => {
      this.processPendingImages();
    }, PROCESS_POLL_INTERVAL_MS);
  }

  /**
   * Stop processing polling
   */
  private stopProcessingPolling(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
      logger.debug(EVENTS.QUEUE_AUTO_PROCESS, { phase: 'polling_stopped' });
    }
  }

  /**
   * Set current user ID and restore queue
   */
  async setUser(userId: UserId | null): Promise<void> {
    this.userId = userId;
    uploadService.setUser(userId);

    if (userId) {
      await fileService.restoreQueue(userId);
      // Start polling to process any restored pending images
      this.startProcessingPolling();
    }
  }

  /**
   * Handle dropped files from Tauri
   */
  private handleDrop(items: DroppedItem[], rejectedPaths: string[]): void {
    this.setDragState('idle');

    // Notify UI about rejected files
    if (rejectedPaths.length > 0) {
      logger.warn(EVENTS.IMAGE_REJECTED, { count: rejectedPaths.length, paths: rejectedPaths });
      captureStore.getState().setRejection(rejectedPaths.length);
    }

    if (items.length === 0) return;

    // Apply drop limit to prevent accidental bulk drops
    let acceptedItems = items;
    if (items.length > MAX_DROP_COUNT) {
      logger.warn(EVENTS.IMAGE_REJECTED, {
        reason: 'drop_limit_exceeded',
        dropped: items.length,
        accepted: MAX_DROP_COUNT,
      });
      acceptedItems = items.slice(0, MAX_DROP_COUNT);
      // Add excess count to rejection notification
      captureStore.getState().setRejection(items.length - MAX_DROP_COUNT, 'limit');
    }

    logger.info(EVENTS.IMAGE_DROPPED, { count: acceptedItems.length });

    // Add each item to queue
    for (const item of acceptedItems) {
      if (!this.userId) {
        logger.warn(EVENTS.IMAGE_PROCESSING_SKIPPED, { imageId: item.id, reason: 'no_user_id' });
        continue;
      }

      const intentId = createIntentId();

      // Create ReceiptImage and add to store
      const image: ReceiptImage = {
        id: item.id,
        userId: this.userId,
        intentId,
        traceId: item.traceId,
        status: 'pending',
        localPath: item.localPath,
        s3Key: null,
        thumbnailPath: null,
        originalSize: 0,
        compressedSize: null,
        md5: null,
        createdAt: new Date().toISOString(),
        uploadedAt: null,
        processedAt: null,
      };

      captureStore.getState().addImage(image);

      // Emit image:pending event
      emit('image:pending', {
        id: item.id,
        traceId: item.traceId,
        name: item.name,
        source: 'drop',
        preview: item.preview,
        localPath: item.localPath,
      });

      logger.debug(EVENTS.IMAGE_DROPPED, { imageId: item.id, traceId: item.traceId, source: 'queue_added' });
    }

    // Start processing polling
    this.startProcessingPolling();
  }

  /**
   * Process pending images in queue
   * Called by polling timer every 1 second
   */
  private async processPendingImages(): Promise<void> {
    const state = captureStore.getState();

    // Only process when idle
    if (state.status !== 'idle') return;

    // Find pending images not being processed
    const pendingImages = state.queue.filter(
      img => img.status === 'pending' && !fileService.isProcessing(img.id)
    );

    if (pendingImages.length === 0) {
      // No more pending images - stop polling
      this.stopProcessingPolling();
      return;
    }

    // Process first pending image
    const image = pendingImages[0];

    logger.debug(EVENTS.QUEUE_AUTO_PROCESS, {
      imageId: image.id,
      traceId: image.traceId,
    });

    await fileService.processFile(
      image.id,
      image.userId,
      image.localPath,
      image.traceId,
      image.intentId
    );
  }

  /**
   * Auto-enqueue compressed images for upload
   */
  private enqueueCompressedImages(queue: ReceiptImage[]): void {
    const compressedImages = queue.filter(img => img.status === 'compressed');
    logger.debug(EVENTS.QUOTA_CHECKED, {
      phase: 'enqueue_start',
      totalQueue: queue.length,
      compressedCount: compressedImages.length,
      uploadTaskCount: uploadStore.getState().tasks.length,
    });

    for (const image of queue) {
      if (image.status !== 'compressed') continue;

      // Check if already in upload queue
      const inQueue = uploadStore.getState().tasks.some(t => t.id === image.id);
      if (inQueue) {
        logger.debug(EVENTS.QUEUE_AUTO_UPLOAD, { phase: 'already_in_queue', imageId: image.id });
        continue;
      }

      const compressedPath = image.thumbnailPath || image.localPath;

      logger.debug(EVENTS.QUEUE_AUTO_UPLOAD, {
        imageId: image.id,
        traceId: image.traceId,
        intentId: image.intentId,
      });

      uploadService.enqueue(image.id, compressedPath, image.intentId, image.traceId);
    }
  }

  /**
   * Set drag state (for UI feedback)
   */
  private setDragState(state: DragState): void {
    if (currentDragState === state) return;
    currentDragState = state;
    dragStateListeners.forEach(listener => listener(state));
  }

  /**
   * Subscribe to drag state changes
   */
  subscribeToDragState(listener: (state: DragState) => void): () => void {
    dragStateListeners.add(listener);
    return () => {
      dragStateListeners.delete(listener);
    };
  }

  /**
   * Get current drag state
   */
  getDragState(): DragState {
    return currentDragState;
  }

  /**
   * Remove image from queue
   */
  removeImage(id: ImageId): void {
    captureStore.getState().removeImage(id);
    uploadService.remove(id);
  }

  /**
   * Retry a failed image
   */
  retryImage(id: ImageId): void {
    const image = captureStore.getState().queue.find(img => img.id === id);
    if (!image) return;

    logger.info(EVENTS.QUEUE_AUTO_PROCESS, { phase: 'retry', imageId: id });

    // Reset to pending for reprocessing
    const retryImage: ReceiptImage = {
      ...image,
      status: 'pending',
      error: undefined,
    };

    captureStore.getState().removeImage(id);
    captureStore.getState().addImage(retryImage);
    this.startProcessingPolling();
  }

  /**
   * Retry a failed upload
   */
  retryUpload(id: ImageId): void {
    uploadService.retry(id);
  }

  /**
   * Retry all failed uploads
   */
  retryAllFailed(): void {
    uploadService.retryAllFailed();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopProcessingPolling();
    this.cleanupTauri?.();
    this.cleanupAuthSubscription?.();
    uploadService.destroy();
    this.initialized = false;
    dragStateListeners.clear();
  }
}

// Import uploadStore for enqueue check
import { uploadStore } from '../stores/uploadStore';

export const captureService = new CaptureService();
