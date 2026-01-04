// Public API for capture module
export { useCaptureLogic, useDragDrop, useQuota } from './headless';
export type { QuotaStatus } from './headless/useQuota';
export { CaptureView, QuotaIndicator } from './views';
export type {
  DroppedItem,
  DragState,
  DragDropOptions,
  DragDropResult,
  ALLOWED_EXTENSIONS,
} from './types';

// Adapters (for cross-module access)
export { updateImagesUserId } from './adapters/imageDb';
