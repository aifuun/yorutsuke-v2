// React hook to subscribe to quota store
// Pillar L: Bridge between Service layer and React

import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { quotaStore, type QuotaStore, type QuotaStatus } from '../stores/quotaStore';

/**
 * Subscribe to full quota state
 */
export function useQuotaState(): QuotaStore {
  return useStore(quotaStore);
}

/**
 * Subscribe to quota status (computed values)
 * Uses shallow comparison to prevent infinite re-renders
 */
export function useQuotaStatus(): QuotaStatus {
  return useStore(quotaStore, useShallow((state) => state.getQuotaStatus()));
}

/**
 * Combined quota hook for views
 * Returns quota status with loading/error states
 */
export function useQuota() {
  const state = useStore(quotaStore);
  const quota = state.getQuotaStatus();

  return {
    quota,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    error: state.status === 'error' ? state.error : null,
  };
}
