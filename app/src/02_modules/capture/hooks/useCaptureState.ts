// React hook to subscribe to capture store
// Pillar L: Bridge between Service layer and React

import { useStore } from 'zustand';
import { captureStore } from '../stores/captureStore';
import type { CaptureState } from '../stores/captureStore';
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
 * Computed values from capture state
 */
export function useCaptureStats() {
  const queue = useStore(captureStore, (state) => state.queue);
  const skippedCount = useStore(captureStore, (state) => state.skippedCount);

  const pendingCount = queue.filter(img => img.status === 'pending').length;
  const compressingCount = queue.filter(img => img.status === 'compressed').length;
  const uploadingCount = queue.filter(img => img.status === 'uploading').length;
  const uploadedCount = queue.filter(img => img.status === 'uploaded').length;
  const failedCount = queue.filter(img => img.status === 'failed').length;
  const awaitingProcessCount = queue.filter(img =>
    img.status === 'uploaded' && !img.processedAt
  ).length;

  return {
    pendingCount,
    compressingCount,
    uploadingCount,
    uploadedCount,
    failedCount,
    awaitingProcessCount,
    skippedCount,
    totalCount: queue.length,
  };
}
