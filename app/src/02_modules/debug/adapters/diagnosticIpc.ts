/**
 * Diagnostic IPC Adapter
 *
 * Pillar I: Firewall - isolates Tauri IPC from business logic
 * Pillar B: Airlock - validates all IPC responses at boundary
 *
 * Bridges DiagnosticService calls to Rust/Tauri handlers:
 * - collect_diagnostic_data: Collects local device data
 * - upload_diagnostic_report: Calls Lambda with local data
 */

import { invoke } from '@tauri-apps/api/core';
import type { LocalDiagnosticData, DiagnosticExportSuccess } from '../types/diagnostic';

// ============================================================================
// Response Schemas from Tauri/Rust
// ============================================================================

/**
 * Raw response from Rust command: collect_diagnostic_data
 */
interface RawLocalDiagnosticData {
  timestamp: string;
  appVersion: string;
  platform: 'darwin' | 'linux' | 'win32';
  systemInfo: {
    osVersion: string;
    locale: string;
    timezone: string;
  };
  localStorage: {
    transactions: unknown[];
    images: unknown[];
    settings: Record<string, unknown>;
  };
  appState: {
    lastSyncTime: string | null;
    queuedImages: number;
    syncStatus: 'idle' | 'syncing' | 'error';
    dbSize: string;
  };
  debugLogs: unknown[];
}

/**
 * Raw response from Rust command: upload_diagnostic_report
 */
interface RawDiagnosticExportSuccess {
  success: true;
  reportId: string;
  s3Url: string;
  timestamp: string;
  fileSize: number;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate LocalDiagnosticData response from Rust
 * Pillar B: Validate at boundary
 */
function validateLocalDiagnosticData(raw: unknown): LocalDiagnosticData {
  const data = raw as RawLocalDiagnosticData;

  if (typeof data.timestamp !== 'string') {
    throw new Error('Invalid diagnostic data: missing timestamp');
  }
  if (typeof data.appVersion !== 'string') {
    throw new Error('Invalid diagnostic data: missing appVersion');
  }
  if (!['darwin', 'linux', 'win32'].includes(data.platform)) {
    throw new Error('Invalid diagnostic data: invalid platform');
  }
  if (!data.systemInfo || typeof data.systemInfo.osVersion !== 'string') {
    throw new Error('Invalid diagnostic data: invalid systemInfo');
  }
  if (!Array.isArray(data.debugLogs)) {
    throw new Error('Invalid diagnostic data: debugLogs must be array');
  }

  return data as LocalDiagnosticData;
}

/**
 * Validate DiagnosticExportSuccess response from Tauri
 * Pillar B: Validate at boundary
 */
function validateDiagnosticExportSuccess(raw: unknown): DiagnosticExportSuccess {
  const result = raw as RawDiagnosticExportSuccess;

  if (result.success !== true) {
    throw new Error('Invalid diagnostic export response: success must be true');
  }
  if (typeof result.reportId !== 'string') {
    throw new Error('Invalid diagnostic export response: missing reportId');
  }
  if (typeof result.s3Url !== 'string') {
    throw new Error('Invalid diagnostic export response: missing s3Url');
  }
  if (typeof result.timestamp !== 'string') {
    throw new Error('Invalid diagnostic export response: missing timestamp');
  }
  if (typeof result.fileSize !== 'number') {
    throw new Error('Invalid diagnostic export response: missing fileSize');
  }

  return result as DiagnosticExportSuccess;
}

// ============================================================================
// IPC Commands
// ============================================================================

/**
 * Collect local diagnostic data from device
 *
 * Invokes Tauri command: collect_diagnostic_data
 * Responsible for:
 * - Reading SQLite database (transactions, images, settings)
 * - Collecting debug logs (last 500 entries)
 * - Getting system information
 * - Determining current app state
 *
 * @param traceId - Trace ID for log correlation
 * @returns Local diagnostic data (validated)
 * @throws Error on IPC failure or validation error
 */
export async function collectLocalDiagnosticData(traceId: string): Promise<LocalDiagnosticData> {
  const raw = await invoke<RawLocalDiagnosticData>('collect_diagnostic_data', { traceId });
  return validateLocalDiagnosticData(raw);
}

/**
 * Upload diagnostic report to cloud via Lambda
 *
 * Invokes Tauri command: upload_diagnostic_report
 * Tauri handler is responsible for:
 * 1. Calling Lambda function with auth token
 * 2. Lambda queries cloud data (DynamoDB, S3, CloudWatch)
 * 3. Lambda generates combined report
 * 4. Lambda uploads to S3
 * 5. Returning S3 URL + metadata
 *
 * @param userId - User ID (for cloud data queries)
 * @param token - Auth token (for Lambda authentication)
 * @param localData - Local diagnostic data to include in report
 * @param traceId - Trace ID for log correlation
 * @param attempt - Retry attempt number (for logging)
 * @returns Success response with S3 URL (validated)
 * @throws Error on IPC failure or validation error
 */
export async function uploadDiagnosticReportIpc(
  userId: string,
  token: string,
  localData: LocalDiagnosticData,
  traceId: string,
  attempt: number
): Promise<DiagnosticExportSuccess> {
  const raw = await invoke<RawDiagnosticExportSuccess>('upload_diagnostic_report', {
    userId,
    token,
    localData,
    traceId,
    attempt,
  });
  return validateDiagnosticExportSuccess(raw);
}
