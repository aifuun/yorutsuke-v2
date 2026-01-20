/**
 * Diagnostic Data Collection & Export Service
 *
 * Orchestrates comprehensive diagnostic data collection from local device
 * and cloud infrastructure. Generates exportable diagnostic reports.
 *
 * Phase 1: Manual button trigger in Settings
 * Phase 2: Auto-trigger via queue (future)
 *
 * @see ADR-001: Service Layer Pattern
 * @see Pillar L: Headless (pure TS, testable without React)
 * @see Pillar N: TraceId for observability
 */

import { invoke } from '@tauri-apps/api/core';
import { nanoid } from 'nanoid';
import type { UserId } from '../../../00_kernel/types';
import type {
  LocalDiagnosticData,
  DiagnosticExportResult,
  DiagnosticExportSuccess,
  DiagnosticExportError,
  DiagnosticContext,
} from '../types/diagnostic';

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================================
// Error Types
// ============================================================================

class DiagnosticError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'DiagnosticError';
  }
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * Diagnostic Service
 *
 * Manages the complete diagnostic workflow:
 * 1. Collect local data (SQLite, logs, system info)
 * 2. Call Lambda to collect cloud data
 * 3. Generate diagnostic report
 * 4. Return S3 download link
 *
 * @example
 * ```typescript
 * const service = new DiagnosticService();
 * const result = await service.execute(userId, token);
 *
 * if (result.success) {
 *   console.log('Report available at:', result.s3Url);
 * } else {
 *   console.error('Diagnostic failed:', result.error);
 * }
 * ```
 */
export class DiagnosticService {
  private context: DiagnosticContext | null = null;

  /**
   * Execute complete diagnostic workflow
   *
   * @param userId - User identifier
   * @param token - Authentication token
   * @returns Diagnostic export result (success or error)
   */
  async execute(userId: UserId, token: string): Promise<DiagnosticExportResult> {
    const traceId = `trace-${nanoid()}`;
    const startTime = Date.now();

    this.context = {
      state: 'collecting',
      traceId,
      startTime,
    };

    try {
      // Step 1: Collect local data
      this.context.currentPhase = 'local_collection';
      const localData = await this.collectLocalData(traceId);

      // Step 2: Upload to Lambda (which handles cloud data collection)
      this.context.state = 'uploading';
      this.context.currentPhase = 'cloud_upload';
      const result = await this.uploadDiagnosticReport(userId, token, localData, traceId);

      // Step 3: Return result
      this.context.state = 'success';
      return result;
    } catch (error) {
      this.context.state = 'error';
      return this.handleError(error, traceId);
    }
  }

  /**
   * Collect local diagnostic data from device
   *
   * Invokes Tauri IPC command to gather:
   * - SQLite data (transactions, images, settings)
   * - Debug logs (last 500 entries)
   * - System information (OS, locale, timezone)
   * - App state (sync status, queue state)
   *
   * @param traceId - Trace ID for log correlation
   * @returns Local diagnostic data
   * @throws DiagnosticError on failure
   */
  private async collectLocalData(traceId: string): Promise<LocalDiagnosticData> {
    try {
      const data = await this.invokeWithTimeout<LocalDiagnosticData>(
        'collect_diagnostic_data',
        { traceId },
        REQUEST_TIMEOUT_MS
      );

      return data;
    } catch (error) {
      throw new DiagnosticError(
        'LOCAL_COLLECTION_FAILED',
        `Failed to collect local diagnostic data: ${this.getErrorMessage(error)}`,
        true // retryable
      );
    }
  }

  /**
   * Upload diagnostic report to cloud via Lambda
   *
   * Invokes Tauri IPC command which:
   * 1. Sends local data + auth token to Lambda
   * 2. Lambda collects cloud data (DynamoDB, S3, CloudWatch)
   * 3. Lambda generates report
   * 4. Lambda uploads to S3
   * 5. Returns S3 URL + metadata
   *
   * @param userId - User identifier
   * @param token - Auth token
   * @param localData - Local diagnostic data
   * @param traceId - Trace ID for log correlation
   * @returns Export result with S3 URL
   * @throws DiagnosticError on failure
   */
  private async uploadDiagnosticReport(
    userId: UserId,
    token: string,
    localData: LocalDiagnosticData,
    traceId: string
  ): Promise<DiagnosticExportResult> {
    // Retry logic for transient failures
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.invokeWithTimeout<DiagnosticExportSuccess>(
          'upload_diagnostic_report',
          {
            userId,
            token,
            localData,
            traceId,
            attempt,
          },
          REQUEST_TIMEOUT_MS
        );

        return result;
      } catch (error) {
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === MAX_RETRIES;

        if (!isRetryable || isLastAttempt) {
          throw new DiagnosticError(
            'CLOUD_UPLOAD_FAILED',
            `Failed to upload diagnostic report (attempt ${attempt}/${MAX_RETRIES}): ${this.getErrorMessage(error)}`,
            isRetryable && !isLastAttempt
          );
        }

        // Wait before retry
        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAY_MS * attempt);
        }
      }
    }

    // Should not reach here, but just in case
    throw new DiagnosticError(
      'CLOUD_UPLOAD_FAILED',
      `Failed to upload diagnostic report after ${MAX_RETRIES} attempts`,
      false
    );
  }

  /**
   * Handle errors and convert to DiagnosticExportError
   *
   * @param error - Caught error
   * @param _traceId - Trace ID for logging (used for observability)
   * @returns Formatted error result
   */
  private handleError(error: unknown, _traceId: string): DiagnosticExportError {
    if (error instanceof DiagnosticError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Unknown error
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: this.getErrorMessage(error),
        retryable: this.isRetryableError(error),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Invoke Tauri IPC command with timeout protection
   *
   * @param command - IPC command name
   * @param args - Command arguments
   * @param timeoutMs - Timeout in milliseconds
   * @returns Command result
   * @throws Error on timeout or command failure
   */
  private async invokeWithTimeout<T>(
    command: string,
    args: Record<string, unknown>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      invoke<T>(command, args),
      this.createTimeoutPromise(timeoutMs),
    ]);
  }

  /**
   * Create a promise that rejects after specified delay
   *
   * @param ms - Delay in milliseconds
   * @returns Promise that rejects with timeout error
   */
  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new DiagnosticError('REQUEST_TIMEOUT', `Request timeout after ${ms}ms`, true));
      }, ms);
    });
  }

  /**
   * Delay execution by specified milliseconds
   *
   * @param ms - Delay in milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable (transient) or permanent
   *
   * @param error - Error to check
   * @returns true if error is transient and can be retried
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof DiagnosticError) {
      return error.retryable;
    }

    // Network-related errors are typically retryable
    const message = this.getErrorMessage(error).toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('econnreset')
    );
  }

  /**
   * Extract error message from various error types
   *
   * @param error - Error object
   * @returns Error message string
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }

  /**
   * Get current service context
   *
   * @returns Current diagnostic context or null
   */
  getContext(): DiagnosticContext | null {
    return this.context;
  }

  /**
   * Reset service state
   */
  reset(): void {
    this.context = null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global diagnostic service instance
 *
 * @note Created once at app startup
 * @see ADR-001: Service Pattern
 */
export const diagnosticService = new DiagnosticService();
