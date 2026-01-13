/**
 * Scan Service - jscanify wrapper for document scanning
 *
 * Follows ADR-001 Service Pattern:
 * - Pure TypeScript service (no React dependencies)
 * - Domain logic encapsulation
 * - Clear error boundaries (Pillar B)
 *
 * @module scanService
 */

import jscanify from 'jscanify';
import { DetectionFailedError, CropFailedError } from './types';
import type { CornerPoint, ScanResult } from './types';

const scanner = new jscanify();

/**
 * Maximum image dimension for scanning (performance optimization)
 * Images larger than this will be downscaled before processing
 */
const MAX_SCAN_DIMENSION = 2000;

/**
 * Detect 4 corner points of a document in an image
 *
 * @param imageElement - Loaded HTMLImageElement
 * @returns Array of 4 corner points [topLeft, topRight, bottomRight, bottomLeft]
 * @throws {DetectionFailedError} If corners cannot be detected
 *
 * Pre-conditions:
 * - imageElement must be loaded (naturalWidth > 0)
 *
 * Post-conditions:
 * - Returns exactly 4 corner points
 * - Corner points form a valid quadrilateral
 *
 * Side effects:
 * - None (pure function)
 *
 * @ai-intent: Performance optimization - downscale large images before processing
 */
export async function detectCorners(
  imageElement: HTMLImageElement
): Promise<CornerPoint[]> {
  // Validate pre-conditions
  if (!imageElement.complete || imageElement.naturalWidth === 0) {
    throw new DetectionFailedError('Image not loaded');
  }

  try {
    // Performance optimization: downscale large images
    const processedImage = await downscaleIfNeeded(imageElement);

    // Call jscanify to detect corners
    const detectedCorners = scanner.findPaperContour(processedImage);

    // jscanify returns null if detection fails
    if (!detectedCorners || detectedCorners.length !== 4) {
      throw new DetectionFailedError('Could not detect document corners');
    }

    // Convert jscanify format to our CornerPoint type
    const corners: CornerPoint[] = detectedCorners.map((corner: any) => ({
      x: corner.x,
      y: corner.y,
    }));

    // Validate corners form a valid quadrilateral
    if (!isValidCorners(corners)) {
      throw new DetectionFailedError('Detected corners are invalid');
    }

    return corners;
  } catch (error) {
    if (error instanceof DetectionFailedError) {
      throw error;
    }
    throw new DetectionFailedError(
      `Corner detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract and perspective-correct paper region from image
 *
 * @param imageElement - Loaded HTMLImageElement
 * @param corners - 4 corner points defining the paper region
 * @returns WebP blob of cropped and corrected image
 * @throws {CropFailedError} If transformation fails
 *
 * Pre-conditions:
 * - imageElement must be loaded
 * - corners must be array of exactly 4 valid points
 *
 * Post-conditions:
 * - Returns WebP blob with quality 0.85
 * - Output is perspective-corrected (straight document)
 *
 * Side effects:
 * - Creates temporary canvas element (cleaned up automatically)
 *
 * @ai-intent: WebP format for smaller file size, 0.85 quality balances size vs clarity
 */
export async function extractPaper(
  imageElement: HTMLImageElement,
  corners: CornerPoint[]
): Promise<Blob> {
  // Validate pre-conditions
  if (!imageElement.complete || imageElement.naturalWidth === 0) {
    throw new CropFailedError('Image not loaded');
  }

  if (corners.length !== 4) {
    throw new CropFailedError(`Expected 4 corners, got ${corners.length}`);
  }

  if (!isValidCorners(corners)) {
    throw new CropFailedError('Invalid corner points');
  }

  try {
    // Convert our CornerPoint format to jscanify format
    const jscanifyCorners = corners.map(c => ({ x: c.x, y: c.y }));

    // Perform perspective transformation
    const resultCanvas = scanner.extractPaper(imageElement, jscanifyCorners, 800);

    // Convert canvas to WebP blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      resultCanvas.toBlob(
        (blob: Blob | null) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new CropFailedError('Failed to create blob from canvas'));
          }
        },
        'image/webp',
        0.85
      );
    });

    return blob;
  } catch (error) {
    if (error instanceof CropFailedError) {
      throw error;
    }
    throw new CropFailedError(
      `Paper extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate that corner points form a valid convex quadrilateral
 *
 * @param corners - Array of corner points
 * @returns True if corners are valid
 *
 * Pre-conditions:
 * - corners array (may be empty)
 *
 * Post-conditions:
 * - Returns true only if 4 valid corners forming convex shape
 *
 * Side effects:
 * - None (pure function)
 *
 * @ai-intent: Prevent self-intersecting quadrilaterals that would produce invalid crops
 */
export function isValidCorners(corners: CornerPoint[]): boolean {
  if (corners.length !== 4) {
    return false;
  }

  // Check all corners have valid coordinates
  for (const corner of corners) {
    if (
      typeof corner.x !== 'number' ||
      typeof corner.y !== 'number' ||
      !Number.isFinite(corner.x) ||
      !Number.isFinite(corner.y) ||
      corner.x < 0 ||
      corner.y < 0
    ) {
      return false;
    }
  }

  // Check corners are distinct (not all the same point)
  const uniquePoints = new Set(corners.map(c => `${c.x},${c.y}`));
  if (uniquePoints.size !== 4) {
    return false;
  }

  // Simple convexity check: cross products should all have same sign
  // This prevents self-intersecting quadrilaterals
  const crossProducts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const curr = corners[i];
    const next = corners[(i + 1) % 4];
    const nextNext = corners[(i + 2) % 4];

    const v1x = next.x - curr.x;
    const v1y = next.y - curr.y;
    const v2x = nextNext.x - next.x;
    const v2y = nextNext.y - next.y;

    const cross = v1x * v2y - v1y * v2x;
    crossProducts.push(cross);
  }

  // All cross products should have the same sign (all positive or all negative)
  const allPositive = crossProducts.every(cp => cp > 0);
  const allNegative = crossProducts.every(cp => cp < 0);

  return allPositive || allNegative;
}

/**
 * Downscale image if dimensions exceed MAX_SCAN_DIMENSION
 *
 * @param imageElement - Original image
 * @returns Downscaled image or original if small enough
 *
 * @ai-intent: Performance optimization - jscanify is slow on large images (> 2000px)
 */
async function downscaleIfNeeded(
  imageElement: HTMLImageElement
): Promise<HTMLImageElement> {
  const { naturalWidth, naturalHeight } = imageElement;
  const maxDim = Math.max(naturalWidth, naturalHeight);

  if (maxDim <= MAX_SCAN_DIMENSION) {
    return imageElement;
  }

  // Calculate scale factor
  const scale = MAX_SCAN_DIMENSION / maxDim;
  const newWidth = Math.floor(naturalWidth * scale);
  const newHeight = Math.floor(naturalHeight * scale);

  // Create canvas and resize
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new DetectionFailedError('Failed to create canvas context');
  }

  ctx.drawImage(imageElement, 0, 0, newWidth, newHeight);

  // Convert canvas to image
  const downscaledImage = new Image();
  downscaledImage.src = canvas.toDataURL('image/jpeg', 0.9);

  await new Promise((resolve, reject) => {
    downscaledImage.onload = resolve;
    downscaledImage.onerror = reject;
  });

  return downscaledImage;
}

/**
 * Complete scan workflow: detect corners and extract paper
 * Convenience function that combines detectCorners + extractPaper
 *
 * @param imageElement - Loaded HTMLImageElement
 * @returns ScanResult with original, cropped blobs and corners
 * @throws {DetectionFailedError | CropFailedError}
 *
 * @ai-intent: High-level API for one-step scanning
 */
export async function scanImage(
  imageElement: HTMLImageElement
): Promise<Omit<ScanResult, 'originalBlob' | 'skipped'>> {
  const corners = await detectCorners(imageElement);
  const croppedBlob = await extractPaper(imageElement, corners);

  return {
    croppedBlob,
    corners,
  };
}
