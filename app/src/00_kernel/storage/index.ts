/**
 * @module Storage
 * @exposes [getDb, initDb, closeDb, withTransaction, execute, select, getSetting, setSetting]
 * @depends [@tauri-apps/plugin-sql]
 *
 * SQLite database connection and schema management.
 * Uses singleton pattern for connection reuse.
 */

export {
  getDb,
  initDb,
  closeDb,
  withTransaction,
  execute,
  select,
  getSetting,
  setSetting,
  getSchemaVersion,
  setSchemaVersion,
} from './db';

export { runMigrations, safeAddColumn } from './migrations';

export type {
  ImageRow,
  TransactionCacheRow,
  MorningReportCacheRow,
  SettingRow,
  AnalyticsRow,
  ImageStatus,
  ImageLocation,
} from './types';

export { toImageId, toTransactionId } from './types';
