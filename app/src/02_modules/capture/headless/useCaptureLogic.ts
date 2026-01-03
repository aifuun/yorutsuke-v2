// Pillar L: Headless - logic without UI
// Pillar D: FSM - no boolean flags
// Pillar Q: Intent-ID for idempotency
import { useReducer, useCallback } from 'react';
import type { ImageId, UserId } from '../../../00_kernel/types';
import type { ReceiptImage, ImageStatus } from '../../../01_domains/receipt';
import { canUpload } from '../../../01_domains/receipt';
import { compressImage } from '../adapters/imageIpc';
import { getPresignedUrl, uploadToS3 } from '../adapters/uploadApi';

// FSM State
type State =
  | { status: 'idle'; queue: ReceiptImage[] }
  | { status: 'processing'; queue: ReceiptImage[]; currentId: ImageId }
  | { status: 'uploading'; queue: ReceiptImage[]; currentId: ImageId }
  | { status: 'error'; queue: ReceiptImage[]; error: string };

type Action =
  | { type: 'ADD_IMAGE'; image: ReceiptImage }
  | { type: 'START_PROCESS'; id: ImageId }
  | { type: 'PROCESS_SUCCESS'; id: ImageId; compressedPath: string; compressedSize: number }
  | { type: 'START_UPLOAD'; id: ImageId }
  | { type: 'UPLOAD_SUCCESS'; id: ImageId; s3Key: string }
  | { type: 'FAILURE'; id: ImageId; error: string }
  | { type: 'REMOVE'; id: ImageId };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_IMAGE':
      return {
        ...state,
        queue: [...state.queue, action.image],
      };

    case 'START_PROCESS':
      return {
        status: 'processing',
        queue: updateImageStatus(state.queue, action.id, 'pending'),
        currentId: action.id,
      };

    case 'PROCESS_SUCCESS':
      return {
        status: 'idle',
        queue: state.queue.map(img =>
          img.id === action.id
            ? { ...img, status: 'compressed' as ImageStatus, compressedSize: action.compressedSize }
            : img
        ),
      };

    case 'START_UPLOAD':
      return {
        status: 'uploading',
        queue: updateImageStatus(state.queue, action.id, 'uploading'),
        currentId: action.id,
      };

    case 'UPLOAD_SUCCESS':
      return {
        status: 'idle',
        queue: state.queue.map(img =>
          img.id === action.id
            ? { ...img, status: 'uploaded' as ImageStatus, s3Key: action.s3Key, uploadedAt: new Date().toISOString() }
            : img
        ),
      };

    case 'FAILURE':
      return {
        status: 'error',
        queue: updateImageStatus(state.queue, action.id, 'failed'),
        error: action.error,
      };

    case 'REMOVE':
      return {
        ...state,
        queue: state.queue.filter(img => img.id !== action.id),
      };

    default:
      return state;
  }
}

function updateImageStatus(queue: ReceiptImage[], id: ImageId, status: ImageStatus): ReceiptImage[] {
  return queue.map(img => (img.id === id ? { ...img, status } : img));
}

/**
 * Capture Logic Hook
 *
 * @param userId - Current user ID
 * @param dailyLimit - Daily upload limit (from useQuota)
 */
export function useCaptureLogic(userId: UserId | null, dailyLimit: number = 30) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle', queue: [] });

  const addImage = useCallback((image: ReceiptImage) => {
    dispatch({ type: 'ADD_IMAGE', image });
  }, []);

  const processImage = useCallback(async (id: ImageId, inputPath: string) => {
    dispatch({ type: 'START_PROCESS', id });
    try {
      // compressImage now takes (inputPath, imageId) and returns result with outputPath
      const result = await compressImage(inputPath, id);
      dispatch({
        type: 'PROCESS_SUCCESS',
        id,
        compressedPath: result.outputPath,
        compressedSize: result.compressedSize,
      });
    } catch (e) {
      dispatch({ type: 'FAILURE', id, error: String(e) });
    }
  }, []);

  const uploadImage = useCallback(async (id: ImageId, filePath: string) => {
    if (!userId) {
      dispatch({ type: 'FAILURE', id, error: 'Not authenticated' });
      return;
    }

    // Find the image to get its intentId (Pillar Q)
    const image = state.queue.find(img => img.id === id);
    if (!image) {
      dispatch({ type: 'FAILURE', id, error: 'Image not found in queue' });
      return;
    }

    // Check quota
    const uploadedToday = state.queue.filter(
      img => img.status === 'uploaded' || img.status === 'processing'
    ).length;
    const check = canUpload(uploadedToday, dailyLimit, null);
    if (!check.allowed) {
      dispatch({ type: 'FAILURE', id, error: check.reason! });
      return;
    }

    dispatch({ type: 'START_UPLOAD', id });
    try {
      // Pass intentId for idempotency (Pillar Q)
      const { url, key } = await getPresignedUrl(userId, `${id}.webp`, image.intentId);
      const response = await fetch(filePath);
      const blob = await response.blob();
      await uploadToS3(url, blob);
      dispatch({ type: 'UPLOAD_SUCCESS', id, s3Key: key });
    } catch (e) {
      dispatch({ type: 'FAILURE', id, error: String(e) });
    }
  }, [userId, state.queue]);

  const removeImage = useCallback((id: ImageId) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  // Computed counts
  const pendingCount = state.queue.filter(img => img.status === 'pending').length;
  const uploadedCount = state.queue.filter(img => img.status === 'uploaded').length;
  // Awaiting processing: uploaded but not yet processed by AI batch
  // TODO: Query from backend when batch-process Lambda is implemented
  const awaitingProcessCount = state.queue.filter(img =>
    img.status === 'uploaded' && !img.processedAt
  ).length;

  return {
    state,
    addImage,
    processImage,
    uploadImage,
    removeImage,
    // Computed
    pendingCount,
    uploadedCount,
    awaitingProcessCount,
    remainingQuota: dailyLimit - uploadedCount,
  };
}
