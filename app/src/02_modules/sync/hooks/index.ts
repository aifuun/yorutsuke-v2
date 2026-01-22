/**
 * Sync Module Hooks - Public API
 * Hook Bridge Layer (Layer 1.5) per ADR-020
 */

// State hooks (Connector + Selector identities)
export {
  useSyncStatus,
  useIsOnline,
  useLastSyncedAt,
  usePendingCount,
  useIsSyncing,
  useHasError,
  useSyncError,
  // Actions (Orchestrator identity)
  useSyncActions,
} from './useSyncState';

export type { SyncActions } from './useSyncState';

// Auto-sync trigger (existing hook)
export { useSyncTrigger } from './useSyncTrigger';
