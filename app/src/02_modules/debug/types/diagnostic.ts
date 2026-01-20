/**
 * Diagnostic Export Types
 *
 * Comprehensive type definitions for diagnostic data collection and reporting.
 * Used by DiagnosticService to ensure type safety across local + cloud data.
 */

import type { Transaction } from '../../../01_domains/transaction';
import type { UserId } from '../../../00_kernel/types';

// ============================================================================
// LOCAL DIAGNOSTIC DATA
// ============================================================================

/**
 * System information collected from the device
 */
export interface SystemInfo {
  osVersion: string;              // e.g., "14.2"
  locale: string;                 // e.g., "en-US"
  timezone: string;               // e.g., "UTC+9" or "Asia/Tokyo"
}

/**
 * App-level state snapshot at diagnostic time
 */
export interface AppState {
  lastSyncTime: string | null;    // ISO 8601 or null
  queuedImages: number;           // How many images waiting to upload
  syncStatus: 'idle' | 'syncing' | 'error';
  dbSize: string;                 // e.g., "5.2 MB"
}

/**
 * Local SQLite data export
 */
export interface LocalStorage {
  transactions: Transaction[];    // Last 100 transactions
  images: Array<{
    id: string;
    imageId: string;
    size: number;
    uploadedAt: string;           // ISO 8601
    status: 'pending' | 'uploaded' | 'processing' | 'failed';
  }>;
  settings: Record<string, unknown>;  // User settings snapshot
}

/**
 * Debug log entry format
 */
export interface DebugLogEntry {
  timestamp: string;              // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Complete local diagnostic data collected from the device
 */
export interface LocalDiagnosticData {
  timestamp: string;              // ISO 8601, when collected
  appVersion: string;             // e.g., "0.1.0-alpha.11"
  platform: 'darwin' | 'linux' | 'win32';

  systemInfo: SystemInfo;
  localStorage: LocalStorage;
  appState: AppState;
  debugLogs: DebugLogEntry[];     // Last 500 entries
}

// ============================================================================
// CLOUD DIAGNOSTIC DATA
// ============================================================================

/**
 * Cloud transaction data (from DynamoDB)
 */
export interface CloudTransaction {
  id: string;
  userId: UserId;
  amount: number;
  currency: string;
  status: 'unconfirmed' | 'confirmed';
  primaryModelId: string | null;
  primaryConfidence: number | null;
  createdAt: string;              // ISO 8601
}

/**
 * S3 image metadata
 */
export interface S3Image {
  key: string;                    // S3 object key (full path)
  size: number;                   // Bytes
  lastModified: string;           // ISO 8601
  eTag: string;
}

/**
 * CloudWatch error log entry
 */
export interface LambdaError {
  timestamp: string;              // ISO 8601
  functionName: string;
  errorType: string;
  errorMessage: string;
  traceId?: string;
}

/**
 * Cloud-side diagnostic data
 */
export interface CloudDiagnosticData {
  transactionCount: number;
  transactions: CloudTransaction[];  // Last 50

  imageCount: number;
  images: S3Image[];               // Last 50

  lambdaErrorCount: number;
  lambdaErrors: LambdaError[];      // Last 24h
}

// ============================================================================
// DIAGNOSTIC REPORT
// ============================================================================

/**
 * Diagnostic summary with analysis
 */
export interface DiagnosticSummary {
  markdown: string;               // Markdown-formatted summary for humans
  metrics: {
    localDbHealthy: boolean;
    cloudSyncStatus: 'ok' | 'warning' | 'error';
    lastSyncAge: string;          // e.g., "2 hours ago"
    errorsInLast24h: number;
  };
}

/**
 * Complete diagnostic report
 */
export interface DiagnosticReport {
  // Metadata
  metadata: {
    userId: UserId;
    reportId: string;             // e.g., "diag-abc123"
    generatedAt: string;          // ISO 8601
    source: 'manual-button' | 'auto-queue';  // Phase 1 vs Phase 2
    traceId: string;              // For log correlation
  };

  // Data
  localData: LocalDiagnosticData;
  cloudData: CloudDiagnosticData;

  // Analysis
  diagnosticSummary: DiagnosticSummary;
}

// ============================================================================
// SERVICE RESULTS
// ============================================================================

/**
 * Result of successful diagnostic export
 */
export interface DiagnosticExportSuccess {
  success: true;
  reportId: string;
  s3Url: string;                  // Pre-signed URL for download (7-day expiry)
  timestamp: string;              // ISO 8601
  fileSize: number;               // Bytes
}

/**
 * Result of failed diagnostic export
 */
export interface DiagnosticExportError {
  success: false;
  error: {
    code: string;                 // e.g., 'NETWORK_TIMEOUT', 'AUTH_FAILED'
    message: string;
    retryable: boolean;
  };
  timestamp: string;              // ISO 8601
}

/**
 * Unified result type for diagnostic export
 */
export type DiagnosticExportResult = DiagnosticExportSuccess | DiagnosticExportError;

// ============================================================================
// SERVICE STATE
// ============================================================================

/**
 * Diagnostic service internal state
 */
export type DiagnosticState = 'idle' | 'collecting' | 'uploading' | 'success' | 'error';

/**
 * Diagnostic operation context
 */
export interface DiagnosticContext {
  state: DiagnosticState;
  traceId: string;
  startTime: number;              // milliseconds
  currentPhase?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if result is success
 */
export function isDiagnosticExportSuccess(
  result: DiagnosticExportResult
): result is DiagnosticExportSuccess {
  return result.success === true;
}

/**
 * Check if result is error
 */
export function isDiagnosticExportError(
  result: DiagnosticExportResult
): result is DiagnosticExportError {
  return result.success === false;
}
