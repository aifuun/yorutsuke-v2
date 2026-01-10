// Settings Service
// Pillar L: Pure TS functions, no React dependencies
// Wraps settings adapters to enforce 4-layer architecture

import type { AppSettings } from '../adapters';
import { loadSettings, saveSetting } from '../adapters';

/**
 * Load all app settings
 */
export async function loadAppSettings(): Promise<AppSettings> {
  return loadSettings();
}

/**
 * Update a single setting
 */
export async function updateAppSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  return saveSetting(key, value);
}
