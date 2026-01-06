// React hook to subscribe to quota store
// Pillar L: Bridge between Service layer and React

import { useStore } from 'zustand';
import { quotaStore, type QuotaStore, type QuotaState, type QuotaStatus } from '../stores/quotaStore';

/**
 * Subscribe to full quota state
 */
export function useQuotaState(): QuotaStore {
  return useStore(quotaStore);
}

/**
 * Subscribe to quota status (computed values)
 */
export function useQuotaStatus(): QuotaStatus {
  return useStore(quotaStore, (state) => state.getQuotaStatus());
}

/**
 * Subscribe to loading/error status
 */
export function useQuotaFetchStatus(): {
  isLoading: boolean;
  isError: boolean;
  error: string | null;
} {
  return useStore(quotaStore, (state: QuotaState) => ({
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    error: state.status === 'error' ? state.error : null,
  }));
}

/**
 * Combined quota hook for views
 * Returns quota status with loading/error states
 */
export function useQuota() {
  const quota = useQuotaStatus();
  const { isLoading, isError, error } = useQuotaFetchStatus();

  return {
    quota,
    isLoading,
    isError,
    error,
  };
}
