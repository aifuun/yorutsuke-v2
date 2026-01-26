// React hook to subscribe to capture store
// Pillar L: Bridge between Service layer and React

import { useStore } from 'zustand';
import { captureStore } from '../stores/captureStore';
import type { CaptureState, RejectionInfo } from '../stores/captureStore';
import type { ReceiptImage } from '../../../01_domains/receipt';

/**
 * Subscribe to capture state
 * Use selectors for performance optimization
 */
export function useCaptureState(): CaptureState {
  return useStore(captureStore);
}

/**
 * Get capture queue
 */
export function useCaptureQueue(): ReceiptImage[] {
  return useStore(captureStore, (state) => state.queue);
}

/**
 * Get capture status
 */
export function useCaptureStatus() {
  return useStore(captureStore, (state) => state.status);
}

/**
 * Identity 2 (Selector): Computed primitive values from capture state
 * Returns individual primitive values to comply with ADR-012 (Zustand Selector Safety)
 */
export function usePendingCount(): number {
  return useStore(captureStore, (state) =>
    state.queue.filter(img => img.status === 'pending').length
  );
}

export function useCompressingCount(): number {
  return useStore(captureStore, (state) =>
    state.queue.filter(img => img.status === 'compressed').length
  );
}

export function useUploadingCount(): number {
  return useStore(captureStore, (state) =>
    state.queue.filter(img => img.status === 'uploading').length
  );
}

export function useUploadedCount(): number {
  return useStore(captureStore, (state) =>
    state.queue.filter(img => img.status === 'uploaded').length
  );
}

export function useFailedCount(): number {
  return useStore(captureStore, (state) =>
    state.queue.filter(img => img.status === 'failed').length
  );
}

export function useSkippedCount(): number {
  return useStore(captureStore, (state) =>
    state.queue.filter(img => img.status === 'skipped').length
  );
}

export function useAwaitingProcessCount(): number {
  return useStore(captureStore, (state) =>
    state.queue.filter(img => img.status === 'uploaded' && !img.processedAt).length
  );
}

export function useTotalCount(): number {
  return useStore(captureStore, (state) => state.queue.length);
}

/**
 * @deprecated Use individual primitive selectors instead (ADR-012)
 * Legacy function kept for backward compatibility
 *
 * Migration guide:
 * - useCaptureStats().pendingCount → usePendingCount()
 * - useCaptureStats().uploadedCount → useUploadedCount()
 * etc.
 */
export function useCaptureStats() {
  const pendingCount = usePendingCount();
  const compressingCount = useCompressingCount();
  const uploadingCount = useUploadingCount();
  const uploadedCount = useUploadedCount();
  const failedCount = useFailedCount();
  const skippedCount = useSkippedCount();
  const awaitingProcessCount = useAwaitingProcessCount();
  const totalCount = useTotalCount();

  return {
    pendingCount,
    compressingCount,
    uploadingCount,
    uploadedCount,
    failedCount,
    awaitingProcessCount,
    skippedCount,
    totalCount,
  };
}

/**
 * Get rejection notification state
 */
export function useRejection(): {
  rejection: RejectionInfo | null;
  clearRejection: () => void;
} {
  const rejection = useStore(captureStore, (state) => state.rejection);
  const clearRejection = captureStore.getState().clearRejection;
  return { rejection, clearRejection };
}
