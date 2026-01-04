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

  const handleLogout = async () => {
    if (confirm(t('settings.logoutConfirm'))) {
      await logout();
    }
  };

  return (
    <div className="settings">
      <SettingsHeader title={t('settings.title')} version={APP_VERSION} />

      <div className="settings-content">
        <div className="settings-container">
          {/* Appearance Section */}
          <div className="premium-card settings-card">
            <h2 className="section-header">{t('settings.appearance')}</h2>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.theme')}</p>
                <p className="setting-hint">{t('settings.themeHint')}</p>
              </div>
              <select
                className="setting-select"
                value={currentSettings.theme}
                onChange={(e) => update('theme', e.target.value as 'light' | 'dark')}
              >
                <option value="dark">{t('settings.themeDark')}</option>
                <option value="light">{t('settings.themeLight')}</option>
              </select>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.language')}</p>
                <p className="setting-hint">{t('settings.languageHint')}</p>
              </div>
              <select
                className="setting-select"
                value={currentSettings.language}
                onChange={(e) => handleLanguageChange(e.target.value as 'ja' | 'en')}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="premium-card settings-card">
            <h2 className="section-header">{t('settings.notifications')}</h2>

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

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.dailyReport')}</p>
                <p className="setting-hint">{t('settings.dailyReportHint')}</p>
              </div>
              <button
                type="button"
                className={`toggle-switch ${currentSettings.notificationEnabled ? 'toggle-switch--active' : ''}`}
                onClick={() => {}}
                role="switch"
                aria-checked={currentSettings.notificationEnabled}
                disabled
              />
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.quotaAlert')}</p>
                <p className="setting-hint">{t('settings.quotaAlertHint')}</p>
              </div>
              <button
                type="button"
                className={`toggle-switch ${currentSettings.notificationEnabled ? 'toggle-switch--active' : ''}`}
                onClick={() => {}}
                role="switch"
                aria-checked={currentSettings.notificationEnabled}
                disabled
              />
            </div>
          </div>

          {/* Account Section */}
          <div className="premium-card settings-card">
            <h2 className="section-header">{t('settings.account')}</h2>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{user?.email || t('auth.guest')}</p>
                <p className="setting-hint">
                  {user?.tier || 'Free'} {t('settings.plan')} • 30 images/day
                </p>
              </div>
              <button className="btn-action btn-action--dark" onClick={handleLogout}>
                {t('settings.logout')}
              </button>
            </div>
          </div>

          {/* Guest Mode Warning */}
          {!user?.email && (
            <div className="guest-warning">
              <div className="guest-warning__icon">👤</div>
              <div className="guest-warning__content">
                <p className="guest-warning__title">{t('auth.guestMode')}</p>
                <p className="guest-warning__text">{t('auth.guestWarning')}</p>
                <div className="guest-warning__actions">
                  <button className="btn-action btn-action--warning">{t('auth.registerNow')}</button>
                  <button className="btn-action btn-action--ghost">{t('auth.login')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Data Section */}
          <div className="premium-card settings-card">
            <h2 className="section-header">{t('settings.data')}</h2>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.clearCache')}</p>
                <p className="setting-hint">{t('settings.clearCacheHint')}</p>
              </div>
              <button className="btn-action btn-action--danger">
                {t('settings.clear')}
              </button>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.exportData')}</p>
                <p className="setting-hint">{t('settings.exportDataHint')}</p>
              </div>
              <button className="btn-action btn-action--primary">
                {t('settings.export')}
              </button>
            </div>
          </div>

          {/* About Section */}
          <div className="premium-card settings-card">
            <h2 className="section-header">{t('settings.about')}</h2>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.version')}</p>
              </div>
              <span className="setting-value mono">{APP_VERSION}</span>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.licenses')}</p>
                <p className="setting-hint">{t('settings.licensesHint')}</p>
              </div>
              <a href="#" className="setting-link">{t('settings.view')} →</a>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <p className="setting-label">{t('settings.feedback')}</p>
                <p className="setting-hint">{t('settings.feedbackHint')}</p>
              </div>
              <a href="https://github.com" className="setting-link">GitHub →</a>
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
