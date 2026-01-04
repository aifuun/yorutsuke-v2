// Pillar L: View - Debug tools for development
import { useState } from 'react';
import { useAuth } from '../../auth';
import { useSettings } from '../../settings/headless';
import { useTranslation } from '../../../i18n';
import { seedMockTransactions, getSeedScenarios, type SeedScenario } from '../../transaction/adapters/seedData';
import './debug.css';

export function DebugView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { state, update } = useSettings();

  // Seed data state
  const [seedScenario, setSeedScenario] = useState<SeedScenario>('default');
  const [seedStatus, setSeedStatus] = useState<'idle' | 'seeding' | 'done'>('idle');
  const [seedResult, setSeedResult] = useState<string | null>(null);

  // Handle loading state
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="debug">
        <DebugHeader title={t('debug.title')} />
        <div className="debug-content">
          <div className="debug-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="debug">
        <DebugHeader title={t('debug.title')} />
        <div className="debug-content">
          <div className="debug-error">{t('common.error')}</div>
        </div>
      </div>
    );
  }

  const currentSettings = state.settings;

  const handleSeedData = async (force: boolean) => {
    console.log('[seedData] Starting seed, user:', user);
    if (!user?.id) {
      console.log('[seedData] No user ID, aborting');
      setSeedResult('No user ID available');
      return;
    }
    setSeedStatus('seeding');
    setSeedResult(null);
    try {
      console.log('[seedData] Calling seedMockTransactions with:', user.id, seedScenario, force);
      const result = await seedMockTransactions(user.id, seedScenario, force);
      console.log('[seedData] Result:', result);
      if (result.seeded) {
        setSeedResult(t('debug.seedSuccess', { count: result.count }));
      } else {
        setSeedResult(t('debug.seedSkipped'));
      }
    } catch (e) {
      console.error('[seedData] Error:', e);
      setSeedResult(t('debug.seedError'));
    }
    setSeedStatus('done');
  };

  return (
    <div className="debug">
      <DebugHeader title={t('debug.title')} />

      <div className="debug-content">
        <div className="debug-container">
          {/* System Info */}
          <div className="premium-card debug-card">
            <h2 className="section-header">{t('debug.systemInfo')}</h2>
            <div className="debug-info-panel">
              <div className="debug-info-row">
                <span className="debug-info-label">User ID</span>
                <span className="debug-info-value mono">{user?.id || 'guest'}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">Email</span>
                <span className="debug-info-value mono">{user?.email || 'N/A'}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">Tier</span>
                <span className="debug-info-value mono">{user?.tier || 'free'}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">Theme</span>
                <span className="debug-info-value mono">{currentSettings.theme}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">Language</span>
                <span className="debug-info-value mono">{currentSettings.language}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">DB Version</span>
                <span className="debug-info-value mono">3</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">App Version</span>
                <span className="debug-info-value mono">0.1.0</span>
              </div>
            </div>
          </div>

          {/* Mock Data */}
          <div className="premium-card debug-card">
            <h2 className="section-header">{t('debug.mockData')}</h2>
            <p className="debug-hint">{t('debug.mockDataHint')}</p>

            <div className="seed-section">
              <div className="seed-row">
                <label className="seed-label">{t('debug.scenario')}</label>
                <select
                  className="seed-select"
                  value={seedScenario}
                  onChange={(e) => setSeedScenario(e.target.value as SeedScenario)}
                  disabled={seedStatus === 'seeding'}
                >
                  {getSeedScenarios().map((scenario) => (
                    <option key={scenario} value={scenario}>
                      {scenario}
                    </option>
                  ))}
                </select>
              </div>

              <div className="seed-actions">
                <button
                  type="button"
                  className="btn-debug btn-debug--primary"
                  onClick={() => handleSeedData(false)}
                  disabled={seedStatus === 'seeding' || !user?.id}
                >
                  {seedStatus === 'seeding' ? t('common.loading') : t('debug.seed')}
                </button>
                <button
                  type="button"
                  className="btn-debug btn-debug--danger"
                  onClick={() => handleSeedData(true)}
                  disabled={seedStatus === 'seeding' || !user?.id}
                  title={t('debug.seedForceHint')}
                >
                  {t('debug.seedForce')}
                </button>
              </div>

              {seedResult && (
                <div className="seed-result">
                  <span className="seed-result-text">{seedResult}</span>
                </div>
              )}
            </div>
          </div>

          {/* Feature Flags */}
          <div className="premium-card debug-card">
            <h2 className="section-header">{t('debug.featureFlags')}</h2>

            <div className="flag-row">
              <div className="flag-info">
                <p className="flag-label">{t('debug.verboseLogging')}</p>
                <p className="flag-hint">{t('debug.verboseLoggingHint')}</p>
              </div>
              <button
                type="button"
                className={`toggle-switch ${currentSettings.debugEnabled ? 'toggle-switch--active' : ''}`}
                onClick={() => update('debugEnabled', !currentSettings.debugEnabled)}
                role="switch"
                aria-checked={currentSettings.debugEnabled}
              />
            </div>
          </div>

          {/* Danger Zone */}
          <div className="premium-card debug-card debug-card--danger">
            <h2 className="section-header">{t('debug.dangerZone')}</h2>
            <p className="debug-hint">{t('debug.dangerZoneHint')}</p>

            <div className="danger-actions">
              <button
                type="button"
                className="btn-debug btn-debug--danger"
                onClick={() => {
                  if (confirm(t('debug.clearCacheConfirm'))) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
              >
                {t('debug.clearLocalStorage')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Header component
function DebugHeader({ title }: { title: string }) {
  return (
    <header className="debug-header">
      <div className="debug-header-icon">🔧</div>
      <h1 className="debug-title">{title}</h1>
    </header>
  );
}
