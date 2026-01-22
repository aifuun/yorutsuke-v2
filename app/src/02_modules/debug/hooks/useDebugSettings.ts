/**
 * Debug Settings Hook - React Bridge Layer
 * Pillar L: Headless - separates UI from logic
 *
 * Provides atomic selectors to prevent unnecessary re-renders (ADR-012)
 * Created for Issue #166: Option B - Isolate debug settings from Settings module
 */

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { debugSettingsStore, debugSettingsSelectors } from '../stores/debugSettingsStore';
import { debugSettingsStateService } from '../services/debugSettingsStateService';
import type { DebugSettings } from '../adapters/debugSettingsDb';

/**
 * Initialize debug settings on mount
 * Loads settings from SQLite
 */
export function useDebugSettingsInit() {
  useEffect(() => {
    debugSettingsStateService.load();
  }, []);
}

/**
 * Get current debug settings status
 * @returns 'idle' | 'loading' | 'ready' | 'error'
 */
export function useDebugSettingsStatus(): string {
  return useStore(debugSettingsStore, debugSettingsSelectors.status);
}

/**
 * Get debug enabled flag
 * @returns boolean (defaults to false if not ready)
 */
export function useDebugEnabled(): boolean {
  return useStore(debugSettingsStore, debugSettingsSelectors.debugEnabled);
}

/**
 * Get error message if in error state
 * @returns Error string or null
 */
export function useDebugSettingsError(): string | null {
  return useStore(debugSettingsStore, debugSettingsSelectors.error);
}

/**
 * Get all debug settings (only when ready)
 * @returns DebugSettings or null if not ready
 */
export function useDebugSettings(): DebugSettings | null {
  return useStore(debugSettingsStore, debugSettingsSelectors.settings);
}

/**
 * Debug settings actions - wrapped for React components
 * These delegate to the service layer for IO operations
 */
export const debugSettingsActions = {
  /**
   * Update a debug setting value
   * Handles both store update and persistence
   */
  updateSetting: <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]): Promise<void> => {
    return debugSettingsStateService.update(key, value);
  },

  /**
   * Reload debug settings from storage
   */
  reload: (): Promise<void> => {
    return debugSettingsStateService.load();
  },

  /**
   * Reset to defaults
   */
  reset: (): Promise<void> => {
    return debugSettingsStateService.reset();
  },
};
