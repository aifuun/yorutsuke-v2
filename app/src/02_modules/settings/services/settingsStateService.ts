/**
 * Settings State Service
 * Manages app settings state and operations
 *
 * Migrated from settings/headless/useSettings.ts (Issue #141)
 * Pillar D: FSM - explicit state machine
 * Pillar J: Locality - state near usage
 */

import { createStore } from 'zustand/vanilla';
import type { AppSettings } from '../adapters';
import { loadAppSettings, updateAppSetting } from './settingsService';
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
type SettingsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; settings: AppSettings }
  | { status: 'error'; error: string };

class SettingsStateService {
  // Zustand vanilla store
  store = createStore<SettingsState>(() => ({
    status: 'idle',
  }));

  /**
   * Initialize service - load settings and apply them
   * Called once at app startup
   */
  async init(): Promise<void> {
    await this.load();
  }

  /**
   * Load settings from storage
   */
  async load(): Promise<void> {
    this.store.setState({ status: 'loading' });

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
      this.store.setState({ status: 'success', settings });
    } catch (e) {
      logger.error(EVENTS.APP_ERROR, { context: 'settings_load', error: String(e) });
      this.store.setState({ status: 'error', error: String(e) });
    }
  }

  /**
   * Update a setting value
   * Uses optimistic update pattern
   */
  async update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    const state = this.store.getState();

    // Only update if in success state
    if (state.status !== 'success') return;

    // Optimistic update
    const updatedSettings = { ...state.settings, [key]: value };
    this.store.setState({ status: 'success', settings: updatedSettings });
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
      await this.load();
    }
  }

  /**
   * Get current settings (if loaded)
   */
  getSettings(): AppSettings | null {
    const state = this.store.getState();
    return state.status === 'success' ? state.settings : null;
  }
}

export const settingsStateService = new SettingsStateService();
