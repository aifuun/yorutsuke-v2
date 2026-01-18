// Database Migrations
// Idempotent schema updates with version tracking

import type Database from '@tauri-apps/plugin-sql';
import { logger, EVENTS } from '../telemetry';

// Current schema version - increment when adding migrations
const CURRENT_VERSION = 10;

/**
 * Run all migrations on database
 * Safe to call multiple times (idempotent)
 */
export async function runMigrations(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { phase: 'start' });

  // Create core tables first
  await createCoreTables(db);

  // Get current version
  const version = await getVersion(db);
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { phase: 'check', current: version, target: CURRENT_VERSION });

  // Run migrations in order
  if (version < 1) {
    await migration_v1(db);
    await setVersion(db, 1);
  }

  if (version < 2) {
    await migration_v2(db);
    await setVersion(db, 2);
  }

  if (version < 3) {
    await migration_v3(db);
    await setVersion(db, 3);
  }

  if (version < 4) {
    await migration_v4(db);
    await setVersion(db, 4);
  }

  if (version < 5) {
    await migration_v5(db);
    await setVersion(db, 5);
  }

  if (version < 6) {
    await migration_v6(db);
    await setVersion(db, 6);
  }

  if (version < 7) {
    await migration_v7(db);
    await setVersion(db, 7);
  }

  if (version < 8) {
    await migration_v8(db);
    await setVersion(db, 8);
  }

  if (version < 9) {
    await migration_v9(db);
    await setVersion(db, 9);
  }

  if (version < 10) {
    await migration_v10(db);
    await setVersion(db, 10);
  }

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { phase: 'complete', version: CURRENT_VERSION });
}

/**
 * Create core tables (idempotent with IF NOT EXISTS)
 */
async function createCoreTables(db: Database): Promise<void> {
  // Settings table (needed for version tracking)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Images table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      original_path TEXT NOT NULL,
      compressed_path TEXT,
      original_size INTEGER,
      compressed_size INTEGER,
      width INTEGER,
      height INTEGER,
      md5 TEXT,
      status TEXT DEFAULT 'pending',
      s3_key TEXT,
      ref_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Transaction cache table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions_cache (
      id TEXT PRIMARY KEY,
      image_id TEXT,
      amount INTEGER,
      merchant TEXT,
      category TEXT,
      receipt_datetime TEXT,
      ai_confidence REAL,
      ai_result TEXT,
      status TEXT,
      image_location TEXT DEFAULT 'both',
      image_deleted_at TEXT,
      s3_key TEXT,
      synced_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (image_id) REFERENCES images(id)
    )
  `);

  // Transactions table (synced from cloud)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      image_id TEXT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'JPY',
      description TEXT,
      merchant TEXT,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      confirmed_at TEXT,
      confidence REAL,
      raw_text TEXT,
      FOREIGN KEY (image_id) REFERENCES images(id)
    )
  `);

  // Morning report cache table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS morning_report_cache (
      report_date TEXT PRIMARY KEY,
      data TEXT,
      synced_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Analytics events table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  logger.debug('db_core_tables_created');
}

/**
 * Migration v1: Add indexes for performance
 */
async function migration_v1(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 1, name: 'add_indexes', phase: 'start' });

  // Images indexes
  await safeCreateIndex(db, 'idx_images_status', 'images', 'status');
  await safeCreateIndex(db, 'idx_images_md5', 'images', 'md5');
  await safeCreateIndex(db, 'idx_images_ref_count', 'images', 'ref_count');
  await safeCreateIndex(db, 'idx_images_s3_key', 'images', 's3_key');

  // Transaction cache indexes
  await safeCreateIndex(db, 'idx_transactions_cache_image_id', 'transactions_cache', 'image_id');
  await safeCreateIndex(db, 'idx_transactions_cache_synced_at', 'transactions_cache', 'synced_at');

  // Transactions table indexes
  await safeCreateIndex(db, 'idx_transactions_user_id', 'transactions', 'user_id');
  await safeCreateIndex(db, 'idx_transactions_date', 'transactions', 'date');
  await safeCreateIndex(db, 'idx_transactions_image_id', 'transactions', 'image_id');

  // Initialize default settings
  await db.execute(`
    INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_delete_days', NULL)
  `);
  await db.execute(`
    INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'en')
  `);
  await db.execute(`
    INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark')
  `);

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 1, phase: 'complete' });
}

