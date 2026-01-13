/**
 * Scanner Service - Document scanning workflow orchestration
 *
 * Follows ADR-001 Service Pattern:
 * - Pure TypeScript service (no React dependencies)
 * - Orchestrates scanning workflow
 * - Manages scanner FSM state via scannerStore
 * - Calls domain-level scanService for low-level operations
 *
 * @module scannerService
 */

import { detectCorners, extractPaper, isValidCorners } from '../../../01_domains/image';
import type { CornerPoint, ScanResult } from '../../../01_domains/image';
import { DetectionFailedError, CropFailedError } from '../../../01_domains/image';
import { scannerStore } from '../stores/scannerStore';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { emit } from '../../../00_kernel/eventBus';

class ScannerService {
  /**
   * Start scanning workflow for an image file
   *
   * Workflow:
   * 1. Create preview URL
   * 2. Load image element
   * 3. Auto-detect corners
   * 4. Update store to 'previewing' state
   *
   * @param file - Image file to scan
   * @returns Promise that resolves when auto-detection completes
   *
   * @ai-intent: Auto-detection runs immediately, user sees preview with detected corners
   */
  async startScan(file: File): Promise<void> {
    logger.debug(EVENTS.IMAGE_SCAN_START, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    try {
      // Create preview URL for UI
      const previewUrl = URL.createObjectURL(file);

      // Update store: scanning started
      scannerStore.getState().startScan(file, previewUrl);

      // Load image element
      const imageElement = await this.loadImageElement(previewUrl);

      // Auto-detect corners (domain-level operation)
      const corners = await detectCorners(imageElement);

      // Validate detected corners
      if (!isValidCorners(corners)) {
        throw new DetectionFailedError('Invalid corners detected');
      }

      logger.info(EVENTS.IMAGE_SCAN_SUCCESS, {
        fileName: file.name,
        cornersDetected: corners.length,
      });

      // Update store: detection succeeded
      scannerStore.getState().detectionSuccess(corners);

      emit('scanner:ready', { fileName: file.name });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(EVENTS.IMAGE_SCAN_FAILED, {
        fileName: file.name,
        error: errorMessage,
      });

      // Update store: detection failed
      scannerStore.getState().detectionFailed(errorMessage);

      throw error;
    }
  }

  /**
   * User manually adjusted a corner point
   *
   * @param index - Corner index (0-3)
   * @param point - New corner coordinates
   *
   * @ai-intent: Allow user to fix auto-detection errors by dragging corners
   */
  updateCorner(index: number, point: CornerPoint): void {
    const currentCorners = scannerStore.getState().getCorners();

    if (index < 0 || index >= currentCorners.length) {
      logger.warn(EVENTS.IMAGE_SCAN_FAILED, {
        reason: 'invalid_corner_index',
        index,
        total: currentCorners.length,
      });
      return;
    }

    logger.debug(EVENTS.IMAGE_SCAN_START, {
      action: 'corner_update',
      index,
      point,
    });

    scannerStore.getState().updateCorner(index, point);
  }

  /**
   * User confirmed crop - perform perspective transformation
   *
   * Workflow:
   * 1. Get current corners and image
   * 2. Extract paper (perspective correction)
   * 3. Update store with cropped blob
   * 4. Return scan result
   *
   * @returns ScanResult with cropped blob
   * @throws {CropFailedError} If transformation fails
   *
   * @ai-intent: Final step - create cropped image for upload
   */
  async confirmCrop(): Promise<ScanResult> {
    const state = scannerStore.getState();
    const { originalFile, corners, previewUrl } = state;

    if (!originalFile) {
      throw new CropFailedError('No image file');
    }

    if (!previewUrl) {
      throw new CropFailedError('No preview URL');
    }

    if (corners.length !== 4) {
      throw new CropFailedError(`Expected 4 corners, got ${corners.length}`);
    }

    logger.debug(EVENTS.IMAGE_SCAN_START, {
      action: 'confirm_crop',
      fileName: originalFile.name,
    });

    try {
      // Update store: cropping in progress
      scannerStore.getState().confirmCrop();

      // Load image element
      const imageElement = await this.loadImageElement(previewUrl);

      // Perform perspective transformation (domain-level operation)
      const croppedBlob = await extractPaper(imageElement, corners);

      logger.info(EVENTS.IMAGE_SCAN_SUCCESS, {
        fileName: originalFile.name,
        originalSize: originalFile.size,
        croppedSize: croppedBlob.size,
        compressionRatio: (croppedBlob.size / originalFile.size).toFixed(2),
      });

      // Prepare result
      const result: ScanResult = {
        originalBlob: originalFile,
        croppedBlob,
        corners,
        skipped: false,
      };

      // Update store: crop succeeded (cleans up state)
      scannerStore.getState().cropSuccess(croppedBlob);

      // Cleanup preview URL
      URL.revokeObjectURL(previewUrl);

      emit('scanner:completed', { fileName: originalFile.name, cropped: true });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(EVENTS.IMAGE_SCAN_FAILED, {
        fileName: originalFile.name,
        error: errorMessage,
      });

      scannerStore.getState().cropFailed(errorMessage);

      throw error;
    }
  }

  /**
   * User chose to skip cropping (original upload)
   *
   * @returns ScanResult with original file as both original and cropped
   *
   * @ai-intent: Fallback if auto-detection fails or user prefers original
   */
  skipCrop(): ScanResult {
    const state = scannerStore.getState();
    const { originalFile, previewUrl } = state;

    if (!originalFile) {
      throw new Error('No image file to skip');
    }

    logger.info(EVENTS.IMAGE_SCAN_SUCCESS, {
      fileName: originalFile.name,
      action: 'skip_crop',
    });

    const result: ScanResult = {
      originalBlob: originalFile,
      croppedBlob: originalFile, // Use original as cropped
      corners: [],
      skipped: true,
    };

    // Cleanup
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    scannerStore.getState().reset();

    emit('scanner:completed', { fileName: originalFile.name, cropped: false });

    return result;
  }

  /**
   * User canceled scanning
   * Cleanup resources and reset state
   */
  cancel(): void {
    const state = scannerStore.getState();
    const { previewUrl, originalFile } = state;

    logger.debug(EVENTS.IMAGE_SCAN_FAILED, {
      fileName: originalFile?.name,
      reason: 'user_canceled',
    });

    // Cleanup preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    scannerStore.getState().cancel();

    emit('scanner:canceled', {});
  }

  /**
   * Load image element from URL
   * Helper method for service-internal use
   */
  private async loadImageElement(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  /**
   * Get current scanner state (for UI)
   */
  getState() {
    return scannerStore.getState();
  }
}

// Export singleton instance
export const scannerService = new ScannerService();
