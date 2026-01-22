/**
 * Debug Settings Vanilla Store
 * Manages debug-specific settings independently from Settings module
 *
 * Pillar I: Module isolation - Debug owns its settings
 * Pillar D: FSM - explicit state machine for settings loading
 *
 * Created for Issue #166: Option B - Isolate debug settings
 */

import { createStore } from 'zustand/vanilla';
import type { DebugSettings } from '../adapters/debugSettingsDb';

/**
 * Debug Settings FSM State
 * Pillar D: No boolean flags, explicit states
 */
export type DebugSettingsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; settings: DebugSettings }
  | { status: 'error'; error: string };

/**
 * Store actions (for type safety)
 */
export interface DebugSettingsActions {
  setLoading: () => void;
  setReady: (settings: DebugSettings) => void;
  setError: (error: string) => void;
  updateSetting: <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => void;
  reset: () => void;
}

export type DebugSettingsStore = DebugSettingsState & DebugSettingsActions;

/**
 * Initial state
 */
const initialState: DebugSettingsState = { status: 'idle' };

/**
 * Vanilla Zustand store for debug settings
 * - No React dependencies
 * - Can be subscribed to from services or hooks
 */
export const debugSettingsStore = createStore<DebugSettingsStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Actions
  setLoading: () => set({ status: 'loading' }),

  setReady: (settings: DebugSettings) => set({ status: 'ready', settings }),

  setError: (error: string) => set({ status: 'error', error }),

  updateSetting: <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => {
    const state = get();
    if (state.status !== 'ready') return;

    set({
      status: 'ready',
      settings: { ...state.settings, [key]: value },
    });
  },

  reset: () => set(initialState),
}));

/**
 * Type-safe selectors for use with hooks
 */
export const debugSettingsSelectors = {
  status: (state: DebugSettingsStore) => state.status,
  settings: (state: DebugSettingsStore) => (state.status === 'ready' ? state.settings : null),
  debugEnabled: (state: DebugSettingsStore) => (state.status === 'ready' ? state.settings.debugEnabled : false),
  error: (state: DebugSettingsStore) => (state.status === 'error' ? state.error : null),
};
