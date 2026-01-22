/**
 * Diagnostic State Hook - React Bridge Layer
 * Pillar L: Headless - separates UI from logic
 *
 * Provides atomic selectors to prevent unnecessary re-renders (ADR-012)
 * Created for Issue #166: Debug Module Hook Bridge Layer
 */

import { useStore } from 'zustand';
import { diagnosticStore, diagnosticSelectors } from '../stores';
import { diagnosticService } from '../services/DiagnosticService';
import type {
  DiagnosticState,
  DiagnosticExportResult,
  DiagnosticContext,
} from '../types/diagnostic';
import type { UserId } from '../../../00_kernel/types';

/**
 * Get current diagnostic status
 * @returns 'idle' | 'collecting' | 'uploading' | 'success' | 'error'
 */
export function useDiagnosticStatus(): DiagnosticState {
  return useStore(diagnosticStore, diagnosticSelectors.state);
}

/**
 * Get diagnostic export result
 * @returns Export result or null if not complete
 */
export function useDiagnosticResult(): DiagnosticExportResult | null {
  return useStore(diagnosticStore, diagnosticSelectors.result);
}

/**
 * Get error message if in error state
 * @returns Error string or null
 */
export function useDiagnosticError(): string | null {
  return useStore(diagnosticStore, diagnosticSelectors.error);
}

/**
 * Get full diagnostic context
 * @returns DiagnosticContext or null if not started
 */
export function useDiagnosticContext(): DiagnosticContext | null {
  return useStore(diagnosticStore, diagnosticSelectors.context);
}

/**
 * Get overall progress (0-100)
 * @returns Progress percentage
 */
export function useDiagnosticProgress(): number {
  return useStore(diagnosticStore, diagnosticSelectors.overallProgress);
}

/**
 * Get current phase name
 * @returns Current phase or null
 */
export function useDiagnosticPhase() {
  return useStore(diagnosticStore, diagnosticSelectors.currentPhase);
}

/**
 * Diagnostic actions - wrapped for React components
 * These delegate to the service layer for IO operations
 */
export const diagnosticActions = {
  /**
   * Execute diagnostic export workflow
   * Collects local data → uploads to Lambda → returns S3 URL
   */
  execute: (userId: UserId): Promise<DiagnosticExportResult> => {
    return diagnosticService.execute(userId);
  },

  /**
   * Reset diagnostic state back to idle
   */
  reset: (): void => {
    diagnosticService.reset();
  },

  /**
   * Get FSM state diagram (for debugging)
   */
  getStateDiagram: (): string => {
    return diagnosticService.getStateDiagram();
  },

  /**
   * Get allowed next states from current state
   */
  getAllowedNextStates: (): DiagnosticState[] => {
    return diagnosticService.getAllowedNextStates();
  },
};
