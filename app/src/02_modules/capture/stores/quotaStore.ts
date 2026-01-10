// Quota Store - Zustand vanilla store for quota state
// Pillar D: FSM - no boolean flags
// Pillar J: Locality - state near usage
import { createStore } from 'zustand/vanilla';
import type { QuotaResponse, UserTier, GuestExpirationInfo } from '../adapters';

// Default values for offline/guest mode
// Must match TIER_LIMITS.guest in quotaApi.ts
const DEFAULTS = {
  limit: 30,
  tier: 'guest' as UserTier,
};

// Warning threshold for guest data expiration
const EXPIRATION_WARNING_DAYS = 14;

/**
 * Quota status with computed fields
 */
export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  isLimitReached: boolean;
  resetsAt: string | null;
  tier: UserTier;
  isGuest: boolean;
  guestExpiration: GuestExpirationInfo | null;
  showExpirationWarning: boolean;
}

// FSM State
export type QuotaState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; quota: QuotaResponse }
  | { status: 'error'; error: string; cachedQuota?: QuotaResponse };

export interface QuotaActions {
  startFetch: () => void;
  fetchSuccess: (quota: QuotaResponse) => void;
  fetchError: (error: string) => void;
  getQuotaStatus: () => QuotaStatus;
}

export type QuotaStore = QuotaState & QuotaActions;

// Helper to compute guest fields
function computeGuestFields(quota: QuotaResponse | undefined) {
  if (!quota) {
    return {
      isGuest: true,
      guestExpiration: null,
      showExpirationWarning: false,
    };
  }

  const isGuest = quota.tier === 'guest';
  const guestExpiration = quota.guest || null;
  const showExpirationWarning =
    isGuest &&
    guestExpiration !== null &&
    guestExpiration.daysUntilExpiration <= EXPIRATION_WARNING_DAYS;

  return { isGuest, guestExpiration, showExpirationWarning };
}

// Create vanilla store
export const quotaStore = createStore<QuotaStore>((set, get) => ({
  // Initial state
  status: 'idle',

  // Actions
  startFetch: () => set({ status: 'loading' }),

  fetchSuccess: (quota) => set({ status: 'success', quota }),

  fetchError: (error) => {
    const current = get();
    set({
      status: 'error',
      error,
      cachedQuota: current.status === 'success' ? current.quota : undefined,
    });
  },

  // Computed quota status
  getQuotaStatus: () => {
    const state = get();

    if (state.status === 'success') {
      const guestFields = computeGuestFields(state.quota);
      return {
        used: state.quota.used,
        limit: state.quota.limit,
        remaining: state.quota.remaining,
        isLimitReached: state.quota.remaining <= 0,
        resetsAt: state.quota.resetsAt,
        tier: state.quota.tier,
        ...guestFields,
      };
    }

    if (state.status === 'error' && state.cachedQuota) {
      const guestFields = computeGuestFields(state.cachedQuota);
      return {
        used: state.cachedQuota.used,
        limit: state.cachedQuota.limit,
        remaining: state.cachedQuota.remaining,
        isLimitReached: state.cachedQuota.remaining <= 0,
        resetsAt: state.cachedQuota.resetsAt,
        tier: state.cachedQuota.tier,
        ...guestFields,
      };
    }

    // Default for loading/idle/error-without-cache
    return {
      used: 0,
      limit: DEFAULTS.limit,
      remaining: DEFAULTS.limit,
      isLimitReached: false,
      resetsAt: null,
      tier: DEFAULTS.tier,
      isGuest: true,
      guestExpiration: null,
      showExpirationWarning: false,
    };
  },
}));
