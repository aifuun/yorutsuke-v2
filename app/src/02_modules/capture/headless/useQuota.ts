// Pillar L: Headless - logic without UI
// Pillar D: FSM - no boolean flags
// @listen upload:complete - Refresh quota after successful upload
import { useReducer, useCallback, useEffect, useRef } from 'react';
import type { UserId } from '../../../00_kernel/types';
import { fetchQuota, type QuotaResponse, type UserTier, type GuestExpirationInfo } from '../adapters/quotaApi';
import { useAppEvent } from '../../../00_kernel/eventBus';
import { logger, EVENTS } from '../../../00_kernel/telemetry';

// Default values for offline/guest mode
const DEFAULTS = {
  limit: 30,        // Guest tier default
  tier: 'guest' as UserTier,
};

// Refresh intervals
const PERIODIC_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

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

  // Track if component is mounted to prevent refresh on unmounted component
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 1. Refresh after upload completes (immediate accuracy)
  // @listen upload:complete
  useAppEvent('upload:complete', () => {
    if (userId && isMountedRef.current) {
      logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'upload_complete' });
      refresh();
    }
  });

  // 2. Refresh after quota reset (debug action)
  // @listen quota:reset
  useAppEvent('quota:reset', () => {
    if (userId && isMountedRef.current) {
      logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'quota_reset' });
      refresh();
    }
  });

  // 2. Periodic refresh every 5 minutes (catch tier changes)
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      if (isMountedRef.current) {
        logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'periodic' });
        refresh();
      }
    }, PERIODIC_REFRESH_MS);

    return () => clearInterval(interval);
  }, [userId, refresh]);

  // 3. Refresh on app focus/visibility change (catch changes while away)
  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMountedRef.current) {
        logger.debug(EVENTS.QUOTA_REFRESHED, { trigger: 'visibility_change' });
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
