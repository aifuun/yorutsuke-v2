/**
 * Sync Module Adapters - Public API
 * Pillar I: Firewalls - Single entry point for external dependencies
 *
 * All sync services MUST import from this file, never directly from
 * transaction or capture modules.
 */

// Transaction sync operations
export {
  fetchDirtyTransactions,
  clearDirtyFlags,
  fetchLocalTransactions,
  upsertLocalTransaction,
  syncTransactionsToCloud,
  fetchTransactionsFromCloud,
  checkFileExists,
} from './transactionSyncAdapter';

export type {
  SyncTransactionsResult,
  FetchTransactionsOptions,
} from './transactionSyncAdapter';

// Image sync operations
export {
  getImageById,
  updateImageS3Key,
  createImageRecord,
} from './imageSyncAdapter';

export type {
  CreateImageData,
} from './imageSyncAdapter';
