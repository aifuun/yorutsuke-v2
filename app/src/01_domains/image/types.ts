// Pillar A: Nominal typing for scan-related types

/**
 * Corner point coordinates for image scanning
 * Used by jscanify for document detection and perspective transformation
 */
export interface CornerPoint {
  x: number;
  y: number;
}

/**
 * Scanner workflow states (Pillar D: FSM)
 * Extends upload queue FSM with scanning states
 */
export type ScannerState =
  | 'idle'          // Initial state, no scanning in progress
  | 'scanning'      // Auto-detecting corners with jscanify
  | 'previewing'    // Showing preview with detected corners, waiting for user
  | 'cropping'      // User manually adjusting corners
  | 'confirmed'     // User confirmed, performing perspective transform
  | 'error';        // Detection or transformation failed

/**
 * Result of scanning operation
 */
export interface ScanResult {
  originalBlob: Blob;      // Original image file
  croppedBlob: Blob;       // Cropped and perspective-corrected image (WebP)
  corners: CornerPoint[];  // The 4 corner points used for transformation
  skipped: boolean;        // True if user chose "original upload" (skip crop)
}

/**
 * Scanner errors (Pillar B: Airlock pattern)
 */
export class DetectionFailedError extends Error {
  constructor(message = 'Failed to detect document corners') {
    super(message);
    this.name = 'DetectionFailedError';
  }
}

export class CropFailedError extends Error {
  constructor(message = 'Failed to crop and transform image') {
    super(message);
    this.name = 'CropFailedError';
  }
}

/**
 * Valid state transitions for scanner FSM
 */
export const SCANNER_TRANSITIONS: Record<ScannerState, ScannerState[]> = {
  idle: ['scanning'],
  scanning: ['previewing', 'error'],
  previewing: ['cropping', 'confirmed', 'idle'], // idle = cancel
  cropping: ['confirmed', 'previewing'],
  confirmed: ['idle'], // Reset after completion
  error: ['idle'], // Allow retry
};
