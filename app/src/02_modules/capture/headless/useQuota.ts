// Pillar L: Headless - logic without UI
// Pillar D: FSM - no boolean flags
import { useReducer, useCallback, useEffect } from 'react';
import type { UserId } from '../../../00_kernel/types';
import { fetchQuota, type QuotaResponse, type UserTier, type GuestExpirationInfo } from '../adapters/quotaApi';

// Default values for offline/guest mode
const DEFAULTS = {
  limit: 30,        // Guest tier default
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
  // Guest-specific fields
  isGuest: boolean;
  guestExpiration: GuestExpirationInfo | null;
  showExpirationWarning: boolean;
}

// FSM State
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; quota: QuotaResponse }
  | { status: 'error'; error: string; cachedQuota?: QuotaResponse };

type Action =
  | { type: 'FETCH' }
  | { type: 'FETCH_SUCCESS'; quota: QuotaResponse }
  | { type: 'FETCH_ERROR'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH':
      return { status: 'loading' };
    case 'FETCH_SUCCESS':
      return { status: 'success', quota: action.quota };
    case 'FETCH_ERROR':
      // Keep cached quota on error
      return {
        status: 'error',
        error: action.error,
        cachedQuota: state.status === 'success' ? state.quota : undefined,
      };
    default:
      return state;
  }
}

/**
 * Hook for quota management
 * Returns current quota status and refresh function
 */
export function useQuota(userId: UserId | null) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  const refresh = useCallback(async () => {
    if (!userId) return;

    dispatch({ type: 'FETCH' });
    try {
      const quota = await fetchQuota(userId);
      dispatch({ type: 'FETCH_SUCCESS', quota });
    } catch (e) {
      dispatch({ type: 'FETCH_ERROR', error: String(e) });
    }
  }, [userId]);

  // Auto-refresh on mount and when userId changes
  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [userId, refresh]);

  // Helper to compute guest fields
  const computeGuestFields = (quota: QuotaResponse | undefined) => {
    if (!quota) {
      return {
        isGuest: true, // Default to guest
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
  };

  // Compute quota status with defaults
  const quotaStatus: QuotaStatus = (() => {
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
  })();

  return {
    state,
    quota: quotaStatus,
    refresh,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    error: state.status === 'error' ? state.error : null,
  };
}
