// Pillar L: Views are pure JSX, logic in headless hooks
// Pillar Q: Intent-ID for idempotency
import { useCaptureLogic } from '../headless/useCaptureLogic';
import { useDragDrop } from '../headless/useDragDrop';
import { useQuota } from '../headless/useQuota';
import { useNetworkStatus } from '../../../00_kernel/network';
import { useEffectiveUserId } from '../../auth/headless';
import { createIntentId } from '../../../00_kernel/types';
import { useTranslation } from '../../../i18n';
import type { DroppedItem } from '../types';
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
};

export function CaptureView() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const { isOnline } = useNetworkStatus();
  const { effectiveUserId, isLoading: userLoading } = useEffectiveUserId();
  const { quota } = useQuota(effectiveUserId);
  const {
    state,
    pendingCount,
    uploadedCount,
    remainingQuota,
    addImage,
  } = useCaptureLogic(effectiveUserId, quota.limit);

  // Drag & drop handling
  const { isDragging, dragHandlers } = useDragDrop({
    onDrop: (items: DroppedItem[]) => {
      if (!effectiveUserId) return;

      for (const item of items) {
        addImage({
          id: item.id,
          userId: effectiveUserId,
          intentId: createIntentId(),
          traceId: item.traceId,
          localPath: item.localPath,
          status: 'pending',
          s3Key: null,
          thumbnailPath: item.preview,
          originalSize: 0,
          compressedSize: null,
          createdAt: new Date().toISOString(),
          uploadedAt: null,
          processedAt: null,
        });
      }
    },
    onReject: (rejectedPaths) => {
      console.warn('Rejected files:', rejectedPaths);
    },
  });

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

  // Calculate quota percentage
  const quotaUsed = quota.limit - remainingQuota;
  const quotaPercent = quota.limit > 0 ? (quotaUsed / quota.limit) * 100 : 0;
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

          {/* Quota Indicator */}
          <div className="premium-card quota-card">
            <div className="quota-header">
              <div className="quota-label">
                <span className="quota-icon">🎯</span>
                <span className="section-header">{t('capture.todayQuota')}</span>
              </div>
              <span className="quota-value mono">{quotaUsed} / {quota.limit}</span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-bar__fill progress-bar__fill--${quotaVariant}`}
                style={{ width: `${Math.min(quotaPercent, 100)}%` }}
              />
            </div>
            <p className="quota-remaining">
              {remainingQuota > 0
                ? t('capture.remaining', { count: remainingQuota })
                : t('capture.quotaFull')}
            </p>
          </div>

          {/* Stats Row */}
          <div className="stats-row">
            <div className="premium-card stat-card">
              <span className="stat-icon">⏳</span>
              <div className="stat-content">
                <span className="stat-label">{t('capture.pending')}</span>
                <span className="stat-value mono">{pendingCount}</span>
              </div>
            </div>
            <div className="premium-card stat-card">
              <span className="stat-icon">✅</span>
              <div className="stat-content">
                <span className="stat-label">{t('capture.uploaded')}</span>
                <span className="stat-value mono">{uploadedCount}</span>
              </div>
            </div>
          </div>

          {/* Drop Zone */}
          <div className="premium-card drop-card">
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
          {state.queue.length > 0 && (
            <div className="premium-card queue-card">
              <h2 className="section-header">{t('capture.processingQueue')}</h2>
              <div className="queue-list">
                {state.queue.map((image) => {
                  const config = STATUS_CONFIG[image.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={image.id} className={`queue-item ${image.status === 'failed' ? 'queue-item--failed' : ''}`}>
                      <div className="queue-thumbnail">
                        <span className="queue-thumb-icon">🧾</span>
                      </div>
                      <div className="queue-content">
                        <div className="queue-row">
                          <span className="queue-filename">{image.id.slice(0, 16)}...</span>
                          <span className={`status-badge status-badge--${config.variant}`}>
                            {config.icon} {t(config.label)}
                          </span>
                        </div>
                        {(image.status === 'pending' || image.status === 'uploading') && (
                          <div className="progress-bar">
                            <div className="progress-bar__fill progress-bar__fill--info progress-bar__fill--animated" />
                          </div>
                        )}
                        {image.status === 'failed' && (
                          <p className="queue-error">{t('capture.tapToRetry')}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Queue Actions */}
              <div className="queue-actions">
                {state.queue.some(img => img.status === 'failed') && (
                  <button className="queue-action queue-action--retry">
                    {t('capture.retryAll')}
                  </button>
                )}
                {state.queue.some(img => img.status === 'uploaded' || img.status === 'confirmed') && (
                  <button className="queue-action queue-action--clear">
                    {t('capture.clearCompleted')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Duplicate Detection Banner (shown when duplicates are skipped) */}
          {/* TODO: Connect to duplicate detection logic in useCaptureLogic */}
          {state.skippedCount > 0 && (
            <div className="info-banner info-banner--info">
              <span className="banner-icon">ℹ️</span>
              <div className="banner-content">
                <p className="banner-title">{t('capture.duplicateDetected')}</p>
                <p className="banner-text">
                  {t('capture.duplicateSkipped', { date: new Date().toISOString().split('T')[0] })}
                </p>
              </div>
            </div>
          )}
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
