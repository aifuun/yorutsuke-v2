// React hook for capture actions
// Pillar L: Bridge between Service layer and React

import { useCallback } from 'react';
import { captureService } from '../services/captureService';
import { uploadService } from '../services/uploadService';
import type { ImageId } from '../../../00_kernel/types';

/**
 * Get capture action handlers
 * These call the service layer methods
 */
export function useCaptureActions() {
  const removeImage = useCallback((id: ImageId) => {
    captureService.removeImage(id);
  }, []);

  const retryImage = useCallback((id: ImageId) => {
    captureService.retryImage(id);
  }, []);

  const retryUpload = useCallback((id: ImageId) => {
    captureService.retryUpload(id);
  }, []);

  const retryAllFailed = useCallback(() => {
    captureService.retryAllFailed();
  }, []);

  const pauseUpload = useCallback(() => {
    uploadService.pause('offline');
  }, []);

  const resumeUpload = useCallback(() => {
    uploadService.resume();
  }, []);

  return {
    removeImage,
    retryImage,
    retryUpload,
    retryAllFailed,
    pauseUpload,
    resumeUpload,
  };
}
