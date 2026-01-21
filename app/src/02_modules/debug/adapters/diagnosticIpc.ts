/**
 * Diagnostic IPC Adapter (Primitive IO Operations)
 *
 * Pillar I: Firewall - isolates Tauri IPC from business logic
 * Pillar B: Airlock - validates all IPC responses at boundary
 *
 * Bridges DiagnosticService to primitive Rust IO handlers:
 * - get_system_info: Retrieves system information
 * - read_debug_logs: Reads latest 500 log entries
 * - get_directory_size: Calculates directory size
 * - upload_diagnostic_report: Calls Lambda (cloud data collection)
 *
 * Note: Business logic aggregation happens in DiagnosticService (service layer),
 * not here. This adapter only handles primitive IO operations.
 *
 * Runtime mock mode support:
 * - When `isMockingOnline()`: Returns mock data (no real IPC calls)
 * - When `isMockingOffline()`: Simulates network failures
 * - Otherwise: Calls real Tauri handlers
 */

import { invoke } from '@tauri-apps/api/core';
import { isMockingOnline, isMockingOffline, mockDelay } from '../../../00_kernel/config/mock';
import type { LocalDiagnosticData, DiagnosticExportSuccess } from '../types/diagnostic';

// ============================================================================
// Response Schemas from Tauri/Rust
// ============================================================================

/**
 * Raw response from Rust command: get_system_info
 * Primitive IO operation - just system information
 */
interface RawSystemInfo {
  osVersion: string;
  locale: string;
  timezone: string;
}

/**
 * Raw response from Rust command: read_debug_logs
 * Primitive IO operation - returns array of JSON log entries
 */
type RawDebugLogs = unknown[];

/**
 * Raw response from Rust command: get_directory_size
 * Primitive IO operation - returns both bytes and formatted size
 */
interface RawDirectorySize {
  bytes: number;
  formatted: string;
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
 * Validate SystemInfo response from Rust
 * Pillar B: Validate at boundary
 */
function validateSystemInfo(raw: unknown): RawSystemInfo {
  const data = raw as RawSystemInfo;

  if (typeof data.osVersion !== 'string') {
    throw new Error('Invalid system info: missing osVersion');
  }
  if (typeof data.locale !== 'string') {
    throw new Error('Invalid system info: missing locale');
  }
  if (typeof data.timezone !== 'string') {
    throw new Error('Invalid system info: missing timezone');
  }

  return data;
}

/**
 * Validate DebugLogs response from Rust
 * Pillar B: Validate at boundary
 */
function validateDebugLogs(raw: unknown): RawDebugLogs {
  if (!Array.isArray(raw)) {
    throw new Error('Invalid debug logs: must be array');
  }

  return raw as RawDebugLogs;
}

/**
 * Validate DirectorySize response from Rust
 * Pillar B: Validate at boundary
 */
function validateDirectorySize(raw: unknown): RawDirectorySize {
  const data = raw as RawDirectorySize;

  if (typeof data.bytes !== 'number') {
    throw new Error('Invalid directory size: missing bytes');
  }
  if (typeof data.formatted !== 'string') {
    throw new Error('Invalid directory size: missing formatted');
  }

  return data;
}


// ============================================================================
// IPC Commands (Primitive IO Operations - with runtime mock support)
// ============================================================================

/**
 * Get system information from device
 *
 * Primitive IO operation - retrieves OS version, locale, timezone
 *
 * Behavior:
 * - Online mock mode: Returns mock data with simulated delay
 * - Offline mock mode: Throws network error
 * - Production: Invokes Tauri command: get_system_info
 *
 * @returns System information (validated)
 * @throws Error on IPC failure or validation error
 */
export async function getSystemInfo(): Promise<RawSystemInfo> {
  if (isMockingOffline()) {
    await mockDelay();
    throw new Error('Network error (offline mock mode)');
  }

  if (isMockingOnline()) {
    await mockDelay();
    return {
      osVersion: 'macOS',
      locale: 'en-US',
      timezone: 'UTC+9',
    };
  }

  const raw = await invoke<RawSystemInfo>('get_system_info');
  return validateSystemInfo(raw);
}

/**
 * Read debug logs from device
 *
 * Primitive IO operation - reads latest 500 log entries from ~/.yorutsuke/logs/YYYY-MM-DD.jsonl
 *
 * Behavior:
 * - Online mock mode: Returns mock logs with simulated delay
 * - Offline mock mode: Throws network error
 * - Production: Invokes Tauri command: read_debug_logs
 *
 * @returns Array of JSON log entries (validated)
 * @throws Error on IPC failure or validation error
 */
export async function getDebugLogs(): Promise<RawDebugLogs> {
  if (isMockingOffline()) {
    await mockDelay();
    throw new Error('Network error (offline mock mode)');
  }

  if (isMockingOnline()) {
    await mockDelay();
    return [
      { timestamp: new Date().toISOString(), level: 'info', message: 'App started' },
      { timestamp: new Date().toISOString(), level: 'info', message: 'Database initialized' },
    ];
  }

  const raw = await invoke<RawDebugLogs>('read_debug_logs');
  return validateDebugLogs(raw);
}

/**
 * Get database directory size
 *
 * Primitive IO operation - recursively calculates size of data directory
 *
 * Behavior:
 * - Online mock mode: Returns mock size with simulated delay
 * - Offline mock mode: Throws network error
 * - Production: Invokes Tauri command: get_directory_size
 *
 * @param path - Directory path to measure
 * @returns Directory size in bytes and formatted string
 * @throws Error on IPC failure or validation error
 */
export async function getDirectorySize(path: string): Promise<RawDirectorySize> {
  if (isMockingOffline()) {
    await mockDelay();
    throw new Error('Network error (offline mock mode)');
  }

  if (isMockingOnline()) {
    await mockDelay();
    return {
      bytes: 5242880,
      formatted: '5.0 MB',
    };
  }

  const raw = await invoke<RawDirectorySize>('get_directory_size', { path });
  return validateDirectorySize(raw);
}

