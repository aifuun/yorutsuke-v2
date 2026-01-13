/**
 * Image Domain - Document scanning and image processing
 *
 * Public API exports following Pillar I: Firewalls
 * - No deep imports allowed (import from this index only)
 * - Clear boundary for domain logic
 */

// Types
export type {
  CornerPoint,
  ScannerState,
  ScanResult,
} from './types';

export {
  DetectionFailedError,
  CropFailedError,
  SCANNER_TRANSITIONS,
} from './types';

// Services
export {
  detectCorners,
  extractPaper,
  isValidCorners,
  scanImage,
} from './scanService';