/**
 * Migration v2: Add trace_id and intent_id to images table
 * Pillar N: TraceId for observability
 * Pillar Q: IntentId for idempotency
 */
async function migration_v2(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 2, name: 'add_trace_intent_id', phase: 'start' });

  // Add trace_id column (Pillar N)
  await safeAddColumn(db, 'images', 'trace_id', 'TEXT');
  await safeCreateIndex(db, 'idx_images_trace_id', 'images', 'trace_id');

  // Add intent_id column (Pillar Q)
  await safeAddColumn(db, 'images', 'intent_id', 'TEXT');
  await safeCreateIndex(db, 'idx_images_intent_id', 'images', 'intent_id');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 2, phase: 'complete' });
}

/**
 * Migration v3: Add user_id to images table
 * Fixes #48: Multi-user data isolation
 */
async function migration_v3(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 3, name: 'add_user_id', phase: 'start' });

  // Add user_id column for multi-user support
  await safeAddColumn(db, 'images', 'user_id', 'TEXT');
  await safeCreateIndex(db, 'idx_images_user_id', 'images', 'user_id');

  // Add uploaded_at column for quota calculation
  await safeAddColumn(db, 'images', 'uploaded_at', 'TEXT');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 3, phase: 'complete' });
}

/**
 * Migration v4: Add error column to images table
 * Fixes state inconsistency: failed status persists with error message
 */
async function migration_v4(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 4, name: 'add_error_column', phase: 'start' });

  // Add error column for storing failure reason
  await safeAddColumn(db, 'images', 'error', 'TEXT');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 4, phase: 'complete' });
}

/**
 * Migration v5: Add original_name column to images table
 * Stores the original filename from drag-drop/paste for UI display
 */
async function migration_v5(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 5, name: 'add_original_name', phase: 'start' });

  // Add original_name column for filename display
  await safeAddColumn(db, 'images', 'original_name', 'TEXT');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 5, phase: 'complete' });
}

/**
 * Migration v6: Add status and version columns to transactions table
 * Issue #108: Cloud Sync for Transactions
 * - status: Track transaction state (unconfirmed/confirmed/deleted/needs_review)
 * - version: Support optimistic locking for future conflict resolution
 */
async function migration_v6(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 6, name: 'add_transaction_sync_fields', phase: 'start' });

  // Add status column (default: unconfirmed for existing transactions)
  await safeAddColumn(db, 'transactions', 'status', 'TEXT DEFAULT \'unconfirmed\'');

  // Add version column (default: 1 for existing transactions)
  await safeAddColumn(db, 'transactions', 'version', 'INTEGER DEFAULT 1');

  // Create index for status filtering
  await safeCreateIndex(db, 'idx_transactions_status', 'transactions', 'status');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 6, phase: 'complete' });
}

/**
 * Migration v7: Remove foreign key constraint from transactions table
 * Issue #108: Cloud Sync for Transactions
 *
 * Root cause: FOREIGN KEY constraint failed when syncing transactions
 * - Cloud transactions reference images that don't exist locally
 * - Images may be deleted, from other devices, or guest→user migration
 * - Cloud retention is longer than local image retention
 *
 * Solution: Drop foreign key, keep image_id as soft reference
 * - Transactions can exist without their source images
 * - image_id column remains for reference (nullable)
 */
