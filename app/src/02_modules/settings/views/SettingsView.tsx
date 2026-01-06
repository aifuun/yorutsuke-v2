// Pillar L: View - renders data from headless hook
import { useSettings } from '../headless';
import { useTranslation, changeLanguage } from '../../../i18n';
import '../styles/settings.css';

// App version from package.json
const APP_VERSION = '0.1.0';

export function SettingsView() {
  const { t } = useTranslation();
  const { state, update } = useSettings();

  // Handle all states (Pillar D: FSM)
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="settings">
        <SettingsHeader title={t('settings.title')} />
        <div className="settings-content">
          <div className="settings-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="settings">
        <SettingsHeader title={t('settings.title')} />
        <div className="settings-content">
          <div className="settings-error">{t('common.error')}</div>
        </div>
      </div>
    );
  }

  // After FSM checks, settings is guaranteed non-null
  const currentSettings = state.settings;

  const handleLanguageChange = (lang: 'ja' | 'en') => {
    changeLanguage(lang);
    update('language', lang);
  };

  return (
    <div className="settings">
      <SettingsHeader title={t('settings.title')} version={APP_VERSION} />

      <div className="settings-content">
        <div className="settings-container">
          {/* Section 1: General */}
          <div className="premium-card settings-card">
            <h2 className="section-header">{t('settings.preferences')}</h2>

            {/* Theme */}
            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.theme')}</p>
                <p className="setting-hint">{t('settings.themeHint')}</p>
              </div>
              <select
                className="select"
                value={currentSettings.theme}
                onChange={(e) => update('theme', e.target.value as 'light' | 'dark')}
              >
                <option value="dark">{t('settings.themeDark')}</option>
                <option value="light">{t('settings.themeLight')}</option>
              </select>
            </div>

            {/* Language */}
            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.language')}</p>
                <p className="setting-hint">{t('settings.languageHint')}</p>
              </div>
              <select
                className="select"
                value={currentSettings.language}
                onChange={(e) => handleLanguageChange(e.target.value as 'ja' | 'en')}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Notifications */}
            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.enableNotifications')}</p>
                <p className="setting-hint">{t('settings.enableNotificationsHint')}</p>
              </div>
              <button
                type="button"
                className={`toggle-switch ${currentSettings.notificationEnabled ? 'toggle-switch--active' : ''}`}
                onClick={() => update('notificationEnabled', !currentSettings.notificationEnabled)}
                role="switch"
                aria-checked={currentSettings.notificationEnabled}
              />
            </div>
          </div>

          {/* Section 2: Data */}
          <div className="premium-card settings-card">
            <h2 className="section-header">{t('settings.data')}</h2>

            {/* Export Data */}
            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.exportData')}</p>
                <p className="setting-hint">{t('settings.exportDataHint')}</p>
              </div>
              <button type="button" className="btn btn--primary">
                {t('settings.export')}
              </button>
            </div>
          </div>

          {/* Section 3: About */}
          <div className="premium-card settings-card">
            <h2 className="section-header">{t('settings.about')}</h2>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.version')}</p>
              </div>
              <span className="setting-value mono">{APP_VERSION}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Header component
function SettingsHeader({ title, version }: { title: string; version?: string }) {
  return (
    <header className="settings-header">
      <h1 className="settings-title">{title}</h1>
      {version && <span className="settings-version mono">v{version}</span>}
    </header>
  );
}
