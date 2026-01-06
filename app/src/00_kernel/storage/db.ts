// Database Connection Management
// Singleton pattern for SQLite connection

import Database from '@tauri-apps/plugin-sql';
import { logger, EVENTS } from '../telemetry';
import { runMigrations } from './migrations';

const DB_NAME = 'sqlite:yorutsuke.db';

let db: Database | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Get database connection (lazy initialization)
 * Ensures singleton pattern - only one connection per app
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
 * Safe to call multiple times (idempotent)
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
      logger.info(EVENTS.DB_INITIALIZED, { name: DB_NAME, phase: 'start' });

      db = await Database.load(DB_NAME);

      // Run all migrations
      await runMigrations(db);

      logger.info(EVENTS.DB_INITIALIZED, { name: DB_NAME, phase: 'complete' });
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
 * Clear all user data from database (for debug/reset)
 * Preserves schema version and settings structure
 * Returns count of deleted rows per table
 */
export async function clearAllData(): Promise<Record<string, number>> {
  const database = await getDb();
  const results: Record<string, number> = {};

  // Tables to clear (order matters for foreign keys)
  const tables = ['images', 'transactions', 'settings'];

  // Delete from each table individually (no transaction needed for simple deletes)
  for (const table of tables) {
    try {
      const result = await database.execute(`DELETE FROM ${table}`);
      results[table] = result.rowsAffected ?? 0;
    } catch (error) {
      // Table might not exist, that's ok
      logger.debug('db_clear_table_skip', { table, error: String(error) });
      results[table] = 0;
    }
  }

  logger.info('db_data_cleared', results);
  return results;
}
