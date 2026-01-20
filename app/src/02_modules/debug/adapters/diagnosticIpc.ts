/**
 * Diagnostic IPC Adapter
 *
 * Pillar I: Firewall - isolates Tauri IPC from business logic
 * Pillar B: Airlock - validates all IPC responses at boundary
 *
 * Bridges DiagnosticService calls to Rust/Tauri handlers:
 * - collect_diagnostic_data: Collects local device data
 * - upload_diagnostic_report: Calls Lambda with local data
 *
 * Runtime mock mode support:
 * - When `isMockingOnline()`: Returns mock data (no real IPC calls)
 * - When `isMockingOffline()`: Simulates network failures
 * - Otherwise: Calls real Tauri handlers
 */

import { invoke } from '@tauri-apps/api/core';
import { isMockingOnline, isMockingOffline, mockDelay } from '../../../00_kernel/config/mock';
import { logger } from '../../../00_kernel/telemetry';
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
// Mock Data Generators (used for both runtime mocking and tests)
// ============================================================================

/**
 * Generate realistic mock local diagnostic data
 */
export function generateMockLocalDiagnosticData(overrides?: Partial<LocalDiagnosticData>): LocalDiagnosticData {
  return {
    timestamp: new Date().toISOString(),
    appVersion: '0.1.0-alpha.11',
    platform: 'darwin',
    systemInfo: {
      osVersion: '14.2',
      locale: 'en-US',
      timezone: 'UTC+9',
    },
    localStorage: {
      transactions: [
        {
          id: 'txn-001' as any,
          userId: 'user-test' as any,
          imageId: null,
          s3Key: null,
          type: 'expense' as any,
          category: 'shopping' as any,
          amount: 1500,
          currency: 'JPY',
          description: 'Test transaction',
          merchant: null,
          date: new Date().toISOString(),
          status: 'confirmed' as any,
          primaryModelId: null,
          primaryConfidence: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          traceId: null,
        } as any,
      ],
      images: [
        {
          id: 'img-001',
          imageId: 'img-001',
          size: 2048,
          uploadedAt: new Date().toISOString(),
          status: 'uploaded',
        },
      ],
      settings: {
        theme: 'light',
        debugEnabled: true,
      },
    },
    appState: {
      lastSyncTime: new Date(Date.now() - 3600000).toISOString(),
      queuedImages: 0,
      syncStatus: 'idle',
      dbSize: '5.2 MB',
    },
    debugLogs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'App started',
      },
    ],
    ...overrides,
  };
}

/**
 * Generate mock successful export response
 */
export function generateMockDiagnosticExportSuccess(
  overrides?: Partial<DiagnosticExportSuccess>
): DiagnosticExportSuccess {
  return {
    success: true,
    reportId: `diag-${Date.now()}`,
    s3Url: `https://yorutsuke-diagnostics-dev.s3.us-east-1.amazonaws.com/user-test/diag-${Date.now()}.json?X-Amz-Expires=604800`,
    timestamp: new Date().toISOString(),
    fileSize: 102400,
    ...overrides,
  };
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
// IPC Commands (with runtime mock support)
// ============================================================================

/**
 * Collect local diagnostic data from device
 *
 * Behavior:
 * - Online mock mode: Returns mock data with simulated delay
 * - Offline mock mode: Throws network error
 * - Production: Invokes real Tauri command: collect_diagnostic_data
 *
 * Real Tauri command is responsible for:
 * - Reading SQLite database (transactions, images, settings)
 * - Collecting debug logs (last 500 entries)
 * - Getting system information
 * - Determining current app state
 *
 * @param traceId - Trace ID for log correlation
 * @returns Local diagnostic data (validated)
 * @throws Error on IPC failure, validation error, or simulated network failure
 */
export async function collectLocalDiagnosticData(traceId: string): Promise<LocalDiagnosticData> {
  // Handle offline mock mode (simulate network failure)
  if (isMockingOffline()) {
    logger.debug('DIAGNOSTIC_OFFLINE_MOCK', { traceId });
    await mockDelay();
    throw new Error('Network error (offline mock mode)');
  }

  // Handle online mock mode (return realistic mock data)
  if (isMockingOnline()) {
    logger.debug('DIAGNOSTIC_ONLINE_MOCK', { traceId });
    await mockDelay();
    return generateMockLocalDiagnosticData();
  }

  // Production: Call real Tauri IPC command
  const raw = await invoke<RawLocalDiagnosticData>('collect_diagnostic_data', { traceId });
  return validateLocalDiagnosticData(raw);
}

/**
 * Upload diagnostic report to cloud via Lambda
 *
 * Behavior:
 * - Online mock mode: Returns mock S3 URL with simulated delay
 * - Offline mock mode: Throws network error
 * - Production: Invokes real Tauri command: upload_diagnostic_report
 *
 * Real Tauri command is responsible for:
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
 * @throws Error on IPC failure, validation error, or simulated network failure
 */
export async function uploadDiagnosticReportIpc(
  userId: string,
  token: string,
  localData: LocalDiagnosticData,
  traceId: string,
  attempt: number
): Promise<DiagnosticExportSuccess> {
  // Handle offline mock mode (simulate network failure)
  if (isMockingOffline()) {
    logger.debug('DIAGNOSTIC_UPLOAD_OFFLINE_MOCK', { traceId, attempt });
    await mockDelay();
    throw new Error('Network error (offline mock mode)');
  }

  // Handle online mock mode (return realistic mock S3 URL)
  if (isMockingOnline()) {
    logger.debug('DIAGNOSTIC_UPLOAD_ONLINE_MOCK', { traceId, userId, attempt });
    await mockDelay();
    return generateMockDiagnosticExportSuccess();
  }

  // Production: Call real Tauri IPC command
  const raw = await invoke<RawDiagnosticExportSuccess>('upload_diagnostic_report', {
    userId,
    token,
    localData,
    traceId,
    attempt,
  });
  return validateDiagnosticExportSuccess(raw);
}
