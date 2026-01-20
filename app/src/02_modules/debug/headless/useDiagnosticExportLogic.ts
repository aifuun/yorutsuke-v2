/**
 * Diagnostic Export Logic Hook
 *
 * Pillar L: Headless - Logic without UI
 * Pillar D: FSM - State machine instead of boolean flags
 *
 * Manages the complete diagnostic export workflow:
 * 1. Idle → User clicks export button
 * 2. Collecting → App collects local + cloud data
 * 3. Uploading → Data uploaded to Lambda/S3
 * 4. Success → Report ready with S3 download link
 * 5. Error → Display error message with retry option
 *
 * @example
 * function DiagnosticPanel() {
 *   const { state, result, error, exportDiagnosticData, reset } = useDiagnosticExportLogic(userId);
 *
 *   return (
 *     <div>
 *       {state === 'idle' && <button onClick={exportDiagnosticData}>Send Data</button>}
 *       {state === 'collecting' && <Spinner />}
 *       {state === 'success' && <a href={result?.s3Url}>Download Report</a>}
 *       {state === 'error' && <p>{error}</p>}
 *     </div>
 *   );
 * }
 */

import { useCallback, useEffect, useReducer, useState } from 'react';
import type { UserId } from '../../../00_kernel/types';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { getAccessToken } from '../../auth/adapters/tokenStorage';
import { diagnosticService } from '../services/DiagnosticService';
import type { DiagnosticExportResult } from '../types/diagnostic';

// ============================================================================
// FSM State Machine
// ============================================================================

type State =
  | { status: 'idle' }
  | { status: 'collecting' }
  | { status: 'uploading' }
  | { status: 'success'; result: DiagnosticExportResult & { success: true } }
  | { status: 'error'; error: string };

type Action =
  | { type: 'START_COLLECTION' }
  | { type: 'START_UPLOAD' }
  | { type: 'SUCCESS'; result: DiagnosticExportResult & { success: true } }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_COLLECTION':
      return { status: 'collecting' };

    case 'START_UPLOAD':
      return { status: 'uploading' };

    case 'SUCCESS':
      return { status: 'success', result: action.result };

    case 'ERROR':
      return { status: 'error', error: action.error };

    case 'RESET':
      return { status: 'idle' };

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Headless hook for diagnostic export workflow
 *
 * Returns state + actions for UI to consume
 * All logic is here, UI just renders the state
 *
 * @param userId - User ID (required for cloud data queries)
 * @returns { state, result, error, exportDiagnosticData, reset }
 */
export function useDiagnosticExportLogic(userId: UserId | null) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  // =========================================================================
  // Load auth token on mount
  // =========================================================================

  useEffect(() => {
    async function loadToken() {
      try {
        const accessToken = await getAccessToken();
        setToken(accessToken);
        logger.debug('DIAGNOSTIC_TOKEN_LOADED', { hasToken: !!accessToken });
      } catch (e) {
        logger.error(EVENTS.APP_ERROR, {
          context: 'loadDiagnosticToken',
          error: String(e),
        });
      } finally {
        setTokenLoading(false);
      }
    }

    loadToken();
  }, []);

  // =========================================================================
  // Main export action
  // =========================================================================

  const exportDiagnosticData = useCallback(async () => {
    // Check preconditions
    if (!userId) {
      logger.warn('DIAGNOSTIC_NO_USER_ID', {});
      dispatch({ type: 'ERROR', error: 'User ID not available' });
      return;
    }

    if (!token) {
      logger.warn('DIAGNOSTIC_NO_TOKEN', {});
      dispatch({ type: 'ERROR', error: 'Authentication token not available' });
      return;
    }

    // Start workflow
    dispatch({ type: 'START_COLLECTION' });
    const traceId = diagnosticService.getContext()?.traceId;

    try {
      logger.info(EVENTS.DIAGNOSTIC_EXPORT_START, {
        userId,
        traceId,
      });

      // Execute diagnostic workflow via service
      const result = await diagnosticService.execute(userId, token);

      // Handle result
      if (result.success) {
        logger.info('DIAGNOSTIC_EXPORT_SUCCESS', {
          userId,
          reportId: result.reportId,
          s3Url: result.s3Url,
          fileSize: result.fileSize,
        });
        dispatch({ type: 'SUCCESS', result });
      } else {
        logger.warn('DIAGNOSTIC_EXPORT_FAILED', {
          userId,
          code: result.error.code,
          message: result.error.message,
          retryable: result.error.retryable,
        });
        dispatch({
          type: 'ERROR',
          error: `${result.error.code}: ${result.error.message}${result.error.retryable ? ' (retry available)' : ''}`,
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error('DIAGNOSTIC_EXPORT_EXCEPTION', {
        userId,
        error: errorMessage,
        traceId,
      });
      dispatch({ type: 'ERROR', error: errorMessage });
    }
  }, [userId, token]);

  // =========================================================================
  // Reset state
  // =========================================================================

  const reset = useCallback(() => {
    diagnosticService.reset();
    dispatch({ type: 'RESET' });
  }, []);

  // =========================================================================
  // Return state + actions (Pillar L: No JSX, only data)
  // =========================================================================

  return {
    // FSM State
    state: state.status,
    result: state.status === 'success' ? state.result : null,
    error: state.status === 'error' ? state.error : null,

    // Loading states
    isLoading: state.status === 'collecting' || state.status === 'uploading',
    tokenLoading,

    // Actions
    exportDiagnosticData,
    reset,
  };
}
