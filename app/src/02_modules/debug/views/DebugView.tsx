// Pillar L: View - Debug tools for development
// Merged into 3 sections: System & Config, Logs, Dev Actions
import { useState, useEffect, useSyncExternalStore } from 'react';
import { useAuth, useEffectiveUserId } from '../../auth';
import { useSettings } from '../../settings/headless';
import { useQuota } from '../../capture/hooks/useQuotaState';
import { useTranslation } from '../../../i18n';
import { seedMockTransactions, getSeedScenarios, type SeedScenario } from '../../transaction/adapters/seedData';
import { resetTodayQuota } from '../../capture/adapters/imageDb';
import { clearAllData } from '../../../00_kernel/storage/db';
import { dlog, getLogs, clearLogs, subscribeLogs, setVerboseLogging, type LogEntry } from '../headless/debugLog';
import { emit } from '../../../00_kernel/eventBus';
import { setMockEnabled, subscribeMockMode, getMockSnapshot } from '../../../00_kernel/config/mock';
import type { UserId } from '../../../00_kernel/types';
import './debug.css';

// App version from package.json
const APP_VERSION = '0.1.0';

// Hook to subscribe to debug logs
function useLogs(): LogEntry[] {
  return useSyncExternalStore(subscribeLogs, getLogs, getLogs);
}

// Hook to subscribe to mock mode
function useMockMode(): boolean {
  return useSyncExternalStore(subscribeMockMode, getMockSnapshot, getMockSnapshot);
}

