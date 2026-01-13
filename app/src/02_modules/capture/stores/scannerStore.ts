/**
 * Scanner Store - Zustand vanilla store for document scanning state
 * Pillar D: FSM - Scanner workflow states
 * Pillar J: Locality - State near usage
 */

import { createStore } from 'zustand/vanilla';
import type { CornerPoint, ScannerState } from '../../../01_domains/image';

/**
 * Scanner store state
 */
export interface ScannerStoreState {
  /** Current scanner FSM state */
  status: ScannerState;

  /** Original image file being scanned */
  originalFile: File | null;

  /** Detected corner points (4 corners) */
  corners: CornerPoint[];

  /** Preview image URL (for canvas rendering) */
  previewUrl: string | null;

  /** Result blob after cropping (if confirmed) */
  croppedBlob: Blob | null;

  /** Error message if detection/crop fails */
  error: string | null;
}

/**
 * Scanner store actions
 */
export interface ScannerActions {
  /** Start scanning a new image */
  startScan: (file: File, previewUrl: string) => void;

  /** Corner detection succeeded */
  detectionSuccess: (corners: CornerPoint[]) => void;

  /** Corner detection failed */
  detectionFailed: (error: string) => void;

  /** User manually adjusted a corner */
  updateCorner: (index: number, point: CornerPoint) => void;

  /** User confirmed crop */
  confirmCrop: () => void;

  /** Crop succeeded */
  cropSuccess: (croppedBlob: Blob) => void;

  /** Crop failed */
  cropFailed: (error: string) => void;

  /** User canceled scanning */
  cancel: () => void;

  /** Reset to initial state */
  reset: () => void;

  /** Getters for service layer */
  getStatus: () => ScannerState;
  getCorners: () => CornerPoint[];
  getOriginalFile: () => File | null;
}

export type ScannerStore = ScannerStoreState & ScannerActions;

/** Initial state */
const initialState: ScannerStoreState = {
  status: 'idle',
  originalFile: null,
  corners: [],
  previewUrl: null,
  croppedBlob: null,
  error: null,
};

/**
 * Scanner vanilla store
 * Used by scannerService to manage scanning workflow state
 */
export const scannerStore = createStore<ScannerStore>((set, get) => ({
  ...initialState,

  // Actions
  startScan: (file, previewUrl) =>
    set({
      status: 'scanning',
      originalFile: file,
      previewUrl,
      corners: [],
      croppedBlob: null,
      error: null,
    }),

  detectionSuccess: (corners) =>
    set({
      status: 'previewing',
      corners,
      error: null,
    }),

  detectionFailed: (error) =>
    set({
      status: 'error',
      error,
    }),

  updateCorner: (index, point) =>
    set((state) => {
      if (index < 0 || index >= state.corners.length) {
        return state;
      }
      const newCorners = [...state.corners];
      newCorners[index] = point;
      return {
        status: 'cropping',
        corners: newCorners,
      };
    }),

  confirmCrop: () =>
    set({
      status: 'confirmed',
    }),

  cropSuccess: (croppedBlob) =>
    set({
      status: 'idle',
      croppedBlob,
      error: null,
    }),

  cropFailed: (error) =>
    set({
      status: 'error',
      error,
    }),

  cancel: () =>
    set({
      ...initialState,
    }),

  reset: () =>
    set({
      ...initialState,
    }),

  // Getters
  getStatus: () => get().status,
  getCorners: () => get().corners,
  getOriginalFile: () => get().originalFile,
}));
