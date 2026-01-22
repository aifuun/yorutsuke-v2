/**
 * Settings Vanilla Store
 * Pillar D: FSM - explicit state machine for settings
 *
 * Extracted from settingsStateService (Issue #165)
 * This store is UI-agnostic and can be used with any framework
 */

import { createStore } from 'zustand/vanilla';
import type { AppSettings } from '../adapters';

/**
 * Settings FSM State
 * Pillar D: No boolean flags, explicit states
 */
export type SettingsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; settings: AppSettings }
  | { status: 'error'; error: string };

/**
 * Store actions (for type safety)
 */
export interface SettingsActions {
  setLoading: () => void;
  setReady: (settings: AppSettings) => void;
  setError: (error: string) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  reset: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

/**
 * Initial state
 */
const initialState: SettingsState = { status: 'idle' };

/**
 * Vanilla Zustand store for settings
 * - No React dependencies
 * - Can be subscribed to from services or hooks
 */
export const settingsStore = createStore<SettingsStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Actions
  setLoading: () => set({ status: 'loading' }),

  setReady: (settings: AppSettings) => set({ status: 'ready', settings }),

  setError: (error: string) => set({ status: 'error', error }),

  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
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
export const settingsSelectors = {
  status: (state: SettingsStore) => state.status,
  settings: (state: SettingsStore) => (state.status === 'ready' ? state.settings : null),
  language: (state: SettingsStore) => (state.status === 'ready' ? state.settings.language : 'en'),
  theme: (state: SettingsStore) => (state.status === 'ready' ? state.settings.theme : 'dark'),
  error: (state: SettingsStore) => (state.status === 'error' ? state.error : null),
};
