/**
 * Settings State Hook - React Bridge Layer
 * Pillar L: Headless - separates UI from logic
 *
 * Provides atomic selectors to prevent unnecessary re-renders (ADR-012)
 * Created for Issue #165: Settings 4-Layer Architecture
 */

import { useStore } from 'zustand';
import { settingsStore, settingsSelectors } from '../stores';
import { settingsStateService } from '../services/settingsStateService';
import type { AppSettings } from '../adapters';

/**
 * Get current settings status
 * @returns 'idle' | 'loading' | 'ready' | 'error'
 */
export function useSettingsStatus(): string {
  return useStore(settingsStore, settingsSelectors.status);
}

/**
 * Get current language setting
 * @returns 'ja' | 'en' | 'zh' (defaults to 'en' if not ready)
 */
export function useSettingsLanguage(): AppSettings['language'] {
  return useStore(settingsStore, settingsSelectors.language);
}

/**
 * Get current theme setting
 * @returns 'light' | 'dark' (defaults to 'dark' if not ready)
 */
export function useSettingsTheme(): AppSettings['theme'] {
  return useStore(settingsStore, settingsSelectors.theme);
}

/**
 * Get error message if in error state
 * @returns Error string or null
 */
export function useSettingsError(): string | null {
  return useStore(settingsStore, settingsSelectors.error);
}

/**
 * Get all settings (only when ready)
 * @returns AppSettings or null if not ready
 */
export function useSettings(): AppSettings | null {
  return useStore(settingsStore, settingsSelectors.settings);
}

/**
 * Settings actions - wrapped for React components
 * These delegate to the service layer for IO operations
 */
export const settingsActions = {
  /**
   * Update a setting value
   * Handles both store update and persistence
   */
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> => {
    return settingsStateService.update(key, value);
  },

  /**
   * Reload settings from storage
   */
  reload: (): Promise<void> => {
    return settingsStateService.load();
  },
};
