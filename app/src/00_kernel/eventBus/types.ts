// Event Bus Type Definitions
// Pillar G: Traceability - Type-safe event system for AI-traceable communication

import type { ImageId, TraceId } from '../types';

// Error types for upload failures
export type UploadErrorType = 'network' | 'quota' | 'server' | 'unknown';

// Image input source
export type ImageSource = 'drop' | 'paste' | 'select';

// Image processing stage
export type ImageStage = 'compress' | 'save' | 'upload';

/**
 * @module EventBus
 * @triggers All app events
 * @listens None (this is the event source)
 *
 * Event naming convention:
 * - domain:action (e.g., 'image:pending', 'upload:complete')
 * - Past tense for completed actions, present for in-progress
 */
export interface AppEvents {
  // =========================================================================
  // Image Lifecycle Events
  // =========================================================================

  /**
   * @trigger image:pending
   * @payload New image dropped/pasted, awaiting processing
   * Pillar N: traceId tracks entire lifecycle from drop to confirm
   */
  'image:pending': {
    id: ImageId;
    traceId: TraceId;      // Pillar N: Lifecycle tracking
    name: string;
    source: ImageSource;
    preview?: string;      // Available for drag-drop
    file?: File;           // For paste/select
    localPath?: string;    // For drag-drop
  };

  /**
   * @trigger image:compressing
   * @payload Image compression started
   */
  'image:compressing': {
    id: ImageId;
    traceId: TraceId;
  };

  /**
   * @trigger image:progress
   * @payload Processing progress update
   */
  'image:progress': {
    id: ImageId;
    traceId: TraceId;
    progress: number;      // 0-100
    stage: ImageStage;
  };

  /**
   * @trigger image:compressed
   * @payload Image compression completed
   */
  'image:compressed': {
    id: ImageId;
    traceId: TraceId;
    compressedPath: string;
    preview: string;
    originalSize: number;
    compressedSize: number;
    md5: string;
  };

  /**
   * @trigger image:duplicate
   * @payload Duplicate image detected (traceId continues to track skipped image)
   */
  'image:duplicate': {
    id: ImageId;
    traceId: TraceId;
    duplicateWith: string;     // ID of the existing image
    reason: 'queue' | 'database';
  };

  /**
   * @trigger image:queued
   * @payload Image added to upload queue
   */
  'image:queued': {
    id: ImageId;
    traceId: TraceId;
  };

  /**
   * @trigger image:failed
   * @payload Image processing failed
   */
  'image:failed': {
    id: ImageId;
    traceId: TraceId;
    error: string;
    stage: ImageStage;
    recoverable: boolean;  // true = keep for retry, false = remove
  };

  /**
   * @trigger image:deleted
   * @payload Image deleted
   */
  'image:deleted': {
    id: ImageId;
    traceId: TraceId;
    s3Key?: string;
    mode: 'local' | 'cloud' | 'permanent' | 'wipe';
  };

  // =========================================================================
  // Scanner Events
  // =========================================================================

  /**
   * @trigger scanner:ready
   * @payload Scanner finished auto-detection, ready for user review
   */
  'scanner:ready': {
    fileName: string;
  };

  /**
   * @trigger scanner:completed
   * @payload Scanner workflow completed
   */
  'scanner:completed': {
    fileName: string;
    cropped: boolean;  // true = cropped, false = original upload
  };

  /**
   * @trigger scanner:canceled
   * @payload User canceled scanning
   */
  'scanner:canceled': Record<string, never>;

  // =========================================================================
  // Upload Events
  // =========================================================================

  /**
   * @trigger upload:complete
   * @payload Single image upload completed
   */
  'upload:complete': {
    id: ImageId;
    traceId: TraceId;
    s3Key: string;
  };

  /**
   * @trigger upload:failed
   * @payload Upload failed
   */
  'upload:failed': {
    id: ImageId;
    traceId: TraceId;
    error: string;
    errorType: UploadErrorType;
    willRetry: boolean;
    retryCount: number;
  };

  /**
   * @trigger upload:batch-complete
   * @payload Batch upload session completed
   */
  'upload:batch-complete': {
    count: number;
    successCount: number;
    failCount: number;
  };

  // =========================================================================
  // Network Events
  // =========================================================================

  /**
   * @trigger network:changed
   * @payload Network status changed
   */
  'network:changed': {
    online: boolean;
  };

  // =========================================================================
  // Data Sync Events
  // =========================================================================

  /**
   * @trigger data:refresh
   * @payload Request data refresh from source
   */
  'data:refresh': {
    source: string;
  };

  // =========================================================================
  // Auth Events
  // =========================================================================

  /**
   * @trigger auth:dataClaimed
   * @payload Guest data claimed on registration/login
   * Used to notify capture module to clear local queue after migration
   */
  'auth:dataClaimed': {
    count: number;
    oldUserId: string;  // device-{machineId}
    newUserId: string;  // user-{cognitoSub}
  };

  // =========================================================================
  // Quota Events
  // =========================================================================

  /**
   * @trigger quota:reset
   * @payload Quota was reset (debug action) - all views should refresh
   */
  'quota:reset': {
    count: number;  // Number of uploads reset
  };

  // =========================================================================
  // Transaction Events
  // =========================================================================

  /**
   * @trigger transaction:synced
   * @payload Transaction sync completed (from cloud)
   */
  'transaction:synced': {
    count: number;  // Number of transactions synced
    source: 'auto' | 'manual';
  };

  /**
   * @trigger transaction:confirmed
   * @payload Transaction confirmed by user
   */
  'transaction:confirmed': {
    id: string;  // TransactionId
  };

  /**
   * @trigger transaction:updated
   * @payload Transaction updated by user
   */
  'transaction:updated': {
    id: string;  // TransactionId
  };

  /**
   * @trigger transaction:deleted
   * @payload Transaction deleted by user
   */
  'transaction:deleted': {
    id: string;  // TransactionId
  };

  /**
   * @trigger transaction:sync-error
   * @payload Transaction sync failed
   */
  'transaction:sync-error': {
    error: string;
    source: 'auto' | 'manual';
  };
}

export type AppEventKey = keyof AppEvents;
