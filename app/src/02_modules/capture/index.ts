// Public API for capture module
// MVP0: Migrated to Service pattern

// Services (entry points, call init() at app startup)
export { captureService } from './services/captureService';
export { uploadService } from './services/uploadService';
export { fileService } from './services/fileService';
export { quotaService } from './services/quotaService';

// React Hooks (bridge to Service layer)
export {
  useCaptureState,
  useCaptureQueue,
  useCaptureStatus,
  useCaptureStats,
} from './hooks/useCaptureState';
export {
  useUploadState,
  useUploadTasks,
  useUploadStatus,
  useUploadPauseReason,
  useUploadStats,
} from './hooks/useUploadState';
export { useDragState } from './hooks/useDragState';
export { useCaptureActions } from './hooks/useCaptureActions';
export { useQuota, useQuotaState, useQuotaStatus } from './hooks/useQuotaState';

// Stores (for advanced usage)
export { captureStore } from './stores/captureStore';
export { uploadStore } from './stores/uploadStore';
export { quotaStore } from './stores/quotaStore';
export type { CaptureState, CaptureStore } from './stores/captureStore';
export type { UploadState, UploadStore, UploadTask } from './stores/uploadStore';
export type { QuotaState, QuotaStore, QuotaStatus } from './stores/quotaStore';

// Views
export { CaptureView, QuotaIndicator } from './views';

// Types
export type {
  DroppedItem,
  DragState,
  DragDropOptions,
  DragDropResult,
} from './types';
export { ALLOWED_EXTENSIONS } from './types';

// Adapters (for cross-module access)
export { updateImagesUserId } from './adapters/imageDb';
