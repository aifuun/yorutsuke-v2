// Database Connection Management
// Singleton pattern for SQLite connection

import Database from '@tauri-apps/plugin-sql';
import { logger } from '../telemetry';
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
      logger.info('[Storage] Initializing database', { name: DB_NAME });

      db = await Database.load(DB_NAME);

      // Run all migrations
      await runMigrations(db);

      logger.info('[Storage] Database initialized successfully');
    } catch (error) {
      logger.error('[Storage] Failed to initialize database', {
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
    logger.info('[Storage] Database connection closed');
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
  logger.debug('[Storage] Transaction started');

  try {
    const result = await fn(database);
    await database.execute('COMMIT');
    logger.debug('[Storage] Transaction committed');
    return result;
  } catch (error) {
    await database.execute('ROLLBACK');
    logger.warn('[Storage] Transaction rolled back', { error: String(error) });
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
