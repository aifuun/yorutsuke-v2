// Pillar L: Views are pure JSX, logic in Service layer
// MVP0: Migrated from headless hooks to Service pattern
import { useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useCaptureQueue, useCaptureStats } from '../hooks/useCaptureState';
import { useDragState } from '../hooks/useDragState';
import { useCaptureActions } from '../hooks/useCaptureActions';
import { useQuota } from '../hooks/useQuotaState';
import { captureService } from '../services/captureService';
import { quotaService } from '../services/quotaService';
import { useNetworkStatus } from '../../../00_kernel/network';
import { useEffectiveUserId } from '../../auth/headless';
import { useTranslation } from '../../../i18n';
import './capture.css';

// Status badge configuration
const STATUS_CONFIG: Record<string, { label: string; icon: string; variant: string }> = {
  pending: { label: 'capture.status.pending', icon: '⏳', variant: 'pending' },
  compressing: { label: 'capture.status.compressing', icon: '🔄', variant: 'processing' },
  compressed: { label: 'capture.status.compressed', icon: '📦', variant: 'processing' },
  uploading: { label: 'capture.status.uploading', icon: '☁️', variant: 'processing' },
  uploaded: { label: 'capture.status.uploaded', icon: '✅', variant: 'success' },
  processing: { label: 'capture.status.processing', icon: '🤖', variant: 'processing' },
  processed: { label: 'capture.status.processed', icon: '✅', variant: 'success' },
  confirmed: { label: 'capture.status.confirmed', icon: '💾', variant: 'success' },
  failed: { label: 'capture.status.failed', icon: '❌', variant: 'error' },
  skipped: { label: 'capture.status.skipped', icon: '⏭️', variant: 'skipped' },
};

export function CaptureView() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const { isOnline } = useNetworkStatus();
  const { effectiveUserId, isLoading: userLoading } = useEffectiveUserId();
  const { quota } = useQuota();

  // New Service-based hooks (MVP0)
  const queue = useCaptureQueue();
  const { pendingCount, uploadedCount } = useCaptureStats();
  const { isDragging, dragHandlers } = useDragState();
  const { retryAllFailed } = useCaptureActions();

  // Set user ID in services when it changes
  useEffect(() => {
    if (effectiveUserId) {
      captureService.setUser(effectiveUserId);
      quotaService.setUser(effectiveUserId);
    }
  }, [effectiveUserId]);

  // Show loading while user ID is being resolved
  if (userLoading) {
    return (
      <div className="capture">
        <CaptureHeader date={today} dayOfWeek={dayOfWeek} title={t('nav.capture')} />
        <div className="capture-content">
          <div className="capture-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  // Use quota.used from API/DB (not store queue count)
  const quotaPercent = quota.limit > 0 ? (quota.used / quota.limit) * 100 : 0;
  const quotaVariant = quotaPercent >= 100 ? 'error' : quotaPercent >= 80 ? 'warning' : 'success';

  return (
    <div className="capture">
      <CaptureHeader date={today} dayOfWeek={dayOfWeek} title={t('nav.capture')} />

      <div className="capture-content">
        <div className="capture-container">
          {/* Offline Banner */}
          {!isOnline && (
            <div className="info-banner info-banner--warning">
              <span className="banner-icon">⚠️</span>
              <div className="banner-content">
                <p className="banner-title">{t('capture.offline')}</p>
                <p className="banner-text">{t('capture.offlineHint')}</p>
              </div>
            </div>
          )}

          {/* Drop Zone */}
          <div className="card drop-card">
            <div
              className={`drop-zone ${isDragging ? 'drop-zone--dragging' : ''}`}
              {...dragHandlers}
            >
              <div className="drop-icon">📄</div>
              <p className="drop-title">
                {isDragging ? t('capture.dropRelease') : t('capture.dropHere')}
              </p>
              <p className="drop-hint">{t('capture.supportedFormats')}</p>
            </div>
          </div>

          {/* Processing Queue */}
          {queue.length > 0 && (
            <div className="card card--list queue-card">
              <h2 className="card--list__header">{t('capture.processingQueue')}</h2>
              <div className="card--list__items">
                {[...queue].reverse().map((image) => {
                  const config = STATUS_CONFIG[image.status] || STATUS_CONFIG.pending;
                  return (
                    <div
                      key={image.id}
                      className={`queue-item media ${image.status === 'failed' ? 'queue-item--failed' : ''} ${image.status === 'skipped' ? 'queue-item--skipped' : ''}`}
                    >
                      <div className="media__figure">
                        {image.thumbnailPath ? (
                          <img src={convertFileSrc(image.thumbnailPath)} alt="" />
                        ) : (
                          <span className="media__icon">🧾</span>
                        )}
                      </div>
                      <div className="media__body">
                        <div className="queue-row">
                          <p className="media__title">{image.id.slice(0, 16)}...</p>
                          <span className={`status-badge status-badge--${config.variant}`}>
                            {config.icon} {t(config.label)}
                          </span>
                        </div>
                        {(image.status === 'pending' || image.status === 'uploading') && (
                          <div className="progress-bar">
                            <div className="progress-bar__fill progress-bar__fill--info progress-bar__fill--animated" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Queue Actions */}
              <div className="queue-actions">
                {queue.some(img => img.status === 'failed') && (
                  <button
                    type="button"
                    className="queue-action queue-action--retry"
                    onClick={retryAllFailed}
                  >
                    {t('capture.retryAll')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="stats-row">
            <div className={`card card--stat is-sm ${quotaVariant === 'error' ? 'is-expense' : quotaVariant === 'warning' ? 'is-warning' : ''}`}>
              <div className="card--stat__icon">🎯</div>
              <div className="card--stat__content">
                <p className="card--stat__label">{t('capture.todayQuota')}</p>
                <p className="card--stat__value">{quota.used}/{quota.limit}</p>
              </div>
            </div>
            <div className="card card--stat is-sm is-warning">
              <div className="card--stat__icon">⏳</div>
              <div className="card--stat__content">
                <p className="card--stat__label">{t('capture.pending')}</p>
                <p className="card--stat__value">{pendingCount}</p>
              </div>
            </div>
            <div className="card card--stat is-sm is-income">
              <div className="card--stat__icon">✅</div>
              <div className="card--stat__content">
                <p className="card--stat__label">{t('capture.uploaded')}</p>
                <p className="card--stat__value">{uploadedCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Header component
function CaptureHeader({ date, dayOfWeek, title }: { date: string; dayOfWeek: string; title: string }) {
  return (
    <header className="capture-header">
      <h1 className="capture-title">{title}</h1>
      <div className="capture-date">
        <span className="mono">{date}</span>
        <span className="date-separator">•</span>
        <span>{dayOfWeek}</span>
      </div>
    </header>
  );
}
