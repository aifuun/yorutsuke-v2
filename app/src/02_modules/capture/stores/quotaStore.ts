// Quota Store - Zustand vanilla store for quota state (Permit v2)
// Pillar D: FSM - no boolean flags
// Pillar J: Locality - state near usage
import { createStore } from 'zustand/vanilla';
import type { UsageStats } from '../../../01_domains/quota/LocalQuota';

type UserTier = 'guest' | 'free' | 'basic' | 'pro';

// Default values for offline/guest mode
const DEFAULTS = {
  totalLimit: 30,
  dailyRate: 30,
  tier: 'guest' as UserTier,
};

/**
 * Quota status with computed fields (Permit v2)
 */
export interface QuotaStatus {
  // Total quota
  totalUsed: number;
  totalLimit: number;
  remainingTotal: number;

  // Daily quota
  usedToday: number;
  dailyRate: number;
  remainingDaily: number | typeof Infinity;

  // Status
  isLimitReached: boolean;
  tier: UserTier;
  isGuest: boolean;
  isExpired: boolean;
}

// FSM State (Permit v2)
export type QuotaState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; stats: UsageStats }
  | { status: 'error'; error: string; cachedStats?: UsageStats };

export interface QuotaActions {
  startFetch: () => void;
  updateFromPermit: (stats: UsageStats) => void;
  fetchError: (error: string) => void;
  getQuotaStatus: () => QuotaStatus;
}

export type QuotaStore = QuotaState & QuotaActions;

// Create vanilla store (Permit v2)
export const quotaStore = createStore<QuotaStore>((set, get) => ({
  // Initial state
  status: 'idle',

  // Actions
  startFetch: () => set({ status: 'loading' }),

  updateFromPermit: (stats) => set({ status: 'success', stats }),

  fetchError: (error) => {
    const current = get();
    set({
      status: 'error',
      error,
      cachedStats: current.status === 'success' ? current.stats : undefined,
    });
  },

  // Computed quota status (Permit v2)
  getQuotaStatus: () => {
    const state = get();

    if (state.status === 'success') {
      return {
        totalUsed: state.stats.totalUsed,
        totalLimit: state.stats.totalLimit,
        remainingTotal: state.stats.remainingTotal,
        usedToday: state.stats.usedToday,
        dailyRate: state.stats.dailyRate,
        remainingDaily: state.stats.remainingDaily,
        isLimitReached: state.stats.remainingTotal <= 0 ||
                        (state.stats.dailyRate > 0 && state.stats.remainingDaily === 0),
        tier: state.stats.tier,
        isGuest: state.stats.tier === 'guest',
        isExpired: state.stats.isExpired,
      };
    }

    if (state.status === 'error' && state.cachedStats) {
      return {
        totalUsed: state.cachedStats.totalUsed,
        totalLimit: state.cachedStats.totalLimit,
        remainingTotal: state.cachedStats.remainingTotal,
        usedToday: state.cachedStats.usedToday,
        dailyRate: state.cachedStats.dailyRate,
        remainingDaily: state.cachedStats.remainingDaily,
        isLimitReached: state.cachedStats.remainingTotal <= 0 ||
                        (state.cachedStats.dailyRate > 0 && state.cachedStats.remainingDaily === 0),
        tier: state.cachedStats.tier,
        isGuest: state.cachedStats.tier === 'guest',
        isExpired: state.cachedStats.isExpired,
      };
    }

    // Default for loading/idle/error-without-cache
    return {
      totalUsed: 0,
      totalLimit: DEFAULTS.totalLimit,
      remainingTotal: DEFAULTS.totalLimit,
      usedToday: 0,
      dailyRate: DEFAULTS.dailyRate,
      remainingDaily: DEFAULTS.dailyRate,
      isLimitReached: false,
      tier: DEFAULTS.tier,
      isGuest: true,
      isExpired: false,
    };
  },
}));
