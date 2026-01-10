// Quota Service - Business logic for quota management
// Pillar L: Pure orchestration, no React dependencies
// @listen upload:complete - Refresh quota after successful upload
// @listen quota:reset - Refresh quota after debug reset

import type { UserId } from '../../../00_kernel/types';
import { on } from '../../../00_kernel/eventBus';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { fetchQuota } from '../adapters';
import { quotaStore } from '../stores/quotaStore';

// Refresh intervals
const PERIODIC_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

class QuotaService {
  private initialized = false;
  private userId: UserId | null = null;
  private periodicInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupUploadListener: (() => void) | null = null;
  private cleanupResetListener: (() => void) | null = null;

  /**
   * Initialize quota service
   * Called once at app startup
   */
  init(): void {
    if (this.initialized) {
      logger.warn(EVENTS.SERVICE_INITIALIZED, { service: 'QuotaService', status: 'already_initialized' });
      return;
    }
    this.initialized = true;

    // @listen upload:complete - Refresh after upload
    this.cleanupUploadListener = on('upload:complete', () => {
      if (this.userId) {
        logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'upload_complete' });
        this.refresh();
      }
    });

    // @listen quota:reset - Refresh after debug reset
    this.cleanupResetListener = on('quota:reset', () => {
      if (this.userId) {
        logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'quota_reset' });
        this.refresh();
      }
    });

    // Visibility change listener
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    logger.info(EVENTS.SERVICE_INITIALIZED, { service: 'QuotaService' });
  }

  /**
   * Set current user and start periodic refresh
   */
  setUser(userId: UserId | null): void {
    this.userId = userId;

    // Clear existing interval
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }

    if (userId) {
      // Initial fetch
      this.refresh();

      // Start periodic refresh
      this.periodicInterval = setInterval(() => {
        logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'periodic' });
        this.refresh();
      }, PERIODIC_REFRESH_MS);
    }
  }

  /**
   * Refresh quota from API
   */
  async refresh(): Promise<void> {
    if (!this.userId) return;

    quotaStore.getState().startFetch();

    try {
      const quota = await fetchQuota(this.userId);
      logger.info(EVENTS.QUOTA_REFRESHED, { used: quota.used, limit: quota.limit });
      quotaStore.getState().fetchSuccess(quota);
    } catch (e) {
      logger.error(EVENTS.APP_ERROR, { context: 'quota_refresh', error: String(e) });
      quotaStore.getState().fetchError(String(e));
    }
  }

  /**
   * Handle visibility change - refresh when app becomes visible
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.userId) {
      logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'visibility_change' });
      this.refresh();
    }
  };

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }

    this.cleanupUploadListener?.();
    this.cleanupResetListener?.();

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.initialized = false;
  }
}

export const quotaService = new QuotaService();
