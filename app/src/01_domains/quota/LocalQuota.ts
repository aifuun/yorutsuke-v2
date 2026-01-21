/**
 * LocalQuota - Client-side quota management
 *
 * Manages upload permits and usage tracking in localStorage.
 * Implements singleton pattern for global quota state.
 *
 * Issue #154: Added format validation on setPermit() to reject invalid permits
 * at client boundary (Pillar B: Airlock pattern).
 */

import { logger } from '../../00_kernel/telemetry/logger';
import { validatePermitFormat } from './permitValidation';
import * as permitDb from './permitDb';

// ============================================================
// Type Definitions
// ============================================================

export interface UploadPermit {
  userId: string;
  totalLimit: number;
  dailyRate: number; // 0 = unlimited (Pro tier)
  expiresAt: string; // ISO 8601
  issuedAt: string; // ISO 8601
  signature: string; // HMAC-SHA256
  tier: 'guest' | 'free' | 'basic' | 'pro';
}

export interface LocalQuotaData {
  permit: UploadPermit;
  totalUsed: number;
  dailyUsage: Record<string, number>; // { "YYYY-MM-DD": count }
}

export interface CanUploadResult {
  allowed: boolean;
  reason?: 'total_limit_reached' | 'daily_limit_reached' | 'permit_expired' | 'no_permit';
  remainingTotal: number;
  remainingDaily: number | typeof Infinity;
}

export interface UsageStats {
  totalUsed: number;
  totalLimit: number;
  remainingTotal: number;
  usedToday: number;
  dailyRate: number;
  remainingDaily: number | typeof Infinity;
  tier: 'guest' | 'free' | 'basic' | 'pro';
  isExpired: boolean;
}

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = 'yorutsuke:quota';
const MAX_DAILY_HISTORY_DAYS = 7;

// ============================================================
// Helper Functions
// ============================================================

function getTodayDate(): string {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD format
}

// ============================================================
// LocalQuota Class (Singleton)
// ============================================================

export class LocalQuota {
  private static instance: LocalQuota | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LocalQuota {
    if (!LocalQuota.instance) {
      LocalQuota.instance = new LocalQuota();
    }
    return LocalQuota.instance;
  }

  /**
   * Set a new permit (resets usage counters)
   *
   * Issue #154: Dual storage for backward compatibility
   * - Synchronous: Save to localStorage (fast cache)
   * - Asynchronous: Save to SQLite (persistent storage)
   *
   * This keeps the API synchronous while ensuring persistence.
   * Uses fire-and-forget pattern for SQLite write (non-blocking).
   *
   * Validates permit structure before accepting (Pillar B: Airlock).
   * Server validates HMAC signature in presign Lambda (defense in depth).
   *
   * @throws Error if permit format is invalid
   */
  public setPermit(permit: UploadPermit): void {
    // Validate permit format before storing
    const validation = validatePermitFormat(permit);
    if (!validation.valid) {
      logger.warn('permit_validation_failed', { reason: validation.reason, tier: permit.tier });
      throw new Error(`Invalid permit: ${validation.reason}`);
    }

    const data: LocalQuotaData = {
      permit,
      totalUsed: 0,
      dailyUsage: {},
    };

    // 1. Save to localStorage immediately (fast, synchronous)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // 2. Save to SQLite asynchronously (fire-and-forget, non-blocking)
    permitDb.savePermit(permit).catch(error => {
      logger.warn('permit_sqlite_save_failed', {
        userId: permit.userId,
        error: String(error),
      });
    });
  }

