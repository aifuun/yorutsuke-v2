/**
 * Settings State Service
 * Orchestrates settings operations and manages store state
 *
 * Refactored for Issue #165: 4-Layer Architecture
 * - Store extracted to stores/settingsStore.ts
 * - This service handles IO operations and side effects
 *
 * Pillar D: FSM - explicit state machine (in store)
 * Pillar J: Locality - state near usage
 */

import { settingsStore } from '../stores';
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

class SettingsStateService {
  private static instance: SettingsStateService | null = null;
  private initialized = false;

  /**
   * Private constructor - enforces singleton pattern
   */
  private constructor() {}

  /**
   * Get or create the singleton instance
   * @internal - Used only for module exports, not for app code
   */
  static getInstance(): SettingsStateService {
    if (!SettingsStateService.instance) {
      SettingsStateService.instance = new SettingsStateService();
    }
    return SettingsStateService.instance;
  }

  /**
   * Initialize service - load settings and apply them
   * Called once at app startup
   */
  async init(): Promise<void> {
    // Prevent duplicate initialization
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    await this.load();
  }

  /**
   * Load settings from storage
   */
  async load(): Promise<void> {
    settingsStore.getState().setLoading();

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
      settingsStore.getState().setReady(settings);
    } catch (e) {
      logger.error(EVENTS.APP_ERROR, { context: 'settings_load', error: String(e) });
      settingsStore.getState().setError(String(e));
    }
  }

  /**
   * Update a setting value
   * Uses optimistic update pattern
   */
  async update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    const state = settingsStore.getState();

    // Only update if in ready state
    if (state.status !== 'ready') return;

    // Optimistic update (store handles immutability)
    settingsStore.getState().updateSetting(key, value);
    logger.info(EVENTS.SETTINGS_UPDATED, { key, value });

    // Apply theme immediately when changed
    if (key === 'theme') {
      applyTheme(value as 'light' | 'dark');
    }

    // Apply language immediately when changed
    if (key === 'language') {
      changeLanguage(value as AppSettings['language']);
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
    const state = settingsStore.getState();
    return state.status === 'ready' ? state.settings : null;
  }

  /**
   * Cleanup resources and reset singleton
   * Note: Only use for testing. In production, the singleton lives for entire app lifetime.
   */
  destroy(): void {
    this.initialized = false;
    settingsStore.getState().reset();
    SettingsStateService.instance = null;
  }
}

/**
 * Singleton instance - guaranteed to be created only once
 * Call init() once at app startup to load settings
 */
export const settingsStateService = SettingsStateService.getInstance();
