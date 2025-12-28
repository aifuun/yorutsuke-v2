// Pillar L: Headless - logic without UI
// Pillar D: FSM - no boolean flags
import { useReducer, useCallback } from 'react';
import type { ImageId, UserId } from '../../../00_kernel/types';
import type { ReceiptImage, ImageStatus } from '../../../01_domains/receipt';
import { canUpload, DAILY_UPLOAD_LIMIT } from '../../../01_domains/receipt';
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

export function useCaptureLogic(userId: UserId | null) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle', queue: [] });

  const addImage = useCallback((image: ReceiptImage) => {
    dispatch({ type: 'ADD_IMAGE', image });
  }, []);

  const processImage = useCallback(async (id: ImageId, inputPath: string, outputPath: string) => {
    dispatch({ type: 'START_PROCESS', id });
    try {
      const result = await compressImage(inputPath, outputPath);
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

    // Check quota
    const uploadedToday = state.queue.filter(
      img => img.status === 'uploaded' || img.status === 'processing'
    ).length;
    const check = canUpload(uploadedToday, null);
    if (!check.allowed) {
      dispatch({ type: 'FAILURE', id, error: check.reason! });
      return;
    }

    dispatch({ type: 'START_UPLOAD', id });
    try {
      const { url, key } = await getPresignedUrl(userId, `${id}.webp`);
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

  return {
    state,
    addImage,
    processImage,
    uploadImage,
    removeImage,
    // Computed
    pendingCount: state.queue.filter(img => img.status === 'pending').length,
    uploadedCount: state.queue.filter(img => img.status === 'uploaded').length,
    remainingQuota: DAILY_UPLOAD_LIMIT - state.queue.filter(img => img.status === 'uploaded').length,
  };
}
