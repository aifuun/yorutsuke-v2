// Pillar L: View - Debug tools for development
// Reorganized layout: Mock & Data Mode | Seed Data | System Info | Danger Zone | Logs
// Migrated to use authStateService and settingsStateService (Issue #141)
import { useState, useEffect, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { authStateService, useEffectiveUserId } from '../../auth';
import { settingsStateService } from '../../settings';
import { useQuota } from '../../capture/hooks/useQuotaState';
import { useTranslation } from '../../../i18n';
import { ViewHeader, AddButton, DeleteButton, SyncButton } from '../../../components';
import { seedMockTransactions, getSeedScenarios, type SeedScenario } from '../../transaction';
import { resetTodayQuota, getImageStats } from '../../capture';
import { clearBusinessData, clearSettings } from '../../../00_kernel/storage/db';
import { getLogs, clearLogs, subscribeLogs, setVerboseLogging, type LogEntry } from '../headless';
import { emit } from '../../../00_kernel/eventBus';
import { logger } from '../../../00_kernel/telemetry';
import { ask } from '@tauri-apps/plugin-dialog';
import { setMockMode, subscribeMockMode, getMockSnapshot, isSlowUpload, setSlowUpload, type MockMode } from '../../../00_kernel/config/mock';
import { captureService } from '../../capture/services/captureService';
import { quotaService } from '../../capture/services/quotaService';
import { captureStore } from '../../capture/stores/captureStore';
import { uploadStore } from '../../capture/stores/uploadStore';
import { autoSyncService } from '../../sync/services/autoSyncService';
import type { UserId } from '../../../00_kernel/types';
import { deleteUserData } from '../adapters';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Transaction } from '../../../01_domains/transaction';
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

  // Subscribe to auth state (primitive selector to avoid infinite loops)
  const user = useStore(authStateService.store, s => s.user);

  const { effectiveUserId, isLoading: userIdLoading } = useEffectiveUserId();

  // Subscribe to settings state
  const settingsState = useStore(settingsStateService.store);

  const { quota } = useQuota();
  const logs = useLogs();
  const mockMode = useMockMode();

  // Seed data state
  const [seedScenario, setSeedScenario] = useState<SeedScenario>('default');
  const [actionStatus, setActionStatus] = useState<'idle' | 'running'>('idle');
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [slowUpload, setSlowUploadState] = useState(isSlowUpload);

  // Clear all data (local + cloud) state
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  // Latest cloud transactions state
  const [latestCloudTransactions, setLatestCloudTransactions] = useState<Transaction[]>([]);
  const [cloudTxLoading, setCloudTxLoading] = useState(false);

  // Sync verbose logging setting with dlog module
  // Must be before early returns to maintain hooks order
  useEffect(() => {
    if (settingsState.status === 'success') {
      setVerboseLogging(settingsState.settings.debugEnabled);
    }
  }, [settingsState]);

  // Sync slow upload state after DB load (race condition fix)
  useEffect(() => {
    setSlowUploadState(isSlowUpload());
  }, []);

  // Handle loading state
  if (settingsState.status === 'loading' || settingsState.status === 'idle' || userIdLoading) {
    return (
      <div className="debug">
        <ViewHeader title={t('debug.title')} rightContent={<VersionBadge version={APP_VERSION} />} />
        <div className="debug-content">
          <div className="debug-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (settingsState.status === 'error') {
    return (
      <div className="debug">
        <ViewHeader title={t('debug.title')} />
        <div className="debug-content">
          <div className="debug-error">{t('common.error')}</div>
        </div>
      </div>
    );
  }

  const currentSettings = settingsState.settings;

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
      setActionResult(`Error: ${String(e)}`);
    } finally {
      setActionStatus('idle');
    }
  };

  const handleDiagnoseQuota = async () => {
    if (!effectiveUserId) {
      setActionResult('No user ID');
      return;
    }

    setActionStatus('running');
    setActionResult('Diagnosing...');

    try {
      const stats = await getImageStats(effectiveUserId as UserId);
      const statusList = Object.entries(stats.byStatus)
        .map(([status, count]) => `${status}:${count}`)
        .join(', ');

      const recentInfo = stats.recentUploads
        .map((img, idx) => `\n  ${idx + 1}. ${img.id.slice(0, 8)} | ${img.status} | uploaded_at: ${img.uploaded_at || 'NULL'}`)
        .join('');

      const mockMode = getMockSnapshot();
      const mockStatus = mockMode === 'off' ? 'Real API' : mockMode === 'online' ? 'Mock Online' : 'Mock Offline';

      setActionResult(
        `📊 Database Stats:\n` +
        `Total images: ${stats.total}\n` +
        `By status: ${statusList || '(empty)'}\n` +
        `Uploaded (all time): ${stats.uploadedAll}\n` +
        `Uploaded (last 24h): ${stats.uploadedLast24h}\n` +
        `\n🔍 Recent 10 images:${recentInfo || '\n  (none)'}\n` +
        `\n💡 Current quota display: ${quota.totalUsed}/${quota.totalLimit}\n` +
        `🔌 Mock mode: ${mockStatus}`
      );
    } catch (e) {
      setActionResult(`Error: ${String(e)}`);
    } finally {
      setActionStatus('idle');
    }
  };

  const handleRefreshQuota = async () => {
    if (!effectiveUserId) {
      setActionResult('No user ID');
      return;
    }

    setActionStatus('running');
    setActionResult('Refreshing permit...');

    try {
      // Note: quotaService.refreshPermit() is private, use setUser to trigger refresh
      await quotaService.setUser(effectiveUserId);
      setActionResult(`✅ Permit refreshed: ${quota.totalUsed}/${quota.totalLimit}`);
    } catch (e) {
      setActionResult(`Error: ${String(e)}`);
    } finally {
      setActionStatus('idle');
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

  const handleOpenClearAllDialog = () => {
    if (!effectiveUserId) {
      setActionResult('No user ID');
      return;
    }
    setShowClearAllDialog(true);
  };

  const handleConfirmClearAll = async () => {
    if (!effectiveUserId) {
      setActionResult('No user ID');
      return;
    }

    setShowClearAllDialog(false);
    setActionStatus('running');
    setActionResult('Clearing all data...');

    try {
      // Stop background services to prevent race conditions
      // CRITICAL: Stop autoSyncService BEFORE deleting cloud data
      // This prevents it from pulling deleted data back into local DB during the clear operation
      logger.info('debug_clear_data_stopping_services');
      captureService.destroy();
      autoSyncService.stop();  // Stop sync loop but keep service initialized

      // Step 1: Delete from cloud (now safe - no auto-sync interference)
      logger.info('debug_clear_data_deleting_cloud');
      const cloudResult = await deleteUserData(effectiveUserId as UserId, ['transactions', 'images']);

      // Step 2: Clear local database
      logger.info('debug_clear_data_clearing_local_db');
      const localResults = await clearBusinessData();

      // Step 3: Clear memory stores
      captureStore.getState().clearQueue();
      uploadStore.getState().clearTasks();

      const localCleared = Object.values(localResults).reduce((a, b) => a + b, 0);

      logger.info('debug_clear_data_success', {
        cloudTransactions: cloudResult.deleted.transactions || 0,
        cloudImages: cloudResult.deleted.images || 0,
        localRows: localCleared,
      });

      setActionResult(
        `Deleted ${cloudResult.deleted.transactions || 0} transactions and ${cloudResult.deleted.images || 0} from cloud, ` +
        `cleared ${localCleared} local rows. Restarting...`
      );

      // Step 4: Reload to reinitialize (autoSyncService will restart via setUser on app init)
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      logger.error('debug_clear_data_error', { error: String(e) });
      setActionResult('Error: ' + String(e));
      setActionStatus('idle');
      // Re-initialize services on error
      captureService.init();
      autoSyncService.start();  // Restart the sync loop
    }
  };

  const handleCancelClearAll = () => {
    setShowClearAllDialog(false);
  };

  const handleFetchLatestCloudTransactions = async () => {
    if (!effectiveUserId) {
      setActionResult('No user ID');
      return;
    }

    setCloudTxLoading(true);
    setActionResult(null);

    try {
      // Import the function to fetch from cloud directly
      const { fetchTransactionsFromCloud } = await import('../../transaction/adapters');
      
      const cloudTxs = await fetchTransactionsFromCloud(effectiveUserId as UserId);
      
      // Sort by updatedAt descending and take last 3
      const sorted = [...cloudTxs]
        .sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return dateB - dateA;
        })
        .slice(0, 3);
      
      setLatestCloudTransactions(sorted);
      setActionResult(`Fetched ${sorted.length} latest transactions from cloud`);
    } catch (e) {
      setActionResult('Error: ' + String(e));
      setLatestCloudTransactions([]);
    }

    setCloudTxLoading(false);
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
                <AddButton
                  size="sm"
                  onClick={handleSeedData}
                  disabled={actionStatus === 'running' || !effectiveUserId}
                >
                  Seed
                </AddButton>
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
            <div className="setting-row">
              <div className="setting-row__info">
                <p className="setting-row__label">Diagnose Quota</p>
                <p className="setting-row__hint">Show database stats and quota details</p>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleDiagnoseQuota}
                  disabled={actionStatus === 'running' || !effectiveUserId}
                >
                  Diagnose
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-row__info">
                <p className="setting-row__label">Refresh Quota</p>
                <p className="setting-row__hint">Force refresh quota from API/database</p>
              </div>
              <div className="setting-row__control">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleRefreshQuota}
                  disabled={actionStatus === 'running' || !effectiveUserId}
                >
                  Refresh
                </button>
              </div>
            </div>

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
                <p className="setting-row__label">{t('debug.clearMyData')}</p>
                <p className="setting-row__hint">{t('debug.clearMyDataHint')}</p>
              </div>
              <div className="setting-row__control">
                <DeleteButton
                  size="sm"
                  onClick={handleOpenClearAllDialog}
                  disabled={actionStatus === 'running' || !effectiveUserId}
                >
                  {t('debug.clearMyDataButton')}
                </DeleteButton>
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
                <span className="debug-value mono">{quota.totalUsed} / {quota.totalLimit}</span>
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

          {/* Section 2.5: Latest Cloud Transactions */}
          <div className="card card--settings">
            <div className="setting-row" style={{ marginBottom: '12px' }}>
              <div className="setting-row__info">
                <p className="setting-row__label">Latest Cloud Transactions</p>
                <p className="setting-row__hint">Fetch last 3 updated transactions from cloud</p>
              </div>
              <div className="setting-row__control">
                <SyncButton
                  size="sm"
                  onClick={handleFetchLatestCloudTransactions}
                  disabled={cloudTxLoading || !effectiveUserId}
                  loading={cloudTxLoading}
                >
                  Fetch
                </SyncButton>
              </div>
            </div>

            {latestCloudTransactions.length > 0 && (
              <div className="debug-tx-list">
                {latestCloudTransactions.map((tx, idx) => (
                  <div key={tx.id} className="debug-tx-item">
                    <div className="debug-tx-header">
                      <span className="debug-tx-number">#{idx + 1}</span>
                      <span className="debug-tx-amount mono">¥{tx.amount}</span>
                      <span className="debug-tx-category">{tx.category}</span>
                      <span className={`debug-tx-status debug-tx-status--${tx.status}`}>
                        {tx.status}
                      </span>
                      <span className="debug-tx-date mono">
                        {new Date(tx.updatedAt || tx.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="debug-tx-grid">
                      <div className="debug-tx-row">
                        <span className="debug-tx-label">Type:</span>
                        <span className="debug-tx-value">{tx.type}</span>
                      </div>
                      <div className="debug-tx-row">
                        <span className="debug-tx-label">Status:</span>
                        <span className="debug-tx-value">{tx.status}</span>
                      </div>
                      <div className="debug-tx-row">
                        <span className="debug-tx-label">Date:</span>
                        <span className="debug-tx-value mono">{tx.date}</span>
                      </div>
                      <div className="debug-tx-row">
                        <span className="debug-tx-label">Merchant:</span>
                        <span className="debug-tx-value">{tx.merchant || '-'}</span>
                      </div>
                      <div className="debug-tx-row">
                        <span className="debug-tx-label">Description:</span>
                        <span className="debug-tx-value">{tx.description || '-'}</span>
                      </div>
                      {tx.processingModel && (
                        <div className="debug-tx-row">
                          <span className="debug-tx-label">Processing Model:</span>
                          <span className="debug-tx-value mono">{tx.processingModel}</span>
                        </div>
                      )}
                      {tx.confidence !== null && (
                        <div className="debug-tx-row">
                          <span className="debug-tx-label">Confidence:</span>
                          <span className="debug-tx-value">
                            {(tx.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {tx.imageId && (
                        <div className="debug-tx-row">
                          <span className="debug-tx-label">Image ID:</span>
                          <span className="debug-tx-value mono" style={{ fontSize: '10px' }}>
                            {tx.imageId}
                          </span>
                        </div>
                      )}
                      <div className="debug-tx-row">
                        <span className="debug-tx-label">Created:</span>
                        <span className="debug-tx-value mono" style={{ fontSize: '11px' }}>
                          {new Date(tx.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="debug-tx-row">
                        <span className="debug-tx-label">Updated:</span>
                        <span className="debug-tx-value mono" style={{ fontSize: '11px' }}>
                          {new Date(tx.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="debug-tx-row">
                        <span className="debug-tx-label">TX ID:</span>
                        <span className="debug-tx-value mono" style={{ fontSize: '10px' }}>
                          {tx.id}
                        </span>
                      </div>
                      <div className="debug-tx-row">
                        <span className="debug-tx-label">User ID:</span>
                        <span className="debug-tx-value mono" style={{ fontSize: '10px' }}>
                          {tx.userId}
                        </span>
                      </div>

                      {/* Model Comparison Results */}
                      {(tx as any).modelComparison && (
                        <div className="debug-model-comparison">
                          <div className="debug-model-header">
                            <span>Model Comparison Results</span>
                            {(tx as any).modelComparison.comparisonStatus && (
                              <span className="debug-model-status" style={{
                                color: (tx as any).modelComparison.comparisonStatus === 'completed' ? '#10b981' : '#ef4444'
                              }}>
                                {(tx as any).modelComparison.comparisonStatus}
                              </span>
                            )}
                          </div>

                          {/* Textract */}
                          <div className="debug-model-item">
                            <div className="debug-model-name">Textract</div>
                            {(tx as any).modelComparison.textract ? (
                              <div className="debug-model-details">
                                <div>{(tx as any).modelComparison.textract.vendor || '-'}</div>
                                <div>¥{(tx as any).modelComparison.textract.totalAmount || '-'}</div>
                              </div>
                            ) : (
                              <div className="debug-model-details">
                                <span style={{ color: '#999' }}>No result</span>
                              </div>
                            )}
                          </div>

                          {/* Nova Mini */}
                          <div className="debug-model-item">
                            <div className="debug-model-name">Nova Mini</div>
                            {(tx as any).modelComparison.nova_mini ? (
                              <div className="debug-model-details">
                                <div>{(tx as any).modelComparison.nova_mini.vendor || '-'}</div>
                                <div>¥{(tx as any).modelComparison.nova_mini.totalAmount || '-'} (tax: ¥{(tx as any).modelComparison.nova_mini.taxAmount || '0'})</div>
                                <div>Confidence: {(tx as any).modelComparison.nova_mini.confidence || '-'}%</div>
                              </div>
                            ) : (
                              <div className="debug-model-details">
                                <span style={{ color: '#999' }}>No result</span>
                              </div>
                            )}
                          </div>

                          {/* Nova Pro */}
                          <div className="debug-model-item">
                            <div className="debug-model-name">Nova Pro</div>
                            {(tx as any).modelComparison.nova_pro ? (
                              <div className="debug-model-details">
                                <div>{(tx as any).modelComparison.nova_pro.vendor || '-'}</div>
                                <div>¥{(tx as any).modelComparison.nova_pro.totalAmount || '-'} (tax: ¥{(tx as any).modelComparison.nova_pro.taxAmount || '0'})</div>
                                <div>Confidence: {(tx as any).modelComparison.nova_pro.confidence || '-'}%</div>
                              </div>
                            ) : (
                              <div className="debug-model-details">
                                <span style={{ color: '#999' }}>No result</span>
                              </div>
                            )}
                          </div>

                          {/* Claude Sonnet */}
                          <div className="debug-model-item">
                            <div className="debug-model-name">Claude Sonnet</div>
                            {(tx as any).modelComparison.claude_sonnet ? (
                              <div className="debug-model-details">
                                <div>{(tx as any).modelComparison.claude_sonnet.vendor || '-'}</div>
                                <div>¥{(tx as any).modelComparison.claude_sonnet.totalAmount || '-'} (tax: ¥{(tx as any).modelComparison.claude_sonnet.taxAmount || '0'})</div>
                                <div>Confidence: {(tx as any).modelComparison.claude_sonnet.confidence || '-'}%</div>
                              </div>
                            ) : (
                              <div className="debug-model-details">
                                <span style={{ color: '#999' }}>No result</span>
                              </div>
                            )}
                          </div>

                          {/* Comparison Errors */}
                          {(tx as any).modelComparison.comparisonErrors && (tx as any).modelComparison.comparisonErrors.length > 0 && (
                            <div className="debug-model-errors">
                              <div className="debug-model-name" style={{ color: '#ef4444' }}>Errors</div>
                              {(tx as any).modelComparison.comparisonErrors.map((err: any, errIdx: number) => (
                                <div key={errIdx} className="debug-model-error-item">
                                  <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{err.model}:</span> {err.error}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Comparison Timestamp */}
                          {(tx as any).modelComparison.comparisonTimestamp && (
                            <div className="debug-model-timestamp">
                              <span className="debug-tx-label">Compared at:</span>
                              <span className="debug-tx-value mono" style={{ fontSize: '11px' }}>
                                {new Date((tx as any).modelComparison.comparisonTimestamp).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    onClick={() => settingsStateService.update('debugEnabled', !currentSettings.debugEnabled)}
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

      {/* Clear All Data (Local + Cloud) Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearAllDialog}
        title={t('debug.clearMyDataConfirmTitle')}
        message={t('debug.clearMyDataConfirmMessage')}
        checkboxLabel={t('debug.clearMyDataConfirmCheckbox')}
        defaultChecked={true}
        confirmText={t('debug.clearMyDataButton')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={handleConfirmClearAll}
        onCancel={handleCancelClearAll}
      />

    </div>
  );
}

// Version badge component
function VersionBadge({ version }: { version: string }) {
  return <span className="debug-version mono">v{version}</span>;
}
