// Pillar L: View - renders data from headless hook
import { useSettings } from '../headless';
import { useAuth } from '../../auth';
import '../styles/settings.css';

// App version from package.json
const APP_VERSION = '0.1.0';

export function SettingsView() {
  const { state, update } = useSettings();
  const { user, logout } = useAuth();

  // Handle all states (Pillar D: FSM)
  if (state.status === 'loading' || state.status === 'idle') {
    return <div className="settings-loading">Loading settings...</div>;
  }
  if (state.status === 'error') {
    return <div className="settings-error">Error: {state.error}</div>;
  }

  // After FSM checks, settings is guaranteed non-null
  const currentSettings = state.settings;

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <div className="settings-view">
      <header className="settings-header">
        <h2>Settings</h2>
      </header>

      {/* User Info */}
      {user && (
        <section className="settings-section">
          <h3>Account</h3>
          <div className="setting-row">
            <span className="setting-label">Email</span>
            <span className="setting-value">{user.email}</span>
          </div>
          <div className="setting-row">
            <span className="setting-label">Tier</span>
            <span className="setting-value tier-badge">{user.tier}</span>
          </div>
        </section>
      )}

      {/* Preferences */}
      <section className="settings-section">
        <h3>Preferences</h3>

        <div className="setting-row">
          <span className="setting-label">Theme</span>
          <select
            className="setting-select"
            value={currentSettings.theme}
            onChange={(e) => update('theme', e.target.value as 'light' | 'dark')}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="setting-row">
          <span className="setting-label">Language</span>
          <select
            className="setting-select"
            value={currentSettings.language}
            onChange={(e) => update('language', e.target.value as 'ja' | 'en')}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="setting-row">
          <span className="setting-label">Notifications</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={currentSettings.notificationEnabled}
              onChange={(e) => update('notificationEnabled', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </section>

      {/* Debug */}
      <section className="settings-section">
        <h3>Developer</h3>

        <div className="setting-row">
          <span className="setting-label">Debug Mode</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={currentSettings.debugEnabled}
              onChange={(e) => update('debugEnabled', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {currentSettings.debugEnabled && (
          <div className="debug-info">
            <div className="debug-row">
              <span>User ID</span>
              <code>{user?.id || 'N/A'}</code>
            </div>
            <div className="debug-row">
              <span>Theme</span>
              <code>{currentSettings.theme}</code>
            </div>
            <div className="debug-row">
              <span>Language</span>
              <code>{currentSettings.language}</code>
            </div>
          </div>
        )}
      </section>

      {/* About */}
      <section className="settings-section">
        <h3>About</h3>
        <div className="setting-row">
          <span className="setting-label">Version</span>
          <span className="setting-value">{APP_VERSION}</span>
        </div>
      </section>

      {/* Actions */}
      <section className="settings-section">
        <button className="btn-logout" onClick={handleLogout}>
          Logout
        </button>
      </section>
    </div>
  );
}
