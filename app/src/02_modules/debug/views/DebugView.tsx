// Pillar L: View - Debug tools for development
// 3 sections: Dev Actions, System & Config, Logs
import { useState, useEffect, useSyncExternalStore } from 'react';
import { useAuth, useEffectiveUserId } from '../../auth';
import { useSettings } from '../../settings/headless';
import { useQuota } from '../../capture/hooks/useQuotaState';
import { useTranslation } from '../../../i18n';
import { ViewHeader } from '../../../components';
import { seedMockTransactions, getSeedScenarios, type SeedScenario } from '../../transaction';
import { resetTodayQuota } from '../../capture';
import { clearBusinessData, clearSettings } from '../../../00_kernel/storage/db';
import { getLogs, clearLogs, subscribeLogs, setVerboseLogging, type LogEntry } from '../headless';
import { emit } from '../../../00_kernel/eventBus';
import { ask } from '@tauri-apps/plugin-dialog';
import { setMockMode, subscribeMockMode, getMockSnapshot, isSlowUpload, setSlowUpload, type MockMode } from '../../../00_kernel/config/mock';
import { captureService } from '../../capture/services/captureService';
import { captureStore } from '../../capture/stores/captureStore';
import { uploadStore } from '../../capture/stores/uploadStore';
import type { UserId } from '../../../00_kernel/types';
import { deleteUserData } from '../adapters';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './debug.css';

// App version from package.json
const APP_VERSION = '0.1.0';

// Hook to subscribe to debug logs
function useLogs(): LogEntry[] {
  return useSyncExternalStore(subscribeLogs, getLogs, getLogs);
}

// Hook to subscribe to mock mode
function useMockMode(): MockMode {
  return useSyncExternalStore(subscribeMockMode, getMockSnapshot, getMockSnapshot);
}

