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


export function QuotaIndicator({ quota, isLoading, onRefresh }: QuotaIndicatorProps) {
  const { t } = useTranslation();

  const level = useMemo(
    () => getQuotaLevel(quota.totalUsed, quota.totalLimit),
    [quota.totalUsed, quota.totalLimit]
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
          {isLoading ? '...' : `${quota.totalUsed}/${quota.totalLimit}`}
        </span>
      </div>

      {/* Show daily limit if applicable */}
      {quota.dailyRate > 0 && (
        <div className="quota-indicator__status">
          {t('quota.dailyUsage')}: {quota.usedToday}/{quota.dailyRate}
        </div>
      )}

      {/* Show limit reached message */}
      {quota.isLimitReached && (
        <div className="quota-indicator__status quota-indicator__status--limit">
          {t('quota.limitReached')}
        </div>
      )}

      {/* Show permit expired warning */}
      {quota.isExpired && (
        <div className="quota-indicator__expiration-warning">
          {t('quota.permitExpired')}
        </div>
      )}

      {/* Progress bar */}
      <div className="quota-indicator__bar">
        <div
          className="quota-indicator__bar-fill"
          style={{ width: `${Math.min(100, (quota.totalUsed / quota.totalLimit) * 100)}%` }}
        />
      </div>
    </div>
  );
}
