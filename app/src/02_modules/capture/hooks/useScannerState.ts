/**
 * React hook to subscribe to scanner store
 * Pillar L: Bridge between Service layer and React
 * Following ADR-012: Zustand Selector Safety - use primitive selectors only
 */

import { useStore } from 'zustand';
import { scannerStore } from '../stores/scannerStore';
import type { ScannerState, CornerPoint } from '../../../01_domains/image';

/**
 * Subscribe to scanner status
 * Returns primitive value - safe for React
 */
export function useScannerStatus(): ScannerState {
  return useStore(scannerStore, (state) => state.status);
}

/**
 * Subscribe to scanner corners
 * Returns existing array reference - safe for React
 */
export function useScannerCorners(): CornerPoint[] {
  return useStore(scannerStore, (state) => state.corners);
}

/**
 * Subscribe to scanner preview URL
 * Returns primitive value - safe for React
 */
export function useScannerPreviewUrl(): string | null {
  return useStore(scannerStore, (state) => state.previewUrl);
}

/**
 * Subscribe to scanner error
 * Returns primitive value - safe for React
 */
export function useScannerError(): string | null {
  return useStore(scannerStore, (state) => state.error);
}

/**
 * Subscribe to scanner original file
 * Returns existing object reference - safe for React
 */
export function useScannerFile(): File | null {
  return useStore(scannerStore, (state) => state.originalFile);
}
