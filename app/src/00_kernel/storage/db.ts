// Database Connection Management
// Dual-database pattern with dynamic selection based on mock mode
// Production db = real application data (always initialized)
// Mock db = development test data (initialized if needed)
//
// Startup flow:
// 1. loadMockMode() - reads mock_mode from production db
// 2. initDb() - initializes both production and mock databases
// 3. getDb() - dynamically returns production or mock based on isMockingOnline()
//
// This allows runtime mode switching without restarting the app.
// When user toggles mock mode in Debug panel, subsequent queries use the correct db.

import Database from '@tauri-apps/plugin-sql';
import { logger, EVENTS } from '../telemetry';
import { runMigrations } from './migrations';
import { isMockingOnline } from '../config/mock';

const PRODUCTION_DB = 'sqlite:yorutsuke.db';
const MOCK_DB = 'sqlite:yorutsuke-mock.db';

let productionDb: Database | null = null;
let mockDb: Database | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Get appropriate database connection based on current mock mode
 * Returns production db in production mode, mock db in mock mode
 * Ensures queries always use the correct database without app restart
 *
 * @example
 * const db = await getDb();
 * const rows = await db.select<ImageRow[]>('SELECT * FROM images');
 */
export async function getDb(): Promise<Database> {
  if (!productionDb) {
    await initDb();
  }

  // Dynamically select database based on current mock mode
  // This allows runtime mode switching in Debug panel
  if (isMockingOnline()) {
    if (!mockDb) {
      // FIX: Use getMockDb() instead of initDb() to properly initialize mock database
      return getMockDb();
    }
    return mockDb!;
  }

  return productionDb!;
}

/**
 * Initialize database connections and run migrations
 * Initializes both production and mock databases
 * Safe to call multiple times (idempotent)
 *
 * Production db is always initialized (settings are stored there)
 * Mock db is initialized on-demand for lazy loading
 */
export async function initDb(): Promise<void> {
  // Prevent concurrent initialization
  if (initPromise) {
    return initPromise;
  }

  if (productionDb) {
    return;
  }

  initPromise = (async () => {
    try {
      // Always initialize production database first
      // Settings (including mock_mode) are stored in production db
      logger.info(EVENTS.DB_INITIALIZED, {
        path: PRODUCTION_DB,
        mode: 'production',
        phase: 'start'
      });

      productionDb = await Database.load(PRODUCTION_DB);
      await runMigrations(productionDb);

      logger.info(EVENTS.DB_INITIALIZED, {
        path: PRODUCTION_DB,
        mode: 'production',
        phase: 'complete'
      });

      // Initialize mock database on-demand (lazy)
      // It will be created when getDb() is called in mock mode
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
 * Close database connections
 * Call this on app shutdown
 */
export async function closeDb(): Promise<void> {
  if (productionDb) {
    await productionDb.close();
    productionDb = null;
  }
  if (mockDb) {
    await mockDb.close();
    mockDb = null;
  }
  initPromise = null;
  logger.info('db_connections_closed');
}

/**
 * Get mock database connection
 * Initializes on-demand if needed
 * Used both for seeding and for regular queries in mock mode via getDb()
 *
 * @internal
 */
export async function getMockDb(): Promise<Database> {
  if (!mockDb) {
    try {
      logger.debug('mock_db_initializing', { phase: 'start' });
      mockDb = await Database.load(MOCK_DB);
      await runMigrations(mockDb);
      logger.debug('mock_db_initializing', { phase: 'complete' });
    } catch (error) {
      logger.error(EVENTS.APP_ERROR, {
        component: 'mock_database',
        error: String(error),
      });
      throw error;
    }
  }
  return mockDb;
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
 * Settings are ALWAYS stored in production database, never in mock database
 * This is critical for loadMockMode() to work during app initialization
 *
 * @example
 * const theme = await getSetting('theme');
 */
export async function getSetting(key: string): Promise<string | null> {
  if (!productionDb) {
    await initDb();
  }
  const rows = await productionDb!.select<Array<{ value: string | null }>>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return rows[0]?.value ?? null;
}

/**
 * Set a setting value
 * Settings are ALWAYS stored in production database, never in mock database
 *
 * @example
 * await setSetting('theme', 'dark');
 */
export async function setSetting(key: string, value: string | null): Promise<void> {
  if (!productionDb) {
    await initDb();
  }
  await productionDb!.execute(
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
