/**
 * Sync Module - Public API (Issue #167)
 * 4.5-Layer Architecture: Views → Hook Bridge → Services → Adapters → Tauri/AWS
 *
 * Unified cloud synchronization for all data types
 */

// ============================================================================
// Layer 1: Views
// ============================================================================

export { SyncStatusIndicator, RecoveryPrompt } from './views';

// ============================================================================
// Layer 1.5: Hook Bridge Layer (ADR-020)
// ============================================================================

/**
 * Sync State Hooks - Hook Bridge Layer
 *
 * Identity 1 (Connector): useStore(syncStore, selector)
 * Identity 2 (Selector): Extract primitives (ADR-012 compliance)
 * Identity 3 (Orchestrator): Coordinate services, UI-specific logic
 */
export {
  // Connector + Selector hooks (primitives only)
  useSyncStatus,
  useIsOnline,
  useLastSyncedAt,
  usePendingCount,
  useIsSyncing,
  useHasError,
  useSyncError,
  // Manual Sync Service hooks (ADR-020)
  useManualSyncStatus,
  useManualSyncLastSyncedAt,
  useIsManualSyncing,
  useManualSyncError,
  // Orchestrator hooks (actions)
  useSyncActions,
} from './hooks/useSyncState';

/**
 * Sync Trigger Hook - UI-specific orchestration
 */
export { useSyncTrigger } from './hooks/useSyncTrigger';

// ============================================================================
// Layer 2: Stores (Vanilla Zustand)
// ============================================================================

/**
 * Sync Store - Framework-agnostic state container
 *
 * For React: Use hooks from Layer 1.5
 * For Services: Use store.getState() and actions directly
 */
export { syncStore } from './stores/syncStore';
export type {
  SyncStore,
  SyncState,
  SyncActions,
  SyncStatus,
  SyncAction,
} from './stores/syncStore';

// ============================================================================
// Layer 2: Services (Business Logic)
// ============================================================================

/**
 * Coordinator - Unified entry point for full sync
 */
export { fullSync, pushTransactions, pullTransactions } from './services/syncCoordinator';
export type { FullSyncResult } from './services/syncCoordinator';

/**
 * Auto-sync service (debounced push after local operations)
 */
export { autoSyncService } from './services/autoSyncService';

/**
 * Manual sync service (user-triggered sync with UI state)
 */
export { manualSyncService } from './services/manualSyncService';

/**
 * Individual services (advanced usage)
 */
export { transactionPushService } from './services/transactionPushService';
export { pullTransactions as transactionPullService } from './services/transactionPullService';
export { recoveryService } from './services/recoveryService';
export type { RecoveryStatus } from './services/recoveryService';

/**
 * Service result types
 */
export type { PushSyncResult } from './services/transactionPushService';
export type { PullSyncResult } from './services/transactionPullService';
export type { ImageSyncResult } from './services/imageSyncService';

// ============================================================================
// Layer 3: Adapters (IO Boundary / Firewall)
// ============================================================================

/**
 * Transaction Sync Adapter - Firewall boundary per Pillar I
 *
 * Wraps transaction module adapters to prevent direct imports (ADR-020)
 */
export {
  fetchDirtyTransactions,
  clearDirtyFlags,
  syncTransactionsToCloud,
  fetchTransactionsFromCloud,
  fetchLocalTransactions,
  upsertLocalTransaction,
  checkFileExists,
} from './adapters/transactionSyncAdapter';

/**
 * Image Sync Adapter - Firewall boundary per Pillar I
 *
 * Wraps capture module adapters for sync operations
 */
export {
  getImageById,
  updateImageS3Key,
  createImageRecord,
} from './adapters/imageSyncAdapter';

// ============================================================================
// Layer 4: Utils (Cross-cutting concerns)
// ============================================================================

/**
 * Network Monitor - Global network status tracker
 */
export { networkMonitor } from './utils/networkMonitor';
