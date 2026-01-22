/**
 * Debug Settings SQLite Adapter
 * Manages debug-specific settings independently from Settings module
 *
 * Pillar I: Module isolation - Debug module owns its settings
 * Created for Issue #166: Option B - Isolate debug settings
 */

import { getSetting, setSetting } from '../../../00_kernel/storage';

/**
 * Debug settings keys (stored in settings table)
 */
export type DebugSettingsKey = 'debug_enabled';

/**
 * Debug module settings
 */
export interface DebugSettings {
  debugEnabled: boolean;
}

/**
 * Default values
 */
const DEFAULTS: DebugSettings = {
  debugEnabled: false,
};

/**
 * Load debug settings from SQLite
 */
export async function loadDebugSettings(): Promise<DebugSettings> {
  const debugEnabled = await getSetting('debug_enabled');

  return {
    debugEnabled: debugEnabled === 'true',
  };
}

/**
 * Save a debug setting to SQLite
 */
export async function saveDebugSetting<K extends keyof DebugSettings>(
  _key: K,
  value: DebugSettings[K]
): Promise<void> {
  // Map to database key (currently only one setting)
  const dbKey: DebugSettingsKey = 'debug_enabled';

  // Convert to string for storage
  const stringValue = String(value);

  await setSetting(dbKey, stringValue);
}

/**
 * Get default debug settings
 */
export function getDefaultDebugSettings(): DebugSettings {
  return { ...DEFAULTS };
}
