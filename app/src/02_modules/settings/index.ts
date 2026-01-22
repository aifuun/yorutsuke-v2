// Public API for settings module
// Refactored for Issue #165: 4-Layer Architecture

// Stores (Vanilla Zustand)
export { settingsStore, settingsSelectors } from './stores';
export type { SettingsState, SettingsStore } from './stores';

// Hooks (React bridges)
export {
  useSettingsInit,
  useSettingsStatus,
  useSettingsLanguage,
  useSettingsTheme,
  useSettingsError,
  useSettings,
  settingsActions,
} from './hooks';

// Services (IO operations)
export { settingsStateService } from './services/settingsStateService';

// Views
export { SettingsView, UserProfileView } from './views';

// Types
export type { AppSettings } from './adapters/settingsDb';