async function migration_v7(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 7, name: 'remove_transaction_fk', phase: 'start' });

  // SQLite doesn't support DROP FOREIGN KEY, so we need to recreate the table
  // Step 1: Create new table without foreign key
  await db.execute(`
    CREATE TABLE transactions_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      image_id TEXT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'JPY',
      description TEXT,
      merchant TEXT,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      confirmed_at TEXT,
      confidence REAL,
      raw_text TEXT,
      status TEXT DEFAULT 'unconfirmed',
      version INTEGER DEFAULT 1
    )
  `);

  // Step 2: Copy all data from old table
  await db.execute(`
    INSERT INTO transactions_new
    SELECT id, user_id, image_id, type, category, amount, currency,
           description, merchant, date, created_at, updated_at,
           confirmed_at, confidence, raw_text, status, version
    FROM transactions
  `);

  // Step 3: Drop old table
  await db.execute('DROP TABLE transactions');

  // Step 4: Rename new table
  await db.execute('ALTER TABLE transactions_new RENAME TO transactions');

  // Step 5: Recreate indexes
  await safeCreateIndex(db, 'idx_transactions_user_id', 'transactions', 'user_id');
  await safeCreateIndex(db, 'idx_transactions_date', 'transactions', 'date');
  await safeCreateIndex(db, 'idx_transactions_image_id', 'transactions', 'image_id');
  await safeCreateIndex(db, 'idx_transactions_status', 'transactions', 'status');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 7, phase: 'complete' });
}

/**
 * Migration v8: Add dirty_sync column to transactions
 * Issue #109: Transaction Management UX - Confirm/Delete sync preparation
 *
 * Purpose: Track transactions that have local changes needing cloud sync
 * - dirty_sync = true: Has unsynced local changes (confirm, delete)
 * - dirty_sync = false: Synced with cloud or no local changes
 *
 * MVP4: Mark transactions with dirty flag
 * MVP5: Implement bidirectional sync (push dirty transactions to cloud)
 */
async function migration_v8(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 8, name: 'add_dirty_sync', phase: 'start' });

  // Add dirty_sync column (default false = no pending changes)
  await safeAddColumn(db, 'transactions', 'dirty_sync', 'INTEGER DEFAULT 0');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 8, phase: 'complete' });
}

/**
 * Migration v9: Add s3_key column to transactions
 * Issue #109: Image sync optimization
 *
 * Purpose: Store S3 key with transaction for efficient image sync
 * - When syncing from cloud, save s3_key in transaction record
 * - Image sync service checks local images first, uses s3_key for download if needed
 * - Avoids redundant S3 downloads when image already exists locally
 */
async function migration_v9(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 9, name: 'add_s3_key_to_transactions', phase: 'start' });

  // Add s3_key column (nullable - not all transactions have images)
  await safeAddColumn(db, 'transactions', 's3_key', 'TEXT');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 9, phase: 'complete' });
}

/**
 * Migration v10: Add Model Metadata (Issue #151)
 * Purpose: Track which AI model processed each transaction + confidence score
 * - primary_model_id: e.g., 'us.amazon.nova-lite-v1:0', 'azure_di'
 * - primary_confidence: 0-100 confidence score (if available)
 */
async function migration_v10(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, {
    version: 10,
    name: 'add_model_metadata',
    phase: 'start'
  });

  // Add primary_model_id column (nullable - old transactions won't have this)
  await safeAddColumn(db, 'transactions', 'primary_model_id', 'TEXT');

  // Add primary_confidence column (nullable - not all models return confidence)
  await safeAddColumn(db, 'transactions', 'primary_confidence', 'REAL');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 10, phase: 'complete' });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get schema version from settings table
 */
async function getVersion(db: Database): Promise<number> {
  try {
    const rows = await db.select<Array<{ value: string | null }>>(
      'SELECT value FROM settings WHERE key = ?',
      ['schema_version']
    );
    return rows[0]?.value ? parseInt(rows[0].value, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Set schema version in settings table
 */
async function setVersion(db: Database, version: number): Promise<void> {
  await db.execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['schema_version', String(version)]
  );
}

/**
 * Safely create an index (idempotent)
 */
async function safeCreateIndex(
  db: Database,
  indexName: string,
  tableName: string,
  columnName: string
): Promise<void> {
  try {
    await db.execute(
      `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columnName})`
    );
  } catch (error) {
    // Index might already exist with different definition
    logger.warn('db_index_create_failed', { index: indexName, error: String(error) });
  }
}

/**
 * Safely add a column (idempotent via error catch)
 * Use for future migrations
 */
export async function safeAddColumn(
  db: Database,
  tableName: string,
  columnName: string,
  columnDef: string
): Promise<void> {
  try {
    await db.execute(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`
    );
    logger.debug('db_column_added', { table: tableName, column: columnName });
  } catch {
    // Column already exists, ignore
    logger.debug('db_column_exists', { table: tableName, column: columnName });
  }
}
