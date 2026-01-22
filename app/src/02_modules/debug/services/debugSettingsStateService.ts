/**
 * Debug Settings State Service
 * Manages debug settings loading and persistence
 *
 * Pillar I: Module isolation - Debug owns its settings
 * Service Layer: Pure TS, no React dependencies
 *
 * Created for Issue #166: Option B - Isolate debug settings
 */

import { logger } from '../../../00_kernel/telemetry';
import { debugSettingsStore } from '../stores/debugSettingsStore';
import {
  loadDebugSettings,
  saveDebugSetting,
  getDefaultDebugSettings,
  type DebugSettings,
} from '../adapters/debugSettingsDb';

/**
 * Debug Settings State Service
 * Handles IO operations for debug settings
 */
class DebugSettingsStateService {
  /**
   * Load debug settings from SQLite
   */
  async load(): Promise<void> {
    try {
      debugSettingsStore.getState().setLoading();

      const settings = await loadDebugSettings();

      debugSettingsStore.getState().setReady(settings);

      logger.debug('DEBUG_SETTINGS_LOADED', { settings });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugSettingsStore.getState().setError(errorMessage);

      logger.error('DEBUG_SETTINGS_LOAD_ERROR', { error: errorMessage });

      // Fallback to defaults
      const defaults = getDefaultDebugSettings();
      debugSettingsStore.getState().setReady(defaults);
    }
  }

  /**
   * Update a debug setting
   * Updates both store and persists to SQLite
   */
  async update<K extends keyof DebugSettings>(
    key: K,
    value: DebugSettings[K]
  ): Promise<void> {
    try {
      // Update store first (optimistic update)
      debugSettingsStore.getState().updateSetting(key, value);

      // Persist to SQLite
      await saveDebugSetting(key, value);

      logger.debug('DEBUG_SETTING_UPDATED', { key, value });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('DEBUG_SETTING_UPDATE_ERROR', { key, error: errorMessage });

      // Reload to revert optimistic update
      await this.load();
    }
  }

  /**
   * Reset to defaults
   */
  async reset(): Promise<void> {
    try {
      const defaults = getDefaultDebugSettings();

      // Update store
      debugSettingsStore.getState().setReady(defaults);

      // Persist each setting
      await saveDebugSetting('debugEnabled', defaults.debugEnabled);

      logger.debug('DEBUG_SETTINGS_RESET', { defaults });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('DEBUG_SETTINGS_RESET_ERROR', { error: errorMessage });
    }
  }
}

/**
 * Global singleton instance
 */
export const debugSettingsStateService = new DebugSettingsStateService();
