import type { ImageId, UserId, IntentId, TraceId } from '../../00_kernel/types';

// Receipt image status FSM (Pillar D)
export type ImageStatus =
  | 'pending'      // Just dropped, waiting for compression
  | 'compressed'   // WebP compressed, ready for upload
  | 'uploading'    // Currently uploading to S3
  | 'uploaded'     // In S3, waiting for batch processing
  | 'processing'   // Being processed by Nova Lite
  | 'processed'    // OCR complete, transaction extracted
  | 'confirmed'    // User confirmed transaction
  | 'failed'       // Processing failed
  | 'skipped';     // Duplicate detected, skipped

export interface ReceiptImage {
  id: ImageId;
  userId: UserId;
  intentId: IntentId;  // Pillar Q: Idempotency key for this upload action
  traceId: TraceId;    // Pillar N: Tracks entire lifecycle from drop to confirm
  status: ImageStatus;
  localPath: string;
  s3Key: string | null;
  thumbnailPath: string | null;
  originalSize: number;
  compressedSize: number | null;
  createdAt: string;
  uploadedAt: string | null;
  processedAt: string | null;
  error?: string;      // Error message when status is 'failed'
}

// Valid state transitions
export const IMAGE_TRANSITIONS: Record<ImageStatus, ImageStatus[]> = {
  pending: ['compressed', 'failed', 'skipped'],
  compressed: ['uploading', 'failed'],
  uploading: ['uploaded', 'failed'],
  uploaded: ['processing', 'failed'],
  processing: ['processed', 'failed'],
  processed: ['confirmed'],
  confirmed: [],
  failed: ['pending'], // Allow retry
  skipped: [],         // Terminal state (duplicate)
};
