/**
 * Mock Diagnostic IPC Adapter
 *
 * Used for testing the DiagnosticService without actual Tauri invocations
 * Provides realistic mock responses matching the real adapter's contracts
 */

import { vi } from 'vitest';
import type { LocalDiagnosticData, DiagnosticExportSuccess } from '../../types/diagnostic';

/**
 * Generate mock local diagnostic data
 * Use for testing without Rust backend
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

/**
 * Create mock implementation of diagnosticIpc
 * Use with vi.mocked() or vi.doMock() in tests
 */
export const mockDiagnosticIpc = {
  collectLocalDiagnosticData: vi.fn(
    async (_traceId: string): Promise<LocalDiagnosticData> => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
      return generateMockLocalDiagnosticData();
    }
  ),

  uploadDiagnosticReportIpc: vi.fn(
    async (_userId: string, _token: string, _localData: LocalDiagnosticData, _traceId: string, _attempt: number): Promise<DiagnosticExportSuccess> => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 200));
      return generateMockDiagnosticExportSuccess();
    }
  ),
};

/**
 * Create mock that fails on first attempt, succeeds on second
 * Useful for testing retry logic
 */
export function createRetryMock() {
  let attemptCount = 0;

  return {
    collectLocalDiagnosticData: vi.fn(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('Network timeout');
      }
      return generateMockLocalDiagnosticData();
    }),

    uploadDiagnosticReportIpc: vi.fn(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('Lambda timeout');
      }
      return generateMockDiagnosticExportSuccess();
    }),
  };
}

/**
 * Create mock that always fails
 * Useful for testing error handling
 */
export function createErrorMock(errorMessage: string = 'IPC failure') {
  return {
    collectLocalDiagnosticData: vi.fn(async () => {
      throw new Error(errorMessage);
    }),

    uploadDiagnosticReportIpc: vi.fn(async () => {
      throw new Error(errorMessage);
    }),
  };
}

/**
 * Create mock with configurable delays
 * Useful for testing timeout scenarios
 */
export function createDelayMock(delayMs: number) {
  return {
    collectLocalDiagnosticData: vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return generateMockLocalDiagnosticData();
    }),

    uploadDiagnosticReportIpc: vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return generateMockDiagnosticExportSuccess();
    }),
  };
}