  /**
   * Get the current permit
   */
  public getPermit(): UploadPermit | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored) as LocalQuotaData;
      return data.permit || null;
    } catch (error) {
      console.error('Failed to parse LocalQuota data:', error);
      return null;
    }
  }

  /**
   * Check if the current permit has expired
   */
  public isExpired(): boolean {
    const permit = this.getPermit();
    if (!permit) return true; // No permit = expired

    return new Date(permit.expiresAt).getTime() < Date.now();
  }

  /**
   * Check if user can upload (triple check: expired, total limit, daily rate)
   *
   * Priority order: expired > total_limit_reached > daily_limit_reached
   */
  public checkCanUpload(): CanUploadResult {
    const permit = this.getPermit();

    // No permit
    if (!permit) {
      return {
        allowed: false,
        reason: 'no_permit',
        remainingTotal: 0,
        remainingDaily: 0,
      };
    }

    const data = this.getData();
    if (!data) {
      return {
        allowed: false,
        reason: 'no_permit',
        remainingTotal: 0,
        remainingDaily: 0,
      };
    }

    // Priority 1: Check expiration
    if (this.isExpired()) {
      return {
        allowed: false,
        reason: 'permit_expired',
        remainingTotal: Math.max(0, permit.totalLimit - data.totalUsed),
        remainingDaily: permit.dailyRate === 0 ? Infinity : 0,
      };
    }

    // Priority 2: Check total limit
    if (data.totalUsed >= permit.totalLimit) {
      return {
        allowed: false,
        reason: 'total_limit_reached',
        remainingTotal: 0,
        remainingDaily: this.calculateRemainingDaily(permit, data),
      };
    }

    // Priority 3: Check daily rate (if not unlimited)
    const today = getTodayDate();
    const usedToday = data.dailyUsage[today] || 0;

    if (permit.dailyRate > 0 && usedToday >= permit.dailyRate) {
      return {
        allowed: false,
        reason: 'daily_limit_reached',
        remainingTotal: permit.totalLimit - data.totalUsed,
        remainingDaily: 0,
      };
    }

    // All checks passed
    return {
      allowed: true,
      remainingTotal: permit.totalLimit - data.totalUsed,
      remainingDaily: this.calculateRemainingDaily(permit, data),
    };
  }

  /**
   * Increment usage counters (total + daily)
   * Automatically cleans up old daily records (>7 days)
   */
  public incrementUsage(): void {
    const data = this.getData();
    if (!data) {
      throw new Error('No permit data found');
    }

    const today = getTodayDate();

    // Increment counters
    data.totalUsed += 1;
    data.dailyUsage[today] = (data.dailyUsage[today] || 0) + 1;

    // Auto-cleanup: Remove records older than 7 days
    const cutoffDate = new Date(Date.now() - MAX_DAILY_HISTORY_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
    Object.keys(data.dailyUsage).forEach((date) => {
      if (date < cutoffDate) {
        delete data.dailyUsage[date];
      }
    });

    // Save
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Get usage statistics
   */
  public getUsageStats(): UsageStats | null {
    const permit = this.getPermit();
    if (!permit) return null;

    const data = this.getData();
    if (!data) return null;

    const today = getTodayDate();
    const usedToday = data.dailyUsage[today] || 0;

    return {
      totalUsed: data.totalUsed,
      totalLimit: permit.totalLimit,
      remainingTotal: Math.max(0, permit.totalLimit - data.totalUsed),
      usedToday,
      dailyRate: permit.dailyRate,
      remainingDaily: this.calculateRemainingDaily(permit, data),
      tier: permit.tier,
      isExpired: this.isExpired(),
    };
  }

  /**
   * Clear all quota data (including permit)
   * Used for debugging and testing permit refresh
   *
   * Issue #154: Also deletes from SQLite (if permit exists)
   * Extracts userId from cached permit to delete from database.
   *
   * Used by:
   * - Mock mode switch (clear stale permits)
   * - Debug panel (reset quota)
   * - User logout (cleanup)
   */
  public clear(): void {
    // Extract userId from current permit to delete from SQLite
    try {
      const permit = this.getPermit();
      if (permit && permit.userId) {
        // Fire-and-forget deletion (non-blocking)
        permitDb.deletePermit(permit.userId as never).catch(error => {
          logger.warn('permit_sqlite_delete_failed', {
            userId: permit.userId,
            error: String(error),
          });
        });
      }
    } catch (error) {
      logger.warn('permit_clear_extraction_failed', { error: String(error) });
    }

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Check if current permit is a mock permit (for testing)
   * Mock permits have signature starting with "mock-signature"
   */
  public isMockPermit(): boolean {
    const permit = this.getPermit();
    if (!permit) return false;
    return permit.signature.startsWith('mock-signature');
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private getData(): LocalQuotaData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      return JSON.parse(stored) as LocalQuotaData;
    } catch (error) {
      console.error('Failed to parse LocalQuota data:', error);
      return null;
    }
  }

  private calculateRemainingDaily(permit: UploadPermit, data: LocalQuotaData): number | typeof Infinity {
    if (permit.dailyRate === 0) {
      return Infinity; // Pro tier: unlimited daily
    }

    const today = getTodayDate();
    const usedToday = data.dailyUsage[today] || 0;
    return Math.max(0, permit.dailyRate - usedToday);
  }
}

// Export singleton instance for convenience
export const localQuota = LocalQuota.getInstance();
