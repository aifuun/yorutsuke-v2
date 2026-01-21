// Pillar L: Debug Permit/Quota Panel
// Centralized display and controls for permit and quota information

import { useState } from 'react';
import { useQuota } from '../../capture/hooks/useQuotaState';
import { quotaService } from '../../capture/services/quotaService';
import { getMockSnapshot } from '../../../00_kernel/config/mock';
import { logger } from '../../../00_kernel/telemetry';
import { toastStore } from '../../../components/Toast/toastStore';
import type { UserId } from '../../../00_kernel/types';

interface PermitPanelProps {
  userId: UserId | null;
}

export function PermitPanel({ userId }: PermitPanelProps) {
  const { quota, isLoading, isError, error } = useQuota();
  const mockMode = getMockSnapshot();
  const [hasClearedCache, setHasClearedCache] = useState(false);
  const [isLoading_, setIsLoading] = useState(false);

  // Helper to show toast with 5-second duration
  const showToast = (type: 'success' | 'error', title: string, message: string = '') => {
    toastStore.getState().addToast({ type, title, message, duration: 5000 });
  };

  const handleRefreshQuota = async () => {
    if (!userId) {
      showToast('error', 'Error', 'No user ID');
      return;
    }

    setIsLoading(true);

    try {
      await quotaService.setUser(userId);
      showToast('success', 'Permit Refreshed', `${quota.totalUsed}/${quota.totalLimit}`);
    } catch (e) {
      showToast('error', 'Error', String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetQuota = async () => {
    if (!userId) {
      showToast('error', 'Error', 'No user ID');
      return;
    }

    setIsLoading(true);

    try {
      const { resetTodayQuota } = await import('../../capture');
      const count = await resetTodayQuota(userId);
      showToast('success', 'Quota Reset', count > 0 ? `Reset ${count} uploads` : 'No uploads today');
    } catch (e) {
      showToast('error', 'Error', String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearPermitCache = async () => {
    setIsLoading(true);

    try {
      const { localQuota } = await import('../../../01_domains/quota');
      const isMock = localQuota.isMockPermit();

      localQuota.clear();
      setHasClearedCache(true);

      showToast(
        'success',
        'Cache Cleared',
        isMock
          ? 'Mock permit cleared. Refresh page to fetch fresh permit.'
          : 'Permit cache cleared. Refresh page to fetch fresh permit.'
      );

      logger.info('debug_permit_cache_cleared', { wasMock: isMock });
    } catch (e) {
      showToast('error', 'Error', String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Status indicator color
  const getStatusColor = () => {
    if (isLoading) return 'status--loading';
    if (isError) return 'status--error';
    if (quota.isExpired) return 'status--expired';
    if (quota.isLimitReached) return 'status--warning';
    return 'status--valid';
  };

  const getStatusText = () => {
    if (isLoading) return 'Loading';
    if (isError) return 'Error';
    if (quota.isExpired) return 'Expired';
    if (quota.isLimitReached) return 'Limit Reached';
    return 'Valid';
  };

  return (
    <div className="permit-panel">
      {/* Permit Status Header */}
      <div className="permit-header">
        <h3 className="permit-title">Permit & Quota</h3>
        <div className={`permit-status-badge ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      {/* Permit Info Grid */}
      <div className="permit-grid">
        {/* Tier */}
        <div className="permit-grid-item">
          <span className="permit-label">Tier</span>
          <span className="permit-value">
            {quota.tier}
            {quota.isGuest ? ' (guest)' : ''}
          </span>
        </div>

        {/* Total Quota */}
        <div className="permit-grid-item">
          <span className="permit-label">Total Quota</span>
          <span className="permit-value mono">
            {quota.totalUsed} / {quota.totalLimit}
          </span>
          <span className="permit-hint">
            {quota.remainingTotal} remaining
          </span>
        </div>

        {/* Daily Quota */}
        <div className="permit-grid-item">
          <span className="permit-label">Daily Quota</span>
          <span className="permit-value mono">
            {quota.usedToday} / {quota.dailyRate === Infinity ? '∞' : quota.dailyRate}
          </span>
          <span className="permit-hint">
            {quota.dailyRate === Infinity ? 'Unlimited' : `${quota.remainingDaily} remaining`}
          </span>
        </div>

        {/* Permit Status */}
        <div className="permit-grid-item">
          <span className="permit-label">Status</span>
          <span className={`permit-value ${quota.isExpired ? 'permit-expired' : ''}`}>
            {quota.isExpired ? 'Expired' : 'Active'}
          </span>
        </div>

        {/* Mock Mode */}
        {mockMode !== 'off' && (
          <div className="permit-grid-item">
            <span className="permit-label">Mock Mode</span>
            <span className="permit-value permit-mock">
              {mockMode === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        )}

        {/* Error Message */}
        {isError && error && (
          <div className="permit-grid-item permit-error">
            <span className="permit-label">Error</span>
            <span className="permit-value">{error}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="permit-actions">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={handleRefreshQuota}
          disabled={isLoading_ || !userId || isLoading}
          title="Force refresh quota from API"
        >
          Refresh Permit
        </button>

        <button
          type="button"
          className="btn btn--warning btn--sm"
          onClick={handleResetQuota}
          disabled={isLoading_ || !userId}
          title="Reset today's upload count"
        >
          Reset Today
        </button>

        {/* Clear Cache - Show when mock mode is active or cache was cleared */}
        {(mockMode !== 'off' || hasClearedCache) && (
          <button
            type="button"
            className="btn btn--warning btn--sm"
            onClick={handleClearPermitCache}
            disabled={isLoading_}
            title="Clear cached permit from localStorage (fixes mock pollution)"
          >
            Clear Cache
          </button>
        )}
      </div>
    </div>
  );
}
