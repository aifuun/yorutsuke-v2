// Public API for settings module

// Services (Issue #141: Service Pattern Migration)
export { settingsStateService } from './services/settingsStateService';

// Hooks (React bridges)
export { useSettingsInit } from './hooks/useSettingsInit';

// Views
export { SettingsView, UserProfileView } from './views';

// Types
export type { AppSettings } from './adapters/settingsDb';