export function DebugView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { effectiveUserId, isLoading: userIdLoading } = useEffectiveUserId();
  const { state, update } = useSettings();
  const { quota } = useQuota();
  const logs = useLogs();
  const mockMode = useMockMode();

  // Seed data state
  const [seedScenario, setSeedScenario] = useState<SeedScenario>('default');
  const [actionStatus, setActionStatus] = useState<'idle' | 'running'>('idle');
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [slowUpload, setSlowUploadState] = useState(isSlowUpload);

  // Clear cloud data state
  const [showClearCloudDialog, setShowClearCloudDialog] = useState(false);

  // Sync verbose logging setting with dlog module
  // Must be before early returns to maintain hooks order
  useEffect(() => {
    if (state.status === 'success') {
      setVerboseLogging(state.settings.debugEnabled);
    }
  }, [state]);

  // Sync slow upload state after DB load (race condition fix)
  useEffect(() => {
    setSlowUploadState(isSlowUpload());
  }, []);

  // Handle loading state
  if (state.status === 'loading' || state.status === 'idle' || userIdLoading) {
    return (
      <div className="debug">
        <ViewHeader title={t('debug.title')} rightContent={<VersionBadge version={APP_VERSION} />} />
        <div className="debug-content">
          <div className="debug-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="debug">
        <ViewHeader title={t('debug.title')} />
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
      setActionResult(result.seeded ? `Seeded ${result.count} items` : 'Skipped');

      // Emit event to refresh transaction views
      if (result.seeded && result.count > 0) {
        emit('data:refresh', { source: 'seed' });
      }
    } catch (e) {
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
      setActionResult(count > 0 ? `Reset ${count} uploads` : 'No uploads today');
      // Emit event so quotaService can refresh
      emit('quota:reset', { count });
    } catch (e) {
      setActionResult('Error');
    }

    setActionStatus('idle');
  };

  const handleClearBusinessData = async () => {
    const confirmed = await ask(t('debug.clearBusinessDataConfirm'), {
      title: 'Clear Business Data',
      kind: 'warning',
    });

    if (!confirmed) {
      return;
    }

    setActionStatus('running');
    setActionResult('Clearing data...');

    try {
      // 1. Stop background services to prevent race conditions
      captureService.destroy();

      // 2. Clear DB business tables (preserves settings)
      const results = await clearBusinessData();

      // 3. Clear memory stores
      captureStore.getState().clearQueue();
      uploadStore.getState().clearTasks();

      const total = Object.values(results).reduce((a, b) => a + b, 0);
      setActionResult(`Cleared ${total} rows. Restarting...`);

      // 4. Reload to reinitialize
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      setActionResult('Error: ' + String(e));
      setActionStatus('idle');
      captureService.init();
    }
  };

  const handleClearSettings = async () => {
    const confirmed = await ask(t('debug.clearSettingsConfirm'), {
      title: 'Clear Settings',
      kind: 'warning',
    });

    if (!confirmed) {
      return;
    }

    setActionStatus('running');
    setActionResult('Clearing settings...');

    try {
      const count = await clearSettings();
      setActionResult(`Cleared ${count} settings. Restarting...`);

      // Reload to apply default settings
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      setActionResult('Error: ' + String(e));
      setActionStatus('idle');
    }
  };

  const handleSlowUploadToggle = () => {
    const newValue = !slowUpload;
    setSlowUploadState(newValue);
    setSlowUpload(newValue);
  };

  const handleOpenClearCloudDialog = () => {
    if (!effectiveUserId) {
      setActionResult('No user ID');
      return;
    }
    setShowClearCloudDialog(true);
  };

  const handleConfirmClearCloud = async () => {
    if (!effectiveUserId) {
      setActionResult('No user ID');
      return;
    }

    setShowClearCloudDialog(false);
    setActionStatus('running');
    setActionResult('Deleting cloud data...');

    try {
      const result = await deleteUserData(effectiveUserId as UserId, ['transactions', 'images']);
      setActionResult(
        `Deleted ${result.deleted.transactions || 0} transactions and ${result.deleted.images || 0} images from cloud`
      );
    } catch (e) {
      setActionResult('Error: ' + String(e));
    }

    setActionStatus('idle');
  };

  const handleCancelClearCloud = () => {
    setShowClearCloudDialog(false);
  };

  return (
    <div className="debug">
      <ViewHeader title={t('debug.title')} rightContent={<VersionBadge version={APP_VERSION} />} />

      <div className="debug-content">
        <div className="debug-container">
          {/* Section 1: Dev Actions */}
          <div className="card card--settings">
            <h2 className="section-header">{t('debug.devActions')}</h2>

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

            {/* Mock Mode Dropdown */}
            <div className="setting-row">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('debug.mockMode')}</p>
                <p className="setting-row__hint">{t('debug.mockModeHint')}</p>
              </div>
              <div className="setting-row__control">
                <select
                  className="select select--sm"
                  value={mockMode}
                  onChange={(e) => setMockMode(e.target.value as MockMode)}
                >
                  <option value="off">{t('debug.mockOff')}</option>
                  <option value="online">{t('debug.mockOnline')}</option>
                  <option value="offline">{t('debug.mockOffline')}</option>
                </select>
              </div>
            </div>

            {/* Slow Upload Toggle (for SC-503 testing) */}
            <div className="setting-row">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('debug.slowUpload')}</p>
                <p className="setting-row__hint">{t('debug.slowUploadHint')}</p>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className={`toggle-switch toggle-switch--sm ${slowUpload ? 'toggle-switch--active' : ''}`}
                  onClick={handleSlowUploadToggle}
                  role="switch"
                  aria-checked={slowUpload}
                  disabled={mockMode === 'off'}
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
                <p className="setting-row__label">{t('debug.clearBusinessData')}</p>
                <p className="setting-row__hint">{t('debug.clearBusinessDataHint')}</p>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={handleClearBusinessData}
                  disabled={actionStatus === 'running'}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="setting-row setting-row--danger">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('debug.clearCloudData')}</p>
                <p className="setting-row__hint">{t('debug.clearCloudDataHint')}</p>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={handleOpenClearCloudDialog}
                  disabled={actionStatus === 'running' || !effectiveUserId}
                >
                  {t('debug.clearCloudDataButton')}
                </button>
              </div>
            </div>

            <div className="setting-row setting-row--danger">
              <div className="setting-row__info">
                <p className="setting-row__label">{t('debug.clearSettings')}</p>
                <p className="setting-row__hint">{t('debug.clearSettingsHint')}</p>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className="btn btn--warning btn--sm"
                  onClick={handleClearSettings}
                  disabled={actionStatus === 'running'}
                >
                  Reset
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

          {/* Section 2: System & Config */}
          <div className="card card--settings">
            <h2 className="section-header">{t('debug.systemInfo')}</h2>

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

          {/* Section 3: Logs */}
          <div className="card card--settings">
            <div className="debug-logs-header">
              <h2 className="section-header">Logs</h2>
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

      {/* Clear Cloud Data Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearCloudDialog}
        title={t('debug.clearCloudDataConfirmTitle')}
        message={t('debug.clearCloudDataConfirmMessage')}
        checkboxLabel={t('debug.clearCloudDataConfirmCheckbox')}
        confirmText={t('debug.clearCloudDataButton')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={handleConfirmClearCloud}
        onCancel={handleCancelClearCloud}
      />
    </div>
  );
}

// Version badge component
function VersionBadge({ version }: { version: string }) {
  return <span className="debug-version mono">v{version}</span>;
}
