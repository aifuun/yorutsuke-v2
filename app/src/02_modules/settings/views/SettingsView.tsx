// Pillar L: View - renders data from headless hook
import { useSettings } from '../headless';
import { useAuth } from '../../auth';
import { useTranslation, changeLanguage } from '../../../i18n';
import '../styles/settings.css';

// App version from package.json
const APP_VERSION = '0.1.0';

export function SettingsView() {
  const { t } = useTranslation();
  const { state, update } = useSettings();
  const { user, logout } = useAuth();

  // Handle all states (Pillar D: FSM)
  if (state.status === 'loading' || state.status === 'idle') {
    return <div className="settings-loading">{t('common.loading')}</div>;
  }
  if (state.status === 'error') {
    return <div className="settings-error">{t('common.error')}: {state.error}</div>;
  }

  // After FSM checks, settings is guaranteed non-null
  const currentSettings = state.settings;

  const handleLanguageChange = (lang: 'ja' | 'en') => {
    changeLanguage(lang);
    update('language', lang);
  };

  const handleLogout = async () => {
    if (confirm(t('settings.logoutConfirm'))) {
      await logout();
    }
  };

  return (
    <div className="settings-view">
      <header className="settings-header">
        <h2>{t('settings.title')}</h2>
      </header>

      {/* User Info */}
      {user && (
        <section className="settings-section">
          <h3>{t('settings.account')}</h3>
          <div className="setting-row">
            <span className="setting-label">{t('settings.email')}</span>
            <span className="setting-value">{user.email}</span>
          </div>
          <div className="setting-row">
            <span className="setting-label">{t('settings.tier')}</span>
            <span className="setting-value tier-badge">{user.tier}</span>
          </div>
        </section>
      )}

      {/* Preferences */}
      <section className="settings-section">
        <h3>{t('settings.preferences')}</h3>

        <div className="setting-row">
          <span className="setting-label">{t('settings.theme')}</span>
          <select
            className="setting-select"
            value={currentSettings.theme}
            onChange={(e) => update('theme', e.target.value as 'light' | 'dark')}
          >
            <option value="light">{t('settings.themeLight')}</option>
            <option value="dark">{t('settings.themeDark')}</option>
          </select>
        </div>

        <div className="setting-row">
          <span className="setting-label">{t('settings.language')}</span>
          <select
            className="setting-select"
            value={currentSettings.language}
            onChange={(e) => handleLanguageChange(e.target.value as 'ja' | 'en')}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="setting-row">
          <span className="setting-label">{t('settings.notifications')}</span>
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
        <h3>{t('settings.developer')}</h3>

        <div className="setting-row">
          <span className="setting-label">{t('settings.debugMode')}</span>
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
        <h3>{t('settings.about')}</h3>
        <div className="setting-row">
          <span className="setting-label">{t('settings.version')}</span>
          <span className="setting-value">{APP_VERSION}</span>
        </div>
      </section>

      {/* Actions */}
      <section className="settings-section">
        <button className="btn-logout" onClick={handleLogout}>
          {t('settings.logout')}
        </button>
      </section>
    </div>
  );
}
