// React hook to subscribe to upload store
// Pillar L: Bridge between Service layer and React

import { useStore } from 'zustand';
import { uploadStore } from '../stores/uploadStore';
import type { UploadState, UploadTask } from '../stores/uploadStore';

/**
 * Subscribe to upload state
 */
export function useUploadState(): UploadState {
  return useStore(uploadStore);
}

/**
 * Get upload tasks
 */
export function useUploadTasks(): UploadTask[] {
  return useStore(uploadStore, (state) => state.tasks);
}

/**
 * Get upload status
 */
export function useUploadStatus() {
  return useStore(uploadStore, (state) => state.status);
}

/**
 * Get pause reason
 */
export function useUploadPauseReason() {
  return useStore(uploadStore, (state) => state.pauseReason);
}

/**
 * Computed values from upload state
 */
export function useUploadStats() {
  const tasks = useStore(uploadStore, (state) => state.tasks);
  const status = useStore(uploadStore, (state) => state.status);
  const pauseReason = useStore(uploadStore, (state) => state.pauseReason);

  const pendingCount = tasks.filter(
    t => t.status === 'idle' || t.status === 'uploading' || t.status === 'retrying'
  ).length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const successCount = tasks.filter(t => t.status === 'success').length;

  return {
    pendingCount,
    failedCount,
    successCount,
    isPaused: status === 'paused',
    pauseReason,
    isProcessing: status === 'processing',
  };
}
