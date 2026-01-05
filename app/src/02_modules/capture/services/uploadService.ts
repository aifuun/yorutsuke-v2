// Upload Service - Manages upload queue with retry logic
// Pillar L: Pure business logic, no React dependencies
// Pillar D: FSM - single source of truth
// Pillar Q: Intent-ID for idempotency

import { readFile } from '@tauri-apps/plugin-fs';
import type { ImageId, UserId, IntentId, TraceId } from '../../../00_kernel/types';
import { emit } from '../../../00_kernel/eventBus';
import { isNetworkOnline, setupNetworkListeners } from '../../../00_kernel/network';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { canUpload } from '../../../01_domains/receipt';
import { getPresignedUrl, uploadToS3 } from '../adapters/uploadApi';
import { countTodayUploads } from '../adapters/imageDb';
import { uploadStore, shouldRetry, classifyError, RETRY_DELAYS } from '../stores/uploadStore';
import { captureStore } from '../stores/captureStore';
import { fileService } from './fileService';

class UploadService {
  private initialized = false;
  private lastUploadTime: number | null = null;
  private userId: UserId | null = null;
  private dailyLimit = 30;
  private cleanupNetwork: (() => void) | null = null;

  /**
   * Initialize upload service
   * Called once at app startup, registers network listeners
   */
  init(): void {
    if (this.initialized) {
      logger.warn(EVENTS.SERVICE_INITIALIZED, { service: 'UploadService', status: 'already_initialized' });
      return;
    }
    this.initialized = true;

    logger.debug(EVENTS.SERVICE_INITIALIZED, { service: 'UploadService', phase: 'start' });

    // Setup network status listeners
    this.cleanupNetwork = setupNetworkListeners((state, prevState) => {
      if (state === 'online' && prevState === 'offline') {
        logger.info(EVENTS.UPLOAD_QUEUE_RESUMED, { reason: 'network_restored' });
        uploadStore.getState().resume();
        this.processQueue();
      } else if (state === 'offline') {
        logger.info(EVENTS.UPLOAD_QUEUE_PAUSED, { reason: 'offline' });
        uploadStore.getState().pause('offline');
      }
    });

    // Subscribe to store changes to trigger queue processing
    uploadStore.subscribe((state, prevState) => {
      // Process queue when status changes to idle
      if (state.status === 'idle' && prevState.status !== 'idle') {
        this.processQueue();
      }
      // Process queue when new tasks are added
      if (state.tasks.length > prevState.tasks.length) {
        this.processQueue();
      }
    });

    logger.info(EVENTS.SERVICE_INITIALIZED, { service: 'UploadService' });
  }

  /**
   * Set current user and daily limit
   */
  setUser(userId: UserId | null, dailyLimit = 30): void {
    this.userId = userId;
    this.dailyLimit = dailyLimit;
  }

  /**
   * Add file to upload queue
   */
  enqueue(id: ImageId, filePath: string, intentId: IntentId, traceId: TraceId): void {
    logger.debug(EVENTS.UPLOAD_ENQUEUED, { imageId: id, intentId, traceId });
    uploadStore.getState().enqueue({ id, intentId, traceId, filePath });
    this.processQueue();
  }

  /**
   * Process the upload queue
   * Called automatically when queue state changes
   */
  private async processQueue(): Promise<void> {
    const state = uploadStore.getState();

    // Don't process if not ready
    if (!isNetworkOnline() || state.status !== 'idle' || !this.userId) {
      return;
    }

    // Find idle tasks
    const idleTasks = state.getIdleTasks();
    if (idleTasks.length === 0) {
      return;
    }

    // Process first idle task
    const task = idleTasks[0];
    await this.processTask(task.id, task.filePath, task.intentId, task.traceId);
  }

  /**
   * Process a single upload task
   */
  private async processTask(
    id: ImageId,
    filePath: string,
    intentId: IntentId,
    traceId: TraceId
  ): Promise<void> {
    if (!this.userId) return;

    const state = uploadStore.getState();
    if (state.status === 'processing') return;

    // Check quota from database
    const uploadedToday = await countTodayUploads(this.userId);
    const quotaCheck = canUpload(uploadedToday, this.dailyLimit, this.lastUploadTime);

    if (!quotaCheck.allowed) {
      logger.warn(EVENTS.QUOTA_LIMIT_REACHED, { imageId: id, reason: quotaCheck.reason, used: uploadedToday, limit: this.dailyLimit });
      uploadStore.getState().pause('quota');
      return;
    }

    uploadStore.getState().startUpload(id);
    captureStore.getState().startUpload(id);

    try {
      // Get presigned URL
      const { url, key } = await getPresignedUrl(this.userId, `${id}.webp`, intentId);

      // Read file using Tauri fs plugin
      const fileData = await readFile(filePath);
      const blob = new Blob([fileData], { type: 'image/webp' });

      await uploadToS3(url, blob);

      // Success
      this.lastUploadTime = Date.now();
      uploadStore.getState().uploadSuccess(id, key);
      captureStore.getState().uploadSuccess(id, key);

      // Update database
      await fileService.updateStatus(id, 'uploaded', traceId, {
        uploaded_at: new Date().toISOString(),
      });

      // Emit success event
      emit('upload:complete', { id, traceId, s3Key: key });

      logger.info(EVENTS.UPLOAD_COMPLETED, { imageId: id, traceId, s3Key: key });
    } catch (e) {
      const error = String(e);
      const errorType = classifyError(error);
      const task = uploadStore.getState().tasks.find(t => t.id === id);
      const retryCount = (task?.retryCount ?? 0) + 1;
      const willRetry = shouldRetry(errorType, retryCount);

      uploadStore.getState().uploadFailure(id, error, errorType);
      captureStore.getState().failure(id, error);

      // Emit failure event
      emit('upload:failed', {
        id,
        traceId,
        error,
        errorType,
        willRetry,
        retryCount,
      });

      logger.warn(EVENTS.UPLOAD_FAILED, { imageId: id, traceId, error, errorType, willRetry, retryCount });

      // Schedule retry with exponential backoff
      if (willRetry) {
        const delay = RETRY_DELAYS[retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        setTimeout(() => {
          uploadStore.getState().scheduleRetry(id);
        }, delay);
      }
    }
  }

  /**
   * Retry a failed upload
   */
  retry(id: ImageId): void {
    uploadStore.getState().retry(id);
    this.processQueue();
  }

  /**
   * Retry all failed uploads
   */
  retryAllFailed(): void {
    uploadStore.getState().resetAllFailed();
    this.processQueue();
  }

  /**
   * Remove upload from queue
   */
  remove(id: ImageId): void {
    uploadStore.getState().remove(id);
  }

  /**
   * Pause upload queue
   */
  pause(reason: 'offline' | 'quota'): void {
    uploadStore.getState().pause(reason);
  }

  /**
   * Resume upload queue
   */
  resume(): void {
    uploadStore.getState().resume();
    this.processQueue();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cleanupNetwork?.();
    this.initialized = false;
  }
}

export const uploadService = new UploadService();
