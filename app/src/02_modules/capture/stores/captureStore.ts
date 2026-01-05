// Capture Store - Zustand vanilla store for capture queue
// Pillar D: FSM - no boolean flags
// Pillar J: Locality - state near usage
import { createStore } from 'zustand/vanilla';
import type { ImageId } from '../../../00_kernel/types';
import type { ReceiptImage, ImageStatus } from '../../../01_domains/receipt';

// FSM State (from useCaptureLogic reducer)
export type CaptureStatus = 'idle' | 'processing' | 'uploading';

export interface CaptureState {
  status: CaptureStatus;
  queue: ReceiptImage[];
  currentId: ImageId | null;
}

export interface CaptureActions {
  // Queue management
  addImage: (image: ReceiptImage) => void;
  restoreQueue: (images: ReceiptImage[]) => void;
  removeImage: (id: ImageId) => void;
  clearQueue: () => void;

  // Processing lifecycle
  startProcess: (id: ImageId) => void;
  processSuccess: (id: ImageId, compressedPath: string, compressedSize: number, md5: string) => void;
  duplicateDetected: (id: ImageId) => void;

  // Upload lifecycle
  startUpload: (id: ImageId) => void;
  uploadSuccess: (id: ImageId, s3Key: string) => void;

  // Error handling
  failure: (id: ImageId, error: string) => void;

  // Direct state access for service layer
  getQueue: () => ReceiptImage[];
  getStatus: () => CaptureStatus;
}

export type CaptureStore = CaptureState & CaptureActions;

// Helper: update image status in queue
function updateImageStatus(queue: ReceiptImage[], id: ImageId, status: ImageStatus): ReceiptImage[] {
  return queue.map(img => (img.id === id ? { ...img, status } : img));
}

// Create vanilla store (not React-bound)
export const captureStore = createStore<CaptureStore>((set, get) => ({
  // Initial state
  status: 'idle',
  queue: [],
  currentId: null,

  // Queue management
  addImage: (image) => set((state) => ({
    queue: [...state.queue, image],
  })),

  restoreQueue: (images) => set((state) => ({
    queue: [
      ...state.queue,
      ...images.filter(img => !state.queue.some(q => q.id === img.id)),
    ],
  })),

  removeImage: (id) => set((state) => ({
    queue: state.queue.filter(img => img.id !== id),
  })),

  clearQueue: () => set({
    status: 'idle',
    queue: [],
    currentId: null,
  }),

  // Processing lifecycle
  startProcess: (id) => set((state) => ({
    status: 'processing',
    queue: updateImageStatus(state.queue, id, 'pending'),
    currentId: id,
  })),

  processSuccess: (id, compressedPath, compressedSize, _md5) => set((state) => ({
    status: 'idle',
    currentId: null,
    queue: state.queue.map(img =>
      img.id === id
        ? { ...img, status: 'compressed' as ImageStatus, compressedSize, thumbnailPath: compressedPath }
        : img
    ),
  })),

  duplicateDetected: (id) => set((state) => ({
    status: 'idle',
    currentId: null,
    queue: state.queue.map(img =>
      img.id === id
        ? { ...img, status: 'skipped' as ImageStatus }
        : img
    ),
  })),

  // Upload lifecycle
  startUpload: (id) => set((state) => ({
    status: 'uploading',
    queue: updateImageStatus(state.queue, id, 'uploading'),
    currentId: id,
  })),

  uploadSuccess: (id, s3Key) => set((state) => ({
    status: 'idle',
    currentId: null,
    queue: state.queue.map(img =>
      img.id === id
        ? { ...img, status: 'uploaded' as ImageStatus, s3Key, uploadedAt: new Date().toISOString() }
        : img
    ),
  })),

  // Error handling
  failure: (id, error) => set((state) => ({
    status: 'idle',
    currentId: null,
    queue: state.queue.map(img =>
      img.id === id
        ? { ...img, status: 'failed' as ImageStatus, error }
        : img
    ),
  })),

  // Direct state access
  getQueue: () => get().queue,
  getStatus: () => get().status,
}));
