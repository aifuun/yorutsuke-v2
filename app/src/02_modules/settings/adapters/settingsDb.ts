// Settings SQLite Adapter
// Thin wrapper around kernel storage for settings-specific operations

import { getSetting, setSetting } from '../../../00_kernel/storage';

// Settings keys
export type SettingsKey =
  | 'user_name'
  | 'notification_enabled'
  | 'theme'
  | 'language'
  | 'debug_enabled';

// Type-safe settings
export interface AppSettings {
  userName: string | null;
  notificationEnabled: boolean;
  theme: 'light' | 'dark';
  language: 'ja' | 'en' | 'zh';
  debugEnabled: boolean;
}

// Default values
const DEFAULTS: AppSettings = {
  userName: null,
  notificationEnabled: true,
  theme: 'dark',
  language: 'en',
  debugEnabled: false,
};

/**
 * Load all settings from SQLite
 */
export async function loadSettings(): Promise<AppSettings> {
  const [userName, notification, theme, language, debug] = await Promise.all([
    getSetting('user_name'),
    getSetting('notification_enabled'),
    getSetting('theme'),
    getSetting('language'),
    getSetting('debug_enabled'),
  ]);

  return {
    userName: userName ?? DEFAULTS.userName,
    notificationEnabled: notification === 'false' ? false : DEFAULTS.notificationEnabled,
    theme: (theme as AppSettings['theme']) ?? DEFAULTS.theme,
    language: (language as AppSettings['language']) ?? DEFAULTS.language,
    debugEnabled: debug === 'true',
  };
}

/**
 * Save a single setting
 */
export async function saveSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const dbKey = keyToDbKey(key);
  const dbValue = valueToDbValue(value);
  await setSetting(dbKey, dbValue);
}

// Map AppSettings key to SQLite key
function keyToDbKey(key: keyof AppSettings): SettingsKey {
  const map: Record<keyof AppSettings, SettingsKey> = {
    userName: 'user_name',
    notificationEnabled: 'notification_enabled',
    theme: 'theme',
    language: 'language',
    debugEnabled: 'debug_enabled',
  };
  return map[key];
}

// Convert value to SQLite string
function valueToDbValue(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
