// Settings Headless Hook
// Pillar L: Headless - No JSX, returns data + functions only
// Pillar D: FSM States

import { useReducer, useCallback, useEffect } from 'react';
import type { AppSettings } from '../adapters';
import { loadAppSettings, updateAppSetting } from '../services/settingsService';
import { changeLanguage } from '../../../i18n';
import { logger, EVENTS } from '../../../00_kernel/telemetry/logger';

/**
 * Apply theme to DOM by setting data-theme attribute on root element
 */
function applyTheme(theme: 'light' | 'dark'): void {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// FSM State
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; settings: AppSettings }
  | { status: 'error'; error: string };

type Action =
  | { type: 'LOAD' }
  | { type: 'LOAD_SUCCESS'; settings: AppSettings }
  | { type: 'UPDATE'; key: keyof AppSettings; value: AppSettings[keyof AppSettings] }
  | { type: 'ERROR'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD':
      return { status: 'loading' };

    case 'LOAD_SUCCESS':
      return { status: 'success', settings: action.settings };

    case 'UPDATE':
      if (state.status !== 'success') return state;
      return {
        status: 'success',
        settings: { ...state.settings, [action.key]: action.value },
      };

    case 'ERROR':
      return { status: 'error', error: action.error };

    default:
      return state;
  }
}

export interface UseSettingsResult {
  state: State;
  settings: AppSettings | null;
  isLoading: boolean;

  // Actions
  load: () => Promise<void>;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

/**
 * Settings Hook - manages app settings
 *
 * Pillar L: Returns data + actions only, no JSX
 * Pillar D: Uses FSM states (idle | loading | success | error)
 */
export function useSettings(): UseSettingsResult {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  const load = useCallback(async () => {
    dispatch({ type: 'LOAD' });
    try {
      const settings = await loadAppSettings();
      // Sync i18n language with stored setting
      if (settings.language) {
        changeLanguage(settings.language);
      }
      // Sync theme with stored setting
      if (settings.theme) {
        applyTheme(settings.theme);
      }
      logger.info(EVENTS.SETTINGS_LOADED, { language: settings.language, theme: settings.theme });
      dispatch({ type: 'LOAD_SUCCESS', settings });
    } catch (e) {
      logger.error(EVENTS.APP_ERROR, { context: 'settings_load', error: String(e) });
      dispatch({ type: 'ERROR', error: String(e) });
    }
  }, []);

  const update = useCallback(async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    // Optimistic update
    dispatch({ type: 'UPDATE', key, value });
    logger.info(EVENTS.SETTINGS_UPDATED, { key, value });

    // Apply theme immediately when changed
    if (key === 'theme') {
      applyTheme(value as 'light' | 'dark');
    }

    try {
      await updateAppSetting(key, value);
    } catch (e) {
      logger.error(EVENTS.SETTINGS_SAVE_FAILED, { key, error: String(e) });
      // Reload on error to get correct state
      await load();
    }
  }, [load]);

  // Auto-load on mount
  useEffect(() => {
    load();
  }, [load]);

  return {
    state,
    settings: state.status === 'success' ? state.settings : null,
    isLoading: state.status === 'loading',
    load,
    update,
  };
}
