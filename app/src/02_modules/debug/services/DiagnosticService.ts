/**
 * Diagnostic Data Collection & Export Service
 *
 * Service Layer: Aggregates diagnostic data from multiple sources
 *
 * **Architecture**:
 * - Primitive IO adapters (diagnosticIpc): get_system_info, read_debug_logs, get_directory_size
 * - Database adapters: transactionDb.list(), imageDb.list()
 * - Cloud API adapters (diagnosticApi): uploadDiagnosticReport (calls Lambda)
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
import { createStore } from 'zustand/vanilla';
import { logger } from '../../../00_kernel/telemetry';
import { uploadDiagnosticReport } from '../adapters/diagnosticApi';
import type { UserId } from '../../../00_kernel/types';
import type {
  LocalDiagnosticData,
  DiagnosticExportResult,
  DiagnosticExportError,
  DiagnosticContext,
  DiagnosticState,
  DiagnosticPhase,
  PhaseStatus,
  FSMValidationResult,
} from '../types/diagnostic';
import { VALID_STATE_TRANSITIONS } from '../types/diagnostic';

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================================
// Zustand Vanilla Store (Pillar L: Pure TS state management)
// ============================================================================

interface DiagnosticStoreState {
  state: DiagnosticState;
  result: DiagnosticExportResult | null;
  error: string | null;
  context: DiagnosticContext | null;
}

export const diagnosticStore = createStore<DiagnosticStoreState>(() => ({
  state: 'idle',
  result: null,
  error: null,
  context: null,
}));

// ============================================================================
// FSM (Finite State Machine) Manager
// ============================================================================

class DiagnosticFSM {
  /**
   * Validate if a state transition is allowed
   *
   * @param fromState - Current state
   * @param toState - Desired state
   * @returns Validation result
   */
  validateTransition(fromState: DiagnosticState, toState: DiagnosticState): FSMValidationResult {
    // Self-transitions are allowed only for resetting
    if (fromState === toState) {
      return {
        isValid: false,
        error: `Cannot transition to same state: ${fromState}`,
      };
    }

    // Find valid transition
    const transition = VALID_STATE_TRANSITIONS.find(t => t.from === fromState && t.to === toState);

    if (!transition) {
      return {
        isValid: false,
        error: `Invalid transition: ${fromState} → ${toState}. Check FSM diagram.`,
      };
    }

    return {
      isValid: true,
      transition,
    };
  }

  /**
   * Get allowed next states from current state
   *
   * @param currentState - Current state
   * @returns Array of allowed next states
   */
  getNextStates(currentState: DiagnosticState): DiagnosticState[] {
    return VALID_STATE_TRANSITIONS
      .filter(t => t.from === currentState)
      .map(t => t.to);
  }

  /**
   * Get FSM state diagram as ASCII art
   *
   * @returns ASCII diagram
   */
  getStateDiagram(): string {
    return `
Diagnostic Export FSM State Diagram:

  idle
    ├→ collecting
    │   ├→ uploading
    │   │   ├→ success (reset)→ idle
    │   │   └→ error (recovery)→ idle
    │   │         └→ collecting (retry)
    │   └→ error (recovery)→ idle
    │         └→ collecting (retry)
    └→ error (recovery)→ idle
          └→ collecting (retry)
    `;
  }
}

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
  private fsm: DiagnosticFSM = new DiagnosticFSM();

  /**
   * Transition to a new state with FSM validation
   *
   * Throws DiagnosticError if transition is invalid
   *
   * @param nextState - Target state
   * @param reason - Optional reason for transition (for logging)
   * @throws DiagnosticError if transition is invalid
   */
  private transitionState(nextState: DiagnosticState, reason?: string): void {
    if (!this.context) {
      throw new DiagnosticError(
        'FSM_ERROR',
        'Cannot transition: context is null',
        false
      );
    }

    const currentState = this.context.state;
    const validation = this.fsm.validateTransition(currentState, nextState);

    if (!validation.isValid) {
      throw new DiagnosticError(
        'FSM_INVALID_TRANSITION',
        validation.error || `Invalid state transition: ${currentState} → ${nextState}`,
        false
      );
    }

    // Log state transition (Pillar N: Observability)
    logger.debug('DIAGNOSTIC_STATE_TRANSITION', {
      from: currentState,
      to: nextState,
      reason: reason || validation.transition?.reason,
      traceId: this.context.traceId,
    });

    // Update state
    this.context.state = nextState;

    // Update store
    diagnosticStore.setState({
      state: nextState,
      context: this.context,
    });
  }

  /**
   * Initialize 5-step phase tracking structure
   *
   * @returns Initialized phases record
   */
  private initializePhases() {
    const phases: Record<DiagnosticPhase, any> = {
      step1_local_collection: { phase: 'step1_local_collection', status: 'pending' },
      step2_upload_local: { phase: 'step2_upload_local', status: 'pending' },
      step3_cloud_collection: { phase: 'step3_cloud_collection', status: 'pending' },
      step4_merge: { phase: 'step4_merge', status: 'pending' },
      step5_generate_link: { phase: 'step5_generate_link', status: 'pending' },
    };
    return phases;
  }

  /**
   * Update a phase and recalculate overall progress
   *
   * @param phase - Phase to update
   * @param status - New status
   * @param options - Additional options (progress, duration, error, details)
   */
  private updatePhase(
    phase: DiagnosticPhase,
    status: PhaseStatus,
    options?: { progress?: number; duration?: number; error?: string; details?: Record<string, unknown> }
  ) {
    if (!this.context) return;

    this.context.phases[phase] = {
      phase,
      status,
      ...options,
    };

    // Calculate overall progress (each phase is 20%)
    const completedPhases = Object.values(this.context.phases).filter(
      (p) => p.status === 'completed'
    ).length;
    this.context.overallProgress = (completedPhases / 5) * 100;

    // Update store
    diagnosticStore.setState({
      state: this.context.state,
      context: this.context,
    });
  }

  /**
   * Execute complete diagnostic workflow
   *
   * @param userId - User identifier (determines access level)
   *        - Format "device-*" = guest user (local data only)
   *        - Format "user-*" = authenticated user (local + cloud data)
   * @returns Diagnostic export result (success or error)
   */
  async execute(userId: UserId): Promise<DiagnosticExportResult> {
    const traceId = `trace-${nanoid()}`;
    const startTime = Date.now();

    logger.info('DIAGNOSTIC_EXPORT_START', {
      traceId,
      userId: String(userId),
    });

    this.context = {
      state: 'idle',
      traceId,
      startTime,
      currentPhase: 'step1_local_collection',
      phases: this.initializePhases(),
      overallProgress: 0,
    };

    try {
      // FSM: idle → collecting
      this.transitionState('collecting', 'User initiates diagnostic export');

      // Update store with initial state
      diagnosticStore.setState({
        state: 'collecting',
        context: this.context,
        error: null,
        result: null,
      });

      // Step 1: Collect local data (always works)
      this.updatePhase('step1_local_collection', 'in_progress');
      const step1StartTime = Date.now();
      const localData = await this.collectLocalData(userId);
      const step1Duration = Date.now() - step1StartTime;
      this.updatePhase('step1_local_collection', 'completed', { duration: step1Duration });

      // FSM: collecting → uploading
      this.transitionState('uploading', 'Local data collection complete');
      this.context.currentPhase = 'step2_upload_local';
      this.updatePhase('step2_upload_local', 'in_progress');
      const step2StartTime = Date.now();

      // Step 3-5 are handled by Lambda, mark them based on Lambda response
      this.updatePhase('step3_cloud_collection', 'in_progress');
      this.updatePhase('step4_merge', 'in_progress');
      this.updatePhase('step5_generate_link', 'in_progress');

      const result = await this.uploadDiagnosticReport(userId, localData, traceId);
      const step2Duration = Date.now() - step2StartTime;
      this.updatePhase('step2_upload_local', 'completed', { duration: step2Duration });

      // Mark remaining steps as completed (lambda handled them)
      this.updatePhase('step3_cloud_collection', 'completed');
      this.updatePhase('step4_merge', 'completed');
      this.updatePhase('step5_generate_link', 'completed');

      // FSM: uploading → success
      this.transitionState('success', 'Cloud collection and report generation complete');

      const duration = Date.now() - startTime;
      logger.info('DIAGNOSTIC_EXPORT_SUCCESS', {
        traceId: this.context.traceId,
        reportId: (result as any).reportId,
        fileSize: (result as any).fileSize,
        duration,
      });

      diagnosticStore.setState({
        state: 'success',
        result,
        context: this.context,
      });

      return result;
    } catch (error) {
      // FSM: any state → error
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('DIAGNOSTIC_EXPORT_ERROR', {
        traceId: this.context?.traceId,
        error: errorMessage,
      });

      try {
        this.transitionState('error', `Operation failed: ${errorMessage}`);
      } catch (fsmError) {
        // If FSM validation fails, just log it and update directly
        logger.error('DIAGNOSTIC_FSM_ERROR_HANDLING', {
          fsmError: fsmError instanceof Error ? fsmError.message : String(fsmError),
        });
        if (this.context) {
          this.context.state = 'error';
          this.context.lastError = errorMessage;
        }
      }

      const errorResult = this.handleError(error, this.context?.traceId || traceId);

      diagnosticStore.setState({
        state: 'error',
        error: errorResult.error.message,
        result: errorResult,
        context: this.context,
      });

      return errorResult;
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
      logger.debug('DIAGNOSTIC_LOCAL_COLLECTION_START', {
        traceId: this.context?.traceId,
      });

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

      logger.debug('DIAGNOSTIC_LOCAL_COLLECTION_COMPLETE', {
        traceId: this.context?.traceId,
        transactionCount: data.localStorage.transactions.length,
        imageCount: data.localStorage.images.length,
        logCount: data.debugLogs.length,
      });

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
   * Send diagnostic data to Lambda for processing
   *
   * Calls adapter which invokes Tauri IPC command which:
   * 1. Sends userId + local data to Lambda
   * 2. Lambda determines access level based on userId prefix:
   *    - "device-*" (guest): returns local data only
   *    - "user-*" (authenticated): collects cloud data too
   * 3. Lambda generates report
   * 4. Lambda uploads to S3 (if authenticated)
   * 5. Returns S3 URL or local data reference
   *
   * @param userId - User identifier (no token needed, IAM controls access)
   * @param localData - Local diagnostic data
   * @param traceId - Trace ID for log correlation
   * @returns Export result with S3 URL or local data info
   * @throws DiagnosticError on failure
   */
  private async uploadDiagnosticReport(
    userId: UserId,
    localData: LocalDiagnosticData,
    traceId: string
  ): Promise<DiagnosticExportResult> {
    // Retry logic for transient failures
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.invokeWithTimeout(
          uploadDiagnosticReport(String(userId), localData, traceId, attempt),
          REQUEST_TIMEOUT_MS
        );

        return result;
      } catch (error) {
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === MAX_RETRIES;

        if (!isRetryable || isLastAttempt) {
          throw new DiagnosticError(
            'CLOUD_UPLOAD_FAILED',
            `Failed to send diagnostic report (attempt ${attempt}/${MAX_RETRIES}): ${this.getErrorMessage(error)}`,
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
      `Failed to send diagnostic report after ${MAX_RETRIES} attempts`,
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
   * Reset service state back to idle
   *
   * FSM: success/error → idle
   */
  reset(): void {
    logger.debug('DIAGNOSTIC_RESET_START', {
      currentState: this.context?.state,
    });

    if (this.context) {
      const currentState = this.context.state;

      // FSM: any state (except idle) → idle
      if (currentState !== 'idle') {
        try {
          logger.debug('DIAGNOSTIC_RESET_FSM_TRANSITION', {
            from: currentState,
            to: 'idle',
          });
          this.transitionState('idle', 'User resets state');
          logger.debug('DIAGNOSTIC_RESET_FSM_SUCCESS', {});
        } catch (error) {
          // If transition fails, force reset anyway for recovery
          logger.error('DIAGNOSTIC_RESET_FSM_FAILED', {
            error: error instanceof Error ? error.message : String(error),
          });
          if (this.context) {
            this.context.state = 'idle';
          }
        }
      }
    }

    this.context = null;

    diagnosticStore.setState({
      state: 'idle',
      result: null,
      error: null,
      context: null,
    });
    logger.debug('DIAGNOSTIC_RESET_COMPLETE', {});
  }

  /**
   * Get FSM state diagram (for debugging)
   *
   * @returns ASCII state diagram
   */
  getStateDiagram(): string {
    return this.fsm.getStateDiagram();
  }

  /**
   * Get allowed next states from current state
   *
   * @returns Array of allowed next states
   */
  getAllowedNextStates(): DiagnosticState[] {
    if (!this.context) {
      return [];
    }
    return this.fsm.getNextStates(this.context.state);
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

/**
 * Global diagnostic store
 *
 * @note React components subscribe via: useStore(diagnosticStore, selector)
 * @see ADR-001: Service Pattern - Pure TS state, React observes only
 */
// diagnosticStore is already exported above
