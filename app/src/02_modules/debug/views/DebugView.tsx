// Pillar L: View - Debug tools for development
// Follows same patterns as SettingsView for consistency
import { useState, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../../auth';
import { useSettings } from '../../settings/headless';
import { useTranslation } from '../../../i18n';
import { seedMockTransactions, getSeedScenarios, type SeedScenario } from '../../transaction/adapters/seedData';
import { dlog, getLogs, clearLogs, subscribeLogs, type LogEntry } from '../headless/debugLog';
import './debug.css';

// App version from package.json
const APP_VERSION = '0.1.0';

// Hook to subscribe to debug logs
function useLogs(): LogEntry[] {
  return useSyncExternalStore(subscribeLogs, getLogs, getLogs);
}

export function DebugView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { state, update } = useSettings();
  const logs = useLogs();

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
    const TAG = 'DebugUI';
    dlog.info(TAG, 'Seed button clicked', { userId: user?.id, scenario: seedScenario });

    if (!user?.id) {
      dlog.error(TAG, 'No user ID available');
      setSeedResult('No user ID available');
      return;
    }

    setSeedStatus('seeding');
    setSeedResult(null);

    try {
      const result = await seedMockTransactions(user.id, seedScenario, force);
      dlog.info(TAG, 'Seed result', result);

      if (result.seeded) {
        setSeedResult(t('debug.seedSuccess', { count: result.count }));
      } else {
        setSeedResult(t('debug.seedSkipped'));
      }
    } catch (e) {
      dlog.error(TAG, 'Seed failed', e);
      setSeedResult(t('debug.seedError'));
    }

    setSeedStatus('done');
  };

  return (
    <div className="debug">
      <DebugHeader title={t('debug.title')} version={APP_VERSION} />

      <div className="debug-content">
        <div className="debug-container">
          {/* System Info */}
          <div className="premium-card debug-card">
            <h2 className="section-header">{t('debug.systemInfo')}</h2>
            <div className="debug-info-panel">
              <div className="debug-info-row">
                <span className="debug-info-label">User ID</span>
                <span className="debug-info-value">{user?.id || 'guest'}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">Email</span>
                <span className="debug-info-value">{user?.email || 'N/A'}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">Tier</span>
                <span className="debug-info-value">{user?.tier || 'free'}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">Theme</span>
                <span className="debug-info-value">{currentSettings.theme}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">Language</span>
                <span className="debug-info-value">{currentSettings.language}</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">DB Version</span>
                <span className="debug-info-value">3</span>
              </div>
              <div className="debug-info-row">
                <span className="debug-info-label">App Version</span>
                <span className="debug-info-value">{APP_VERSION}</span>
              </div>
            </div>
          </div>

          {/* Debug Logs */}
          <div className="premium-card debug-card">
            <div className="debug-logs-header">
              <h2 className="section-header">Logs</h2>
              <button
                type="button"
                className="btn-action btn-action--ghost"
                onClick={clearLogs}
                disabled={logs.length === 0}
              >
                Clear
              </button>
            </div>
            <div className="debug-logs-panel">
              {logs.length === 0 ? (
                <div className="debug-logs-empty">No logs yet</div>
              ) : (
                logs.slice().reverse().map((log, i) => (
                  <div key={i} className={`debug-log-entry debug-log-entry--${log.level}`}>
                    <span className="debug-log-time">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="debug-log-tag">[{log.tag}]</span>
                    <span className="debug-log-msg">{log.message}</span>
                    {log.data && (
                      <span className="debug-log-data">
                        {typeof log.data === 'object' ? JSON.stringify(log.data) : String(log.data)}
                      </span>
                    )}
                  </div>
                ))
              )}
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
                  className="btn-action btn-action--primary"
                  onClick={() => handleSeedData(true)}
                  disabled={seedStatus === 'seeding' || !user?.id}
                >
                  {seedStatus === 'seeding' ? t('common.loading') : t('debug.seed')}
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

            <div className="debug-setting-row">
              <div className="debug-setting-info">
                <p className="debug-setting-label">{t('debug.verboseLogging')}</p>
                <p className="debug-setting-hint">{t('debug.verboseLoggingHint')}</p>
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

            <div className="danger-section">
              <div className="danger-row">
                <div className="danger-info">
                  <p className="danger-label">{t('debug.clearLocalStorage')}</p>
                  <p className="danger-hint">{t('settings.clearCacheHint')}</p>
                </div>
                <button
                  type="button"
                  className="btn-action btn-action--danger"
                  onClick={() => {
                    if (confirm(t('debug.clearCacheConfirm'))) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                >
                  {t('settings.clear')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Header component - matches SettingsHeader pattern
function DebugHeader({ title, version }: { title: string; version?: string }) {
  return (
    <header className="debug-header">
      <h1 className="debug-title">{title}</h1>
      {version && <span className="debug-version mono">v{version}</span>}
    </header>
  );
}
