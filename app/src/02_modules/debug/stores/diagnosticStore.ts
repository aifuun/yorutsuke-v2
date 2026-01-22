/**
 * Diagnostic Vanilla Store
 * Pillar D: FSM - explicit state machine for diagnostic workflow
 *
 * Extracted from DiagnosticService (Issue #166)
 * This store is UI-agnostic and can be used with any framework
 */

import { createStore } from 'zustand/vanilla';
import type {
  DiagnosticState,
  DiagnosticExportResult,
  DiagnosticContext,
} from '../types/diagnostic';

/**
 * Diagnostic Store State
 * Pillar D: FSM state machine (idle → collecting → uploading → success/error)
 */
export interface DiagnosticStoreState {
  state: DiagnosticState;
  result: DiagnosticExportResult | null;
  error: string | null;
  context: DiagnosticContext | null;
}

/**
 * Store actions (for type safety)
 */
export interface DiagnosticActions {
  setState: (state: DiagnosticState) => void;
  setResult: (result: DiagnosticExportResult) => void;
  setError: (error: string) => void;
  setContext: (context: DiagnosticContext | null) => void;
  updateContext: (updates: Partial<DiagnosticContext>) => void;
  reset: () => void;
}

export type DiagnosticStore = DiagnosticStoreState & DiagnosticActions;

/**
 * Initial state
 */
const initialState: DiagnosticStoreState = {
  state: 'idle',
  result: null,
  error: null,
  context: null,
};

/**
 * Vanilla Zustand store for diagnostic workflow
 * - No React dependencies
 * - Can be subscribed to from services or hooks
 */
export const diagnosticStore = createStore<DiagnosticStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Actions
  setState: (state: DiagnosticState) => set({ state }),

  setResult: (result: DiagnosticExportResult) => set({ result }),

  setError: (error: string) => set({ error }),

  setContext: (context: DiagnosticContext | null) => set({ context }),

  updateContext: (updates: Partial<DiagnosticContext>) => {
    const currentContext = get().context;
    if (!currentContext) return;

    set({
      context: {
        ...currentContext,
        ...updates,
        phases: { ...currentContext.phases, ...(updates.phases || {}) },
      },
    });
  },

  reset: () => set(initialState),
}));

/**
 * Type-safe selectors for use with hooks
 * Each selector returns a primitive value to avoid infinite loops (ADR-012)
 */
export const diagnosticSelectors = {
  state: (store: DiagnosticStore) => store.state,
  result: (store: DiagnosticStore) => store.result,
  error: (store: DiagnosticStore) => store.error,
  context: (store: DiagnosticStore) => store.context,
  overallProgress: (store: DiagnosticStore) => store.context?.overallProgress ?? 0,
  currentPhase: (store: DiagnosticStore) => store.context?.currentPhase ?? null,
};