export function DebugView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { effectiveUserId, isLoading: userIdLoading } = useEffectiveUserId();
  const { state, update } = useSettings();
  const { quota } = useQuota();
  const logs = useLogs();
  const mockEnabled = useMockMode();

  // Seed data state
  const [seedScenario, setSeedScenario] = useState<SeedScenario>('default');
  const [actionStatus, setActionStatus] = useState<'idle' | 'running'>('idle');
  const [actionResult, setActionResult] = useState<string | null>(null);

  // Sync verbose logging setting with dlog module
  // Must be before early returns to maintain hooks order
  useEffect(() => {
    if (state.status === 'success') {
      setVerboseLogging(state.settings.debugEnabled);
    }
  }, [state]);

  // Handle loading state
  if (state.status === 'loading' || state.status === 'idle' || userIdLoading) {
    return (
      <div className="debug">
        <DebugHeader title={t('debug.title')} version={APP_VERSION} />
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

  const handleSeedData = async () => {
    if (!effectiveUserId) {
      setActionResult('No user ID');
      return;
    }

    setActionStatus('running');
    setActionResult(null);

    try {
      const result = await seedMockTransactions(effectiveUserId, seedScenario, true);
      dlog.info('Debug', 'Seed completed', result);
      setActionResult(result.seeded ? `Seeded ${result.count} items` : 'Skipped');
    } catch (e) {
      dlog.error('Debug', 'Seed failed', e);
      setActionResult('Error');
    }

    setActionStatus('idle');
  };

  const handleResetQuota = async () => {
    if (!effectiveUserId) {
      setActionResult('No user ID');
      return;
    }

    setActionStatus('running');
    setActionResult(null);

    try {
      const count = await resetTodayQuota(effectiveUserId as UserId);
      dlog.info('Debug', 'Quota reset', { count });
      setActionResult(count > 0 ? `Reset ${count} uploads` : 'No uploads today');
      // Emit event so quotaService can refresh
      emit('quota:reset', { count });
    } catch (e) {
      dlog.error('Debug', 'Quota reset failed', e);
      setActionResult('Error');
    }

    setActionStatus('idle');
  };

  const handleClearStorage = async () => {
    if (!confirm(t('debug.clearCacheConfirm'))) {
      return;
    }

    setActionStatus('running');
    setActionResult(null);

    try {
      dlog.info('Debug', 'Clearing all data...');
      const results = await clearAllData();
      const total = Object.values(results).reduce((a, b) => a + b, 0);
      dlog.info('Debug', 'Data cleared', results);
      setActionResult(`Cleared ${total} rows`);

      // Reload after short delay so user sees the result
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      dlog.error('Debug', 'Clear failed', e);
      setActionResult('Error: ' + String(e));
      setActionStatus('idle');
    }
  };

  return (
    <div className="debug">
      <DebugHeader title={t('debug.title')} version={APP_VERSION} />

      <div className="debug-content">
        <div className="debug-container">
          {/* Section 1: System & Config */}
          <div className="card card--settings">
            <h2 className="card--settings__header">{t('debug.systemInfo')}</h2>

            <div className="debug-grid">
              <div className="debug-grid-item">
                <span className="debug-label">User</span>
                <span className="debug-value mono">{user?.id || 'guest'}</span>
              </div>
              <div className="debug-grid-item">
                <span className="debug-label">Tier</span>
                <span className="debug-value">{user?.tier || 'free'}</span>
              </div>
              <div className="debug-grid-item">
                <span className="debug-label">Quota</span>
                <span className="debug-value mono">{quota.used} / {quota.limit}</span>
              </div>
              <div className="debug-grid-item">
                <span className="debug-label">Theme</span>
                <span className="debug-value">{currentSettings.theme}</span>
              </div>
              <div className="debug-grid-item">
                <span className="debug-label">Lang</span>
                <span className="debug-value">{currentSettings.language}</span>
              </div>
              <div className="debug-grid-item">
                <span className="debug-label">DB</span>
                <span className="debug-value mono">v3</span>
              </div>
            </div>
          </div>

          {/* Section 2: Dev Actions */}
          <div className="card card--settings">
            <h2 className="card--settings__header">{t('debug.devActions')}</h2>

            {/* Seed Data */}
            <div className="setting-row">
              <div className="setting-row__info" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                <p className="setting-row__label" style={{ margin: 0 }}>{t('debug.mockData')}</p>
                <select
                  className="select select--sm"
                  value={seedScenario}
                  onChange={(e) => setSeedScenario(e.target.value as SeedScenario)}
                  disabled={actionStatus === 'running'}
                >
                  {getSeedScenarios().map((scenario) => (
                    <option key={scenario} value={scenario}>{scenario}</option>
                  ))}
                </select>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={handleSeedData}
                  disabled={actionStatus === 'running' || !effectiveUserId}
                >
                  Seed
                </button>
              </div>
            </div>

            {/* Mock Mode Toggle */}
            <div className="setting-row">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('debug.mockMode')}</p>
                <p className="setting-row__hint">{t('debug.mockModeHint')}</p>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className={`toggle-switch toggle-switch--sm ${mockEnabled ? 'toggle-switch--active' : ''}`}
                  onClick={() => setMockEnabled(!mockEnabled)}
                  role="switch"
                  aria-checked={mockEnabled}
                />
              </div>
            </div>

            {/* Danger Actions */}
            <div className="setting-row setting-row--danger">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('debug.resetQuota')}</p>
                <p className="setting-row__hint">{t('debug.resetQuotaHint')}</p>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className="btn btn--warning btn--sm"
                  onClick={handleResetQuota}
                  disabled={actionStatus === 'running' || !effectiveUserId}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="setting-row setting-row--danger">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('debug.clearLocalStorage')}</p>
                <p className="setting-row__hint">{t('settings.clearCacheHint')}</p>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={handleClearStorage}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Action Result */}
            {actionResult && (
              <div className="debug-action-result">
                {actionResult}
              </div>
            )}
          </div>

          {/* Section 3: Logs */}
          <div className="card card--settings">
            <div className="debug-logs-header">
              <h2 className="card--settings__header">Logs</h2>
              <div className="debug-logs-controls">
                <label className="debug-verbose-toggle">
                  <span className="debug-verbose-label">Verbose</span>
                  <button
                    type="button"
                    className={`toggle-switch toggle-switch--sm ${currentSettings.debugEnabled ? 'toggle-switch--active' : ''}`}
                    onClick={() => update('debugEnabled', !currentSettings.debugEnabled)}
                    role="switch"
                    aria-checked={currentSettings.debugEnabled}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={clearLogs}
                  disabled={logs.length === 0}
                >
                  Clear
                </button>
              </div>
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
                    {log.data !== undefined && (
                      <span className="debug-log-data">
                        {String(typeof log.data === 'object' ? JSON.stringify(log.data) : log.data)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Header component
function DebugHeader({ title, version }: { title: string; version?: string }) {
  return (
    <header className="debug-header">
      <h1 className="debug-title">{title}</h1>
      {version && <span className="debug-version mono">v{version}</span>}
    </header>
  );
}
