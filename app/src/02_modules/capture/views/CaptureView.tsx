// Pillar L: Views are pure JSX, logic in Service layer
// MVP0: Migrated from headless hooks to Service pattern
import { useEffect } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useCaptureQueue, useCaptureStats, useRejection } from '../hooks/useCaptureState';
import { useDragState } from '../hooks/useDragState';
import { useQuota } from '../hooks/useQuotaState';
import { captureService } from '../services/captureService';
import { quotaService } from '../services/quotaService';
import { useNetworkStatus } from '../../../00_kernel/network';
import { useEffectiveUserId } from '../../auth/headless';
import { useTranslation } from '../../../i18n';
import { Icon, ViewHeader } from '../../../components';
import './capture.css';

// Format file size for display
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Truncate filename for display (max 20 chars)
function truncateFilename(name: string | null, maxLen = 20): string {
  if (!name) return '';
  if (name.length <= maxLen) return name;
  // Keep extension visible: "verylongfilena...jpg"
  const ext = name.lastIndexOf('.');
  if (ext > 0 && name.length - ext <= 5) {
    const extPart = name.slice(ext);
    const basePart = name.slice(0, maxLen - extPart.length - 3);
    return `${basePart}...${extPart}`;
  }
  return name.slice(0, maxLen - 3) + '...';
}

// Status pipeline configuration (matches ImageStatus from types.ts)
// Order: pending → compressed → uploading → uploaded
const STATUS_PIPELINE = ['pending', 'compressed', 'uploading', 'uploaded'] as const;

// Map status to pipeline index (-1 = not in pipeline, e.g., failed/skipped)
function getStatusIndex(status: string): number {
  const idx = STATUS_PIPELINE.indexOf(status as typeof STATUS_PIPELINE[number]);
  return idx;
}

// Status label key mapping (to be translated with t())
const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'capture.status.compressing',
  compressed: 'capture.status.compressed',
  uploading: 'capture.status.uploading',
  uploaded: 'capture.status.uploaded',
  failed: 'capture.status.failed',
  skipped: 'capture.status.skipped',
};

// Status Dots Component (dots only, no label)
function StatusDots({ status }: { status: string }) {
  const currentIndex = getStatusIndex(status);
  const isFailed = status === 'failed';
  const isSkipped = status === 'skipped';

  return (
    <div className="status-dots">
      {STATUS_PIPELINE.map((step, idx) => {
        let className = 'status-dot';

        if (isFailed) {
          className += idx < currentIndex ? ' status-dot--active' : '';
          className += idx === currentIndex ? ' status-dot--error' : '';
        } else if (isSkipped) {
          className += ' status-dot--skipped';
        } else if (idx < currentIndex) {
          className += ' status-dot--active';
        } else if (idx === currentIndex) {
          const isProcessing = ['pending', 'uploading'].includes(status);
          className += isProcessing ? ' status-dot--current' : ' status-dot--active';
        }

        return <span key={step} className={className} />;
      })}
    </div>
  );
}

