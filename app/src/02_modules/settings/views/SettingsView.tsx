// Pillar L: View - renders data from headless hook
import { useSettings } from '../headless';
import { useTranslation, changeLanguage } from '../../../i18n';
import { ViewHeader } from '../../../components';
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
        <ViewHeader title={t('settings.title')} />
        <div className="settings-content">
          <div className="settings-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="settings">
        <ViewHeader title={t('settings.title')} />
        <div className="settings-content">
          <div className="settings-error">{t('common.error')}</div>
        </div>
      </div>
    );
  }

  // After FSM checks, settings is guaranteed non-null
  const currentSettings = state.settings;

  const handleLanguageChange = (lang: 'ja' | 'en' | 'zh') => {
    changeLanguage(lang);
    update('language', lang);
  };

  return (
    <div className="settings">
      <ViewHeader 
        title={t('settings.title')} 
        rightContent={<VersionBadge version={APP_VERSION} />}
      />

      <div className="settings-content">
        <div className="settings-container">
          {/* Section 1: General */}
          <div className="card card--settings">
            <h2 className="section-header">{t('settings.preferences')}</h2>

            {/* Language */}
            <div className="setting-row">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('settings.language')}</p>
                <p className="setting-row__hint">{t('settings.languageHint')}</p>
              </div>
              <div className="setting-row__control">
                <select
                  className="select"
                  value={currentSettings.language}
                  onChange={(e) => handleLanguageChange(e.target.value as 'ja' | 'en' | 'zh')}
                >
                  <option value="en">English</option>
                  <option value="zh">简体中文</option>
                  <option value="ja">日本語</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Data */}
          <div className="card card--settings">
            <h2 className="section-header">{t('settings.data')}</h2>

            {/* Export Data */}
            <div className="setting-row">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('settings.exportData')}</p>
                <p className="setting-row__hint">{t('settings.exportDataHint')}</p>
              </div>
              <div className="setting-row__control">
                <button type="button" className="btn btn--primary btn--sm">
                  {t('settings.export')}
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: About */}
          <div className="card card--settings">
            <h2 className="section-header">{t('settings.about')}</h2>

            <div className="setting-row">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('settings.version')}</p>
              </div>
              <div className="setting-row__control">
                <span className="setting-row__value mono">{APP_VERSION}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Version badge component
function VersionBadge({ version }: { version: string }) {
  return <span className="settings-version mono">v{version}</span>;
}
