// Quota Service - Business logic for quota management (Permit v2)
// Pillar L: Pure orchestration, no React dependencies
// @listen upload:complete - Increment local usage after successful upload
// @listen quota:reset - Refresh permit after debug reset

import type { UserId } from '../../../00_kernel/types';
import { on } from '../../../00_kernel/eventBus';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { localQuota } from '../../../01_domains/quota';
import { fetchPermit } from '../adapters/permitApi';
import { quotaStore } from '../stores/quotaStore';

class QuotaService {
  private initialized = false;
  private userId: UserId | null = null;
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

    // @listen upload:complete - Increment local usage after upload
    this.cleanupUploadListener = on('upload:complete', () => {
      if (this.userId) {
        logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'upload_complete' });
        // Pillar: IO-First Pattern - LocalQuota updates localStorage synchronously
        localQuota.incrementUsage();
        // Then sync to store (UI update)
        this.syncToStore();
      }
    });

    // @listen quota:reset - Refresh permit after debug reset
    this.cleanupResetListener = on('quota:reset', () => {
      if (this.userId) {
        logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'quota_reset' });
        this.refreshPermit();
      }
    });

    // Visibility change listener
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    logger.info(EVENTS.SERVICE_INITIALIZED, { service: 'QuotaService', system: 'permit_v2' });
  }

  /**
   * Set current user and fetch permit if needed
   */
  async setUser(userId: UserId | null): Promise<void> {
    this.userId = userId;

    if (userId) {
      // Check if we need to fetch a new permit
      const permit = localQuota.getPermit();
      const isExpired = localQuota.isExpired();

      if (!permit || isExpired) {
        logger.info(EVENTS.QUOTA_REFRESHED, {
          trigger: 'setUser',
          hasPermit: !!permit,
          isExpired,
        });
        await this.refreshPermit();
      } else {
        // Permit is valid, just sync to store
        this.syncToStore();
      }
    }
  }

  /**
   * Fetch new permit from API and update local storage
   * Pillar: IO-First Pattern - Complete IO before updating store
   */
  async refreshPermit(): Promise<void> {
    if (!this.userId) return;

    quotaStore.getState().startFetch();

    try {
      // 1. IO operation first
      const permit = await fetchPermit(this.userId);

      // 2. Update local storage
      localQuota.setPermit(permit);

      // 3. Then update UI store
      this.syncToStore();

      logger.info(EVENTS.QUOTA_REFRESHED, {
        system: 'permit_v2',
        tier: permit.tier,
        totalLimit: permit.totalLimit,
        dailyRate: permit.dailyRate,
      });
    } catch (e) {
      logger.error(EVENTS.APP_ERROR, { context: 'permit_refresh', error: String(e) });
      quotaStore.getState().fetchError(String(e));
    }
  }

  /**
   * Sync LocalQuota state to quotaStore (UI update)
   */
  private syncToStore(): void {
    const stats = localQuota.getUsageStats();
    if (stats) {
      quotaStore.getState().updateFromPermit(stats);
    }
  }

  /**
   * Get current permit (for uploadApi)
   */
  getPermit() {
    return localQuota.getPermit();
  }

  /**
   * Handle visibility change - check permit expiration when app becomes visible
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.userId) {
      logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'visibility_change' });

      // Check if permit has expired
      if (localQuota.isExpired()) {
        logger.info(EVENTS.QUOTA_REFRESHED, {
          trigger: 'visibility_change',
          action: 'permit_expired_refresh',
        });
        this.refreshPermit();
      } else {
        // Just sync current state to store
        this.syncToStore();
      }
    }
  };

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cleanupUploadListener?.();
    this.cleanupResetListener?.();

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.initialized = false;
  }
}

export const quotaService = new QuotaService();
