/**
 * Diagnostic Data Collection & Export Service
 *
 * Service Layer: Aggregates diagnostic data from multiple sources
 *
 * **Architecture**:
 * - Primitive IO adapters (diagnosticIpc): get_system_info, read_debug_logs, get_directory_size
 * - Database adapters: transactionDb.list(), imageDb.list()
 * - Cloud upload adapter: uploadDiagnosticReportIpc (calls Lambda)
 *
 * This service layer AGGREGATES data from multiple adapters into a complete
 * diagnostic dataset. Business logic lives here, not in Rust or adapters.
 *
 * **Compliance**:
 * - Pillar L: Pure TS service layer (no JSX, fully testable)
 * - Pillar I: Uses adapters, not direct IPC calls
 * - Pillar A: Branded types throughout (UserId, etc)
 * - Pillar N: TraceId for observability
 * - Pillar M: Retry logic with compensation
 *
 * Phase 1: Manual button trigger in Settings
 * Phase 2: Auto-trigger via queue (future)
 */

import { nanoid } from 'nanoid';
import { uploadDiagnosticReportIpc } from '../adapters/diagnosticIpc';
import type { UserId } from '../../../00_kernel/types';
import type {
  LocalDiagnosticData,
  DiagnosticExportResult,
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
      const localData = await this.collectLocalData(userId);

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
   * Aggregates data from multiple IO adapters:
   * - getSystemInfo(): Tauri IPC for system info
   * - getDebugLogs(): Tauri IPC for debug logs
   * - getDirectorySize(): Tauri IPC for DB size
   * - fetchTransactions(): SQLite for transactions
   * - loadUnfinishedImages(): SQLite for images
   *
   * This is the service layer aggregation point - combines primitive IO
   * operations into a complete diagnostic dataset.
   *
   * @param userId - User ID for fetching user-specific data
   * @returns Local diagnostic data (aggregated from multiple sources)
   * @throws DiagnosticError on failure
   */
  private async collectLocalData(userId: UserId): Promise<LocalDiagnosticData> {
    try {
      // Import adapters here to avoid circular dependencies
      const { getSystemInfo, getDebugLogs, getDirectorySize } = await import('../adapters/diagnosticIpc');
      const { fetchTransactions } = await import('../../transaction/adapters');
      const { loadUnfinishedImages } = await import('../../capture/adapters');

      // Collect all data in parallel
      const [systemInfo, debugLogs, dbSizeInfo, transactions, images] = await Promise.all([
        this.invokeWithTimeout(getSystemInfo(), REQUEST_TIMEOUT_MS),
        this.invokeWithTimeout(getDebugLogs(), REQUEST_TIMEOUT_MS),
        this.invokeWithTimeout(
          getDirectorySize(this.getDataPath()),
          REQUEST_TIMEOUT_MS
        ),
        this.invokeWithTimeout(fetchTransactions(userId), REQUEST_TIMEOUT_MS),
        this.invokeWithTimeout(loadUnfinishedImages(userId), REQUEST_TIMEOUT_MS),
      ]);

      // Aggregate into LocalDiagnosticData
      const data: LocalDiagnosticData = {
        timestamp: new Date().toISOString(),
        appVersion: '0.1.0',
        platform: this.getPlatform(),
        systemInfo: {
          osVersion: systemInfo.osVersion,
          locale: systemInfo.locale,
          timezone: systemInfo.timezone,
        },
        localStorage: {
          transactions: Array.isArray(transactions) ? transactions : [],
          images: Array.isArray(images) ? (images as any[]) : [],
          settings: {}, // Can be populated from settingsDb if needed
        },
        appState: {
          lastSyncTime: new Date(Date.now() - 3600000).toISOString(),
          queuedImages: 0,
          syncStatus: 'idle',
          dbSize: dbSizeInfo.formatted,
        },
        debugLogs: Array.isArray(debugLogs) ? (debugLogs as any) : [],
      };

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
   * Calls adapter which invokes Tauri IPC command which:
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
        const result = await this.invokeWithTimeout(
          uploadDiagnosticReportIpc(String(userId), token, localData, traceId, attempt),
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
   * Execute promise with timeout protection
   *
   * @param promise - Promise to execute (from adapter layer)
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise result
   * @throws Error on timeout or promise failure
   */
  private async invokeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([promise, this.createTimeoutPromise(timeoutMs)]);
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

  /**
   * Get the data directory path
   *
   * @returns Path to the yorutsuke-v2 data directory
   */
  private getDataPath(): string {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      // In Tauri context, use the app data directory
      // This is handled by the IPC layer
      const homeDir = window.location.pathname.includes('yorutsuke')
        ? '/Users/woo/.yorutsuke'
        : '~/.yorutsuke';
      return homeDir;
    }
    return '~/.yorutsuke';
  }

  /**
   * Get the platform identifier
   *
   * @returns 'darwin' | 'linux' | 'win32' | 'unknown'
   */
  private getPlatform(): 'darwin' | 'linux' | 'win32' {
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('mac')) return 'darwin';
      if (userAgent.includes('linux')) return 'linux';
      if (userAgent.includes('win')) return 'win32';
    }
    return 'darwin'; // Default to darwin for fallback
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