export function CaptureView() {
  const { t } = useTranslation();
  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local TZ
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const { isOnline } = useNetworkStatus();
  const { effectiveUserId, isLoading: userLoading } = useEffectiveUserId();
  const { quota } = useQuota();

  // New Service-based hooks (MVP0)
  const queue = useCaptureQueue();
  const { pendingCount, uploadedCount } = useCaptureStats();
  const { isDragging, dragHandlers } = useDragState();
  const { rejection, clearRejection } = useRejection();

  // Auto-clear rejection after 5 seconds
  useEffect(() => {
    if (rejection) {
      const timer = setTimeout(clearRejection, 5000);
      return () => clearTimeout(timer);
    }
  }, [rejection, clearRejection]);

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
        <CaptureHeaderComponent date={today} dayOfWeek={dayOfWeek} title={t('nav.capture')} />
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
      <CaptureHeaderComponent date={today} dayOfWeek={dayOfWeek} title={t('nav.capture')} />

      <div className="capture-content">
        <div className="capture-container">
          {/* Offline Banner */}
          {!isOnline && (
            <div className="info-banner info-banner--warning">
              <Icon icon={AlertTriangle} size="md" aria-label={t('capture.offline')} className="banner-icon" />
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
              <button
                type="button"
                className="btn btn--secondary drop-select-btn"
                onClick={() => captureService.selectFiles()}
              >
                {t('capture.selectFiles')}
              </button>
            </div>

            {/* Rejection Banner - inside drop card */}
            {rejection && (
              <div className="drop-rejection">
                <Icon icon={AlertTriangle} size="md" aria-label={t('capture.rejected')} className="drop-rejection__icon" />
                <div className="drop-rejection__content">
                  <span className="drop-rejection__title">
                    {rejection.reason === 'limit'
                      ? t('capture.rejectedLimit', { count: rejection.count })
                      : t('capture.rejected', { count: rejection.count })}
                  </span>
                  <span className="drop-rejection__hint">
                    {rejection.reason === 'limit'
                      ? t('capture.rejectedLimitHint')
                      : t('capture.rejectedHint')}
                  </span>
                </div>
                <button
                  type="button"
                  className="drop-rejection__dismiss"
                  onClick={clearRejection}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Processing Queue */}
          {queue.length > 0 && (
            <div className="card card--list queue-card">
              <div className="queue-header">
                <h2 className="card--list__header">{t('capture.processingQueue')}</h2>
                {queue.some(img => img.status === 'uploaded') && (
                  <span className="queue-header__hint">{t('capture.aiProcessingLater')}</span>
                )}
              </div>
              <div className="card--list__items">
                {[...queue].reverse().map((image) => {
                  const labelKey = STATUS_LABEL_KEYS[image.status];
                  const labelText = labelKey ? t(labelKey) : image.status;
                  const isFailed = image.status === 'failed';
                  const isSkipped = image.status === 'skipped';
                  return (
                    <div
                      key={image.id}
                      className={`queue-item queue-item--3col ${isFailed ? 'queue-item--failed' : ''} ${isSkipped ? 'queue-item--skipped' : ''}`}
                    >
                      {/* Column 1: Thumbnail + Filename + MD5/ID */}
                      <div className="queue-item__left">
                        <div className="queue-item__thumb">
                          {image.thumbnailPath ? (
                            <img src={convertFileSrc(image.thumbnailPath)} alt="" />
                          ) : (
                            <Icon icon={FileText} size="md" aria-label={image.originalName || t('capture.selectFiles')} className="queue-item__icon" />
                          )}
                        </div>
                        <div className="queue-item__info">
                          {image.originalName && (
                            <p className="queue-item__name" title={image.originalName}>
                              {truncateFilename(image.originalName)}
                            </p>
                          )}
                          <p className="queue-item__id">{image.md5 ? image.md5.slice(0, 8) : image.id.slice(0, 8)}...</p>
                        </div>
                      </div>

                      {/* Column 2: Status Label + Size/Error */}
                      <div className="queue-item__center">
                        <span className={`status-label status-label--${isFailed ? 'error' : isSkipped ? 'skipped' : 'default'}`}>
                          {labelText}
                        </span>
                        {isFailed && image.error ? (
                          <span className="queue-item__error">{image.error}</span>
                        ) : image.compressedSize && image.compressedSize > 0 ? (
                          <span className="queue-item__size">{formatSize(image.compressedSize)}</span>
                        ) : null}
                      </div>

                      {/* Column 3: Status Dots (fixed right) */}
                      <div className="queue-item__right">
                        <StatusDots status={image.status} />
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* Stats Row */}
          <div className="stats-row">
            <div className={`card card--summary ${quotaVariant === 'error' ? 'is-expense' : quotaVariant === 'warning' ? 'is-warning' : 'is-info'}`}>
              <p className="card--summary__label">{t('capture.quota')}</p>
              <p className="card--summary__value">{quota.used}/{quota.limit}</p>
            </div>
            <div className="card card--summary is-pending">
              <p className="card--summary__label">{t('capture.pending')}</p>
              <p className="card--summary__value">{pendingCount}</p>
            </div>
            <div className="card card--summary is-income">
              <p className="card--summary__label">{t('capture.uploaded')}</p>
              <p className="card--summary__value">{uploadedCount}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Header component
function CaptureHeaderComponent({ date, dayOfWeek, title }: { date: string; dayOfWeek: string; title: string }) {
  return (
    <ViewHeader
      title={title}
      rightContent={
        <div className="capture-date">
          <span className="mono">{date}</span>
          <span className="date-separator">•</span>
          <span>{dayOfWeek}</span>
        </div>
      }
    />
  );
}
