// Upload Service - Manages upload queue with retry logic
// Pillar L: Pure business logic, no React dependencies
// Pillar D: FSM - single source of truth
// Pillar Q: Intent-ID for idempotency

import { readFile } from '@tauri-apps/plugin-fs';
import type { ImageId, UserId, TraceId } from '../../../00_kernel/types';
import { emit } from '../../../00_kernel/eventBus';
import { isNetworkOnline, setupNetworkListeners } from '../../../00_kernel/network';
import { isMockingOffline } from '../../../00_kernel/config/mock';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { canUpload } from '../../../01_domains/receipt';

// Polling interval (1 second) - rate limit is enforced separately by canUpload()
const UPLOAD_POLL_INTERVAL_MS = 1000;
import { getPresignedUrl, uploadToS3 } from '../adapters';
import { fetchQuota } from '../adapters';
import { uploadStore, shouldRetry, classifyError, RETRY_DELAYS } from '../stores/uploadStore';
import { captureStore } from '../stores/captureStore';
import { fileService } from './fileService';

class UploadService {
  private initialized = false;
  private lastUploadTime: number | null = null;
  private userId: UserId | null = null;
  private cleanupNetwork: (() => void) | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

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
        this.startPolling();
      } else if (state === 'offline') {
        logger.info(EVENTS.UPLOAD_QUEUE_PAUSED, { reason: 'offline' });
        uploadStore.getState().pause('offline');
        this.stopPolling();
      }
    });

    // Subscribe to store changes to trigger polling
    uploadStore.subscribe((state, prevState) => {
      // Start polling when status changes to idle or new tasks are added
      if (
        (state.status === 'idle' && prevState.status !== 'idle') ||
        state.tasks.length > prevState.tasks.length
      ) {
        this.startPolling();
      }
    });

    logger.info(EVENTS.SERVICE_INITIALIZED, { service: 'UploadService' });
  }

  /**
   * Set current user for upload operations
   */
  setUser(userId: UserId | null): void {
    this.userId = userId;
  }

  /**
   * Add file to upload queue
   */
  enqueue(id: ImageId, filePath: string, traceId: TraceId): void {
    logger.info(EVENTS.UPLOAD_ENQUEUED, { imageId: id, traceId });
    uploadStore.getState().enqueue({ id, traceId, filePath });
    this.startPolling();
  }

  /**
   * Start polling timer for queue processing
   * Timer runs every 1 second, rate limit enforced by canUpload()
   * Auto-stops when no tasks remain
   */
  startPolling(): void {
    if (this.pollingTimer) return; // Already polling

    logger.debug(EVENTS.UPLOAD_QUEUE_RESUMED, { reason: 'polling_started' });

    // Process immediately, then poll at intervals
    this.processQueue();

    this.pollingTimer = setInterval(() => {
      this.processQueue();
    }, UPLOAD_POLL_INTERVAL_MS);
  }

  /**
   * Stop polling timer
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.debug(EVENTS.UPLOAD_QUEUE_PAUSED, { reason: 'polling_stopped' });
    }
  }

  /**
   * Process the upload queue
   * Called by polling timer every 2 seconds
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
      // No more tasks - stop polling
      this.stopPolling();
      return;
    }

    // Check rate limit before processing
    const quota = await fetchQuota(this.userId);
    const quotaCheck = canUpload(quota.used, quota.limit, this.lastUploadTime);

    if (!quotaCheck.allowed) {
      if (quotaCheck.type === 'quota_exceeded') {
        // Daily quota exceeded - stop polling
        logger.warn(EVENTS.QUOTA_LIMIT_REACHED, { reason: quotaCheck.reason, used: quota.used, limit: quota.limit });
        uploadStore.getState().pause('quota');
        this.stopPolling();
      }
      // Rate limited - just wait for next poll cycle
      return;
    }

    // Process first idle task
    const task = idleTasks[0];
    await this.processTask(task.id, task.filePath, task.traceId);
  }

  /**
   * Process a single upload task
   * Called by processQueue after quota/rate limit checks pass
   */
  private async processTask(
    id: ImageId,
    filePath: string,
    traceId: TraceId
  ): Promise<void> {
    if (!this.userId) return;

    const state = uploadStore.getState();
    if (state.status === 'processing') return;

    uploadStore.getState().startUpload(id);
    captureStore.getState().startUpload(id);
    logger.info(EVENTS.UPLOAD_STARTED, { imageId: id });

    try {
      // Check mocking offline mode (debug feature)
      if (isMockingOffline()) {
        throw new Error('Offline');
      }

      // Get presigned URL
      const { url, key } = await getPresignedUrl(this.userId, `${id}.webp`);

      // Read file using Tauri fs plugin
      const fileData = await readFile(filePath);
      const blob = new Blob([fileData], { type: 'image/webp' });

      await uploadToS3(url, blob);

      // Success
      this.lastUploadTime = Date.now();

      // Update database FIRST (before store updates trigger subscriptions)
      // This prevents SQLite "database is locked" errors from concurrent writes
      await fileService.updateStatus(id, 'uploaded', traceId, {
        uploaded_at: new Date().toISOString(),
      });

      // THEN update stores (subscriptions may trigger new operations)
      uploadStore.getState().uploadSuccess(id, key);
      captureStore.getState().uploadSuccess(id, key);

      // Emit success event
      emit('upload:complete', { id, traceId, s3Key: key });

      // Trigger ledger refresh after upload completes
      // This allows transaction list to refresh if Lambda has already processed the image
      emit('data:refresh', { source: 'image_processed' });

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
    logger.info(EVENTS.UPLOAD_QUEUE_RESUMED, { reason: 'retry', imageId: id });
    uploadStore.getState().retry(id);
    this.startPolling();
  }

  /**
   * Retry all failed uploads
   */
  retryAllFailed(): void {
    const failedCount = uploadStore.getState().tasks.filter(t => t.status === 'failed').length;
    logger.info(EVENTS.UPLOAD_QUEUE_RESUMED, { reason: 'retry_all', count: failedCount });
    uploadStore.getState().resetAllFailed();
    this.startPolling();
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
    this.stopPolling();
  }

  /**
   * Resume upload queue
   */
  resume(): void {
    uploadStore.getState().resume();
    this.startPolling();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPolling();
    this.cleanupNetwork?.();
    this.initialized = false;
  }
}

export const uploadService = new UploadService();
