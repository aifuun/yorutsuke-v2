// Storage Type Definitions
// Row types for SQLite tables

import type { ImageId, TransactionId } from '../types';

// Image status FSM states
export type ImageStatus =
  | 'pending'      // Awaiting compression
  | 'compressing'  // Being compressed
  | 'compressed'   // Compressed, awaiting upload
  | 'uploading'    // Being uploaded
  | 'uploaded'     // Successfully uploaded to S3
  | 'failed';      // Processing failed

// Image location for offline/online tracking
export type ImageLocation = 'local' | 'cloud' | 'both';

/**
 * Image row from SQLite
 */
export interface ImageRow {
  id: string;              // ImageId (branded at boundary)
  original_path: string;
  compressed_path: string | null;
  original_size: number | null;
  compressed_size: number | null;
  width: number | null;
  height: number | null;
  md5: string | null;
  status: ImageStatus;
  s3_key: string | null;
  ref_count: number;
  created_at: string;
}

/**
 * Transaction cache row from SQLite
 */
export interface TransactionCacheRow {
  id: string;              // TransactionId (branded at boundary)
  image_id: string | null; // ImageId
  amount: number | null;
  merchant: string | null;
  category: string | null;
  receipt_datetime: string | null;
  ai_confidence: number | null;
  ai_result: string | null;  // JSON string
  status: string | null;
  image_location: ImageLocation;
  image_deleted_at: string | null;
  s3_key: string | null;
  synced_at: string;
}

/**
 * Morning report cache row
 */
export interface MorningReportCacheRow {
  report_date: string;     // YYYY-MM-DD
  data: string;            // JSON string
  synced_at: string;
}

/**
 * Settings row
 */
export interface SettingRow {
  key: string;
  value: string | null;
}

/**
 * Analytics event row
 */
export interface AnalyticsRow {
  id: number;
  event_type: string;
  event_data: string | null;  // JSON string
  created_at: string;
}

// Type conversion helpers for branded types at boundary

/**
 * Convert raw row to domain ImageId
 */
export function toImageId(row: ImageRow): ImageId {
  // Import dynamically to avoid circular dependency
  // Actual branding happens at adapter layer
  return row.id as unknown as ImageId;
}

/**
 * Convert raw row to domain TransactionId
 */
export function toTransactionId(row: TransactionCacheRow): TransactionId {
  return row.id as unknown as TransactionId;
}
