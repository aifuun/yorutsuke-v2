// Database Connection Management
// Singleton pattern for SQLite connection with mock db support
// Mock db = development database (separate from production)
// Production db = real data (single database)
//
// Startup flow:
// 1. loadMockMode() - reads mock_mode from production db
// 2. initDb() - opens correct db (production or mock) based on mode
// 3. All queries go to the selected db via getDb()

import Database from '@tauri-apps/plugin-sql';
import { logger, EVENTS } from '../telemetry';
import { runMigrations } from './migrations';
import { isMockingOnline } from '../config/mock';

const PRODUCTION_DB = 'sqlite:yorutsuke.db';
const MOCK_DB = 'sqlite:yorutsuke-mock.db';

let db: Database | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Get database connection (lazy initialization)
 * Ensures singleton pattern - only one connection per app
 * Uses production or mock db based on startup mock mode
 *
 * @example
 * const db = await getDb();
 * const rows = await db.select<ImageRow[]>('SELECT * FROM images');
 */
export async function getDb(): Promise<Database> {
  if (!db) {
    await initDb();
  }
  return db!;
}

/**
 * Initialize database connection and run migrations
 * Chooses between production and mock db based on current mockMode
 * Safe to call multiple times (idempotent)
 *
 * IMPORTANT: Must be called after loadMockMode() to use correct db
 */
export async function initDb(): Promise<void> {
  // Prevent concurrent initialization
  if (initPromise) {
    return initPromise;
  }

  if (db) {
    return;
  }

  initPromise = (async () => {
    try {
      // Select database based on mock mode
      // If mockMode = 'online' or 'offline', use mock db
      // Otherwise use production db
      const isMock = isMockingOnline();
      const dbPath = isMock ? MOCK_DB : PRODUCTION_DB;

      logger.info(EVENTS.DB_INITIALIZED, {
        path: dbPath,
        mode: isMock ? 'mock' : 'production',
        phase: 'start'
      });

      db = await Database.load(dbPath);

      // Run all migrations
      await runMigrations(db);

      logger.info(EVENTS.DB_INITIALIZED, {
        path: dbPath,
        mode: isMock ? 'mock' : 'production',
        phase: 'complete'
      });
    } catch (error) {
      logger.error(EVENTS.APP_ERROR, {
        component: 'database',
        error: String(error),
      });
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Close database connection
 * Call this on app shutdown
 */
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    initPromise = null;
    logger.info('db_connection_closed');
  }
}

/**
 * Get mock database explicitly (for seeding only)
 * Seeds ALWAYS write to mock db, regardless of current mock mode
 * This is safe because mock db is development-only
 *
 * @internal Use only in seed operations
 */
export async function getMockDb(): Promise<Database> {
  try {
    const mockDb = await Database.load(MOCK_DB);
    logger.debug('mock_db_opened', { for: 'seed_operation' });
    return mockDb;
  } catch (error) {
    logger.error(EVENTS.APP_ERROR, {
      component: 'mock_database',
      error: String(error),
    });
    throw error;
  }
}

/**
 * Execute multiple operations in a transaction
 * Automatically rolls back on error (Pillar F: Concurrency)
 *
 * @example
 * await withTransaction(async (db) => {
 *   await db.execute('UPDATE images SET status = ? WHERE id = ?', ['uploaded', id1]);
 *   await db.execute('UPDATE images SET status = ? WHERE id = ?', ['uploaded', id2]);
 * });
 */
export async function withTransaction<T>(
  fn: (db: Database) => Promise<T>
): Promise<T> {
  const database = await getDb();

  await database.execute('BEGIN TRANSACTION');
  logger.debug('db_transaction_started');

  try {
    const result = await fn(database);
    await database.execute('COMMIT');
    logger.debug('db_transaction_committed');
    return result;
  } catch (error) {
    await database.execute('ROLLBACK');
    logger.warn('db_transaction_rollback', { error: String(error) });
    throw error;
  }
}

/**
 * Execute a query and return affected rows count
 * Use for INSERT, UPDATE, DELETE
 *
 * @example
 * const result = await execute(
 *   'UPDATE images SET status = ? WHERE id = ?',
 *   ['uploaded', imageId]
 * );
 */
export async function execute(
  query: string,
  params: unknown[] = []
): Promise<{ rowsAffected: number; lastInsertId: number }> {
  const database = await getDb();
  const result = await database.execute(query, params);
  return {
    rowsAffected: result.rowsAffected ?? 0,
    lastInsertId: result.lastInsertId ?? 0,
  };
}

/**
 * Execute a SELECT query and return typed rows
 *
 * @example
 * const images = await select<ImageRow[]>(
 *   'SELECT * FROM images WHERE status = ?',
 *   ['pending']
 * );
 */
export async function select<T>(
  query: string,
  params: unknown[] = []
): Promise<T> {
  const database = await getDb();
  return database.select<T>(query, params);
}

/**
 * Get a single setting value
 *
 * @example
 * const theme = await getSetting('theme');
 */
export async function getSetting(key: string): Promise<string | null> {
  const rows = await select<Array<{ value: string | null }>>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return rows[0]?.value ?? null;
}

/**
 * Set a setting value
 *
 * @example
 * await setSetting('theme', 'dark');
 */
export async function setSetting(key: string, value: string | null): Promise<void> {
  await execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

/**
 * Get schema version from settings
 */
export async function getSchemaVersion(): Promise<number> {
  const version = await getSetting('schema_version');
  return version ? parseInt(version, 10) : 0;
}

/**
 * Set schema version in settings
 */
export async function setSchemaVersion(version: number): Promise<void> {
  await setSetting('schema_version', String(version));
}

/**
 * Clear business data from database (images, transactions, caches)
 * Preserves settings (language, theme, mock mode, etc.)
 * Returns count of deleted rows per table
 */
export async function clearBusinessData(): Promise<Record<string, number>> {
  const database = await getDb();
  const results: Record<string, number> = {};

  // Business data tables (order matters for foreign keys: delete children first)
  const tables = ['transactions', 'transactions_cache', 'morning_report_cache', 'analytics', 'images'];

  for (const table of tables) {
    try {
      const result = await database.execute(`DELETE FROM ${table}`);
      results[table] = result.rowsAffected ?? 0;
    } catch (error) {
      // Table might not exist yet, that's ok
      logger.debug('db_clear_table_skip', { table, error: String(error) });
      results[table] = 0;
    }
  }

  logger.info('db_business_data_cleared', results);
  return results;
}

/**
 * Clear settings from database (language, theme, mock mode, etc.)
 * Preserves schema_version for migrations
 * Returns count of deleted settings
 */
export async function clearSettings(): Promise<number> {
  const database = await getDb();

  try {
    // Keep schema_version, clear everything else
    const result = await database.execute(
      `DELETE FROM settings WHERE key != 'schema_version'`
    );
    const count = result.rowsAffected ?? 0;
    logger.info('db_settings_cleared', { count });
    return count;
  } catch (error) {
    logger.debug('db_clear_settings_skip', { error: String(error) });
    return 0;
  }
}
