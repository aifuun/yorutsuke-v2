/**
 * Mock Diagnostic API Adapter
 *
 * Used for testing the DiagnosticService without actual Lambda calls
 * Provides realistic mock responses matching the real adapter's contracts
 */

import { vi } from 'vitest';
import type { DiagnosticExportResponse } from '../diagnosticApi';

/**
 * Generate mock successful export response
 */
export function generateMockDiagnosticExportResponse(
  overrides?: Partial<DiagnosticExportResponse>,
  isAuthenticated: boolean = false
): DiagnosticExportResponse {
  return {
    success: true,
    reportId: `diag-${Date.now()}`,
    s3Url: isAuthenticated
      ? `https://yorutsuke-diagnostics-dev.s3.us-east-1.amazonaws.com/user-test/diag-${Date.now()}.json`
      : '', // Empty for guest users
    timestamp: new Date().toISOString(),
    fileSize: 102400,
    traceId: `trace-${Date.now()}`,
    ...overrides,
  };
}

/**
 * Create mock implementation of diagnosticApi
 * Use with vi.mocked() or vi.doMock() in tests
 */
export const mockDiagnosticApi = {
  uploadDiagnosticReport: vi.fn(
    async (
      userId: string,
      _localData: unknown,
      _traceId: string,
      _attempt: number
    ): Promise<DiagnosticExportResponse> => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 200));

      // Determine if authenticated based on userId prefix
      const isAuthenticated = userId.startsWith('user-');
      return generateMockDiagnosticExportResponse(undefined, isAuthenticated);
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
    uploadDiagnosticReport: vi.fn(
      async (
        userId: string,
        _localData: unknown,
        _traceId: string,
        _attempt: number
      ): Promise<DiagnosticExportResponse> => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Lambda timeout');
        }

        const isAuthenticated = userId.startsWith('user-');
        return generateMockDiagnosticExportResponse(undefined, isAuthenticated);
      }
    ),
  };
}

/**
 * Create mock that always fails
 * Useful for testing error handling
 */
export function createErrorMock(errorMessage: string = 'Lambda request failed') {
  return {
    uploadDiagnosticReport: vi.fn(async () => {
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
    uploadDiagnosticReport: vi.fn(
      async (
        userId: string,
        _localData: unknown,
        _traceId: string,
        _attempt: number
      ): Promise<DiagnosticExportResponse> => {
        await new Promise(resolve => setTimeout(resolve, delayMs));

        const isAuthenticated = userId.startsWith('user-');
        return generateMockDiagnosticExportResponse(undefined, isAuthenticated);
      }
    ),
  };
}
