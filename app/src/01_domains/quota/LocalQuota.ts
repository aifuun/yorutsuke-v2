/**
 * LocalQuota - Client-side quota management
 *
 * Manages upload permits and usage tracking in localStorage.
 * Implements singleton pattern for global quota state.
 */

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
   */
  public setPermit(permit: UploadPermit): void {
    const data: LocalQuotaData = {
      permit,
      totalUsed: 0,
      dailyUsage: {},
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
   * Clear all quota data
   */
  public clear(): void {
    localStorage.removeItem(STORAGE_KEY);
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
