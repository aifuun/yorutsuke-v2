/**
 * Sync Module - Public API
 * Unified cloud synchronization for all data types
 */

// Coordinator - Unified entry point
export { fullSync, pushTransactions, pullTransactions } from './services/syncCoordinator';
export type { FullSyncResult } from './services/syncCoordinator';

// Auto-sync service (debounced push after local operations)
export { autoSyncService } from './services/autoSyncService';

// Individual services (advanced usage)
export { transactionPushService } from './services/transactionPushService';
export { pullTransactions as transactionPullService } from './services/transactionPullService';
export { recoveryService } from './services/recoveryService';
export type { RecoveryStatus } from './services/recoveryService';

// Types
export type { PushSyncResult } from './services/transactionPushService';
export type { PullSyncResult } from './services/transactionPullService';
export type { ImageSyncResult } from './services/imageSyncService';

// Store and utils
export { useSyncStore } from './stores/syncStore';
export type { SyncStatus, SyncAction } from './stores/syncStore';
export { networkMonitor } from './utils/networkMonitor';

// Components
export { SyncStatusIndicator, RecoveryPrompt } from './components';
