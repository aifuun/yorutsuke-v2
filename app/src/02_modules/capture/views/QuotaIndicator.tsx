// Pillar L: View - renders quota data from quotaStore
import { useMemo } from 'react';
import type { QuotaStatus } from '../stores/quotaStore';
import { useTranslation } from '../../../i18n';
import './QuotaIndicator.css';

interface QuotaIndicatorProps {
  quota: QuotaStatus;
  isLoading: boolean;
  onRefresh?: () => void;
}

type QuotaLevel = 'ok' | 'warning' | 'critical';

/**
 * Determine quota level based on usage percentage
 * - ok: < 80%
 * - warning: 80-99%
 * - critical: 100%
 */
function getQuotaLevel(used: number, limit: number): QuotaLevel {
  if (limit === 0) return 'critical';
  const percentage = (used / limit) * 100;
  if (percentage >= 100) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'ok';
}

/**
 * Format time until reset
 * @param resetsAt ISO timestamp
 * @returns Formatted string like "3h 24m" or null if invalid
 */
function formatTimeUntilReset(resetsAt: string | null): string | null {
  if (!resetsAt) return null;

  const now = new Date();
  const reset = new Date(resetsAt);
  const diffMs = reset.getTime() - now.getTime();

  if (diffMs <= 0) return null;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function QuotaIndicator({ quota, isLoading, onRefresh }: QuotaIndicatorProps) {
  const { t } = useTranslation();

  const level = useMemo(
    () => getQuotaLevel(quota.used, quota.limit),
    [quota.used, quota.limit]
  );

  const timeUntilReset = useMemo(
    () => formatTimeUntilReset(quota.resetsAt),
    [quota.resetsAt]
  );

  return (
    <div
      className={`quota-indicator quota-indicator--${level}`}
      onClick={onRefresh}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onRefresh?.()}
      title={t('quota.clickToRefresh')}
    >
      <div className="quota-indicator__main">
        <span className="quota-indicator__label">{t('quota.label')}</span>
        <span className="quota-indicator__value">
          {isLoading ? '...' : `${quota.used}/${quota.limit}`}
        </span>
      </div>

      {quota.isLimitReached ? (
        <div className="quota-indicator__status quota-indicator__status--limit">
          {t('quota.limitReached')}
        </div>
      ) : timeUntilReset ? (
        <div className="quota-indicator__status">
          {t('quota.resetsIn', { time: timeUntilReset })}
        </div>
      ) : null}

      {/* Guest expiration warning */}
      {quota.showExpirationWarning && quota.guestExpiration && (
        <div className="quota-indicator__expiration-warning">
          {t('quota.guestExpiration', {
            days: quota.guestExpiration.daysUntilExpiration,
          })}
        </div>
      )}

      {/* Progress bar */}
      <div className="quota-indicator__bar">
        <div
          className="quota-indicator__bar-fill"
          style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
        />
      </div>
    </div>
  );
}
