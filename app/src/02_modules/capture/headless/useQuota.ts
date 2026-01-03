// Pillar L: Headless - logic without UI
// Pillar D: FSM - no boolean flags
import { useReducer, useCallback, useEffect } from 'react';
import type { UserId } from '../../../00_kernel/types';
import { fetchQuota, type QuotaResponse } from '../adapters/quotaApi';

// Default values for offline/guest mode
const DEFAULTS = {
  limit: 30,        // Guest tier default
  intervalMs: 2000, // Rate limit
};

/**
 * Quota status with computed fields
 */
export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  isLimitReached: boolean;
  resetsAt: string | null;
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

  // Compute quota status with defaults
  const quotaStatus: QuotaStatus = (() => {
    if (state.status === 'success') {
      return {
        used: state.quota.used,
        limit: state.quota.limit,
        remaining: state.quota.remaining,
        isLimitReached: state.quota.remaining <= 0,
        resetsAt: state.quota.resetsAt,
      };
    }
    if (state.status === 'error' && state.cachedQuota) {
      return {
        used: state.cachedQuota.used,
        limit: state.cachedQuota.limit,
        remaining: state.cachedQuota.remaining,
        isLimitReached: state.cachedQuota.remaining <= 0,
        resetsAt: state.cachedQuota.resetsAt,
      };
    }
    // Default for loading/idle/error-without-cache
    return {
      used: 0,
      limit: DEFAULTS.limit,
      remaining: DEFAULTS.limit,
      isLimitReached: false,
      resetsAt: null,
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
