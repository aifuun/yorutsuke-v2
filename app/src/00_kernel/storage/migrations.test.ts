import { describe, it, expect, vi } from 'vitest';
import { runMigrations, safeAddColumn } from './migrations';
import type Database from '@tauri-apps/plugin-sql';

// Mock logger
vi.mock('../telemetry/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  EVENTS: {
    DB_MIGRATION_APPLIED: 'db_migration_applied',
  },
}));

/**
 * Create a mock database for testing migrations
 * Simulates SQLite behavior with in-memory state
 */
function createMockDatabase(): {
  db: Database;
  tables: Map<string, Array<{ name: string; type: string }>>;
  data: Map<string, Array<Record<string, unknown>>>;
} {
  const tables = new Map<string, Array<{ name: string; type: string }>>();
  const data = new Map<string, Array<Record<string, unknown>>>();

  // Initialize core tables
  tables.set('settings', [
    { name: 'key', type: 'TEXT' },
    { name: 'value', type: 'TEXT' },
  ]);
  tables.set('images', [
    { name: 'id', type: 'TEXT' },
    { name: 'original_path', type: 'TEXT' },
  ]);
  tables.set('transactions', [
    { name: 'id', type: 'TEXT' },
    { name: 'user_id', type: 'TEXT' },
    { name: 'amount', type: 'INTEGER' },
    { name: 'type', type: 'TEXT' },
    { name: 'date', type: 'TEXT' },
    { name: 'status', type: 'TEXT' },
  ]);

  data.set('settings', []);
  data.set('images', []);
  data.set('transactions', []);

  const db = {
    execute: vi.fn(async (sql: string, params?: unknown[]) => {
      // Handle CREATE TABLE
      if (sql.includes('CREATE TABLE IF NOT EXISTS')) {
        return [];
      }

      // Handle ALTER TABLE ADD COLUMN
      if (sql.includes('ALTER TABLE') && sql.includes('ADD COLUMN')) {
        const tableMatch = sql.match(/ALTER TABLE (\w+)/);
        const columnMatch = sql.match(/ADD COLUMN (\w+) (\w+)/);
        if (tableMatch && columnMatch) {
          const tableName = tableMatch[1];
          const columnName = columnMatch[1];
          const columnType = columnMatch[2];

          const columns = tables.get(tableName);
          if (columns) {
            // Check if column already exists
            if (columns.some((col) => col.name === columnName)) {
              throw new Error('duplicate column name');
            }
            columns.push({ name: columnName, type: columnType });
          }
        }
        return [];
      }

      // Handle INSERT OR REPLACE (for settings/version)
      if (sql.includes('INSERT OR REPLACE INTO settings')) {
        const settingsData = data.get('settings') || [];
        const key = params?.[0] as string;
        const value = params?.[1] as string;

        // Update existing or add new
        const existingIndex = settingsData.findIndex((row) => row.key === key);
        if (existingIndex >= 0) {
          settingsData[existingIndex] = { key, value };
        } else {
          settingsData.push({ key, value });
        }
        data.set('settings', settingsData);
        return [];
      }

      // Handle INSERT (for test data)
      if (sql.includes('INSERT INTO transactions')) {
        const txData = data.get('transactions') || [];
        // Extract column names from SQL
        const columnMatch = sql.match(/INSERT INTO transactions \(([^)]+)\)/);
        if (columnMatch && params) {
          const columnNames = columnMatch[1].split(',').map((col) => col.trim());
          const newRow: Record<string, unknown> = {};

          // Map params to column names
          columnNames.forEach((colName, idx) => {
            newRow[colName] = params[idx];
          });

          txData.push(newRow);
          data.set('transactions', txData);
        }
        return [];
      }

      return [];
    }),

    select: vi.fn(async <T>(sql: string, params?: unknown[]): Promise<T> => {
      // Handle PRAGMA table_info
      if (sql.includes('PRAGMA table_info')) {
        const tableMatch = sql.match(/table_info\((\w+)\)/);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const columns = tables.get(tableName);
          if (columns) {
            return columns.map((col, idx) => ({
              cid: idx,
              name: col.name,
              type: col.type,
              notnull: 0,
              dflt_value: null,
              pk: idx === 0 ? 1 : 0,
            })) as T;
          }
        }
        return [] as T;
      }

      // Handle SELECT value FROM settings
      if (sql.includes('SELECT value FROM settings')) {
        const settingsData = data.get('settings') || [];
        const key = params?.[0] as string;
        const row = settingsData.find((r) => r.key === key);
        return (row ? [{ value: row.value }] : []) as T;
      }

      // Handle SELECT from transactions
      if (sql.includes('SELECT') && sql.includes('FROM transactions')) {
        const txData = data.get('transactions') || [];
        if (sql.includes('WHERE id = ?')) {
          const id = params?.[0];
          const row = txData.find((r) => r.id === id);
          return (row ? [row] : []) as T;
        }
        return txData as T;
      }

      return [] as T;
    }),
  } as unknown as Database;

  return { db, tables, data };
}

/**
 * Set database to a specific migration version
 */
async function setMigrationVersion(
  db: Database,
  tables: Map<string, Array<{ name: string; type: string }>>,
  version: number
): Promise<void> {
  // Simulate migrations up to version
  if (version >= 8) {
    // v8 added dirty_sync
    const txColumns = tables.get('transactions');
    if (txColumns && !txColumns.some((col) => col.name === 'dirty_sync')) {
      txColumns.push({ name: 'dirty_sync', type: 'INTEGER' });
    }
  }
  if (version >= 9) {
    // v9 added s3_key
    const txColumns = tables.get('transactions');
    if (txColumns && !txColumns.some((col) => col.name === 's3_key')) {
      txColumns.push({ name: 's3_key', type: 'TEXT' });
    }
  }
  if (version >= 10) {
    // v10 added primary_model_id and primary_confidence
    const txColumns = tables.get('transactions');
    if (txColumns && !txColumns.some((col) => col.name === 'primary_model_id')) {
      txColumns.push({ name: 'primary_model_id', type: 'TEXT' });
    }
    if (txColumns && !txColumns.some((col) => col.name === 'primary_confidence')) {
      txColumns.push({ name: 'primary_confidence', type: 'REAL' });
    }
  }

  // Set version in settings
  await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
    'schema_version',
    String(version),
  ]);
}

describe('migrations', () => {
  describe('migration_v10', () => {
    it('TC-M10.1: Adds primary_model_id and primary_confidence columns', async () => {
      // Given: Fresh DB at v9
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 9);

      // When: Run migration v10 (via runMigrations)
      await runMigrations(db);

      // Then: Columns exist
      const txColumns = tables.get('transactions');
      expect(txColumns).toBeDefined();
      const columnNames = txColumns?.map((col) => col.name);
      expect(columnNames).toContain('primary_model_id');
      expect(columnNames).toContain('primary_confidence');
    });

    it('TC-M10.2: Migration is idempotent (safe to run twice)', async () => {
      // Given: DB already has v10 columns
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 9);

      // When: Run migration v10 twice
      await runMigrations(db); // First run
      await runMigrations(db); // Second run

      // Then: No error, columns still exist (not duplicated)
      const txColumns = tables.get('transactions');
      const primaryModelIdCount = txColumns?.filter((col) => col.name === 'primary_model_id').length;
      const primaryConfidenceCount = txColumns?.filter(
        (col) => col.name === 'primary_confidence'
      ).length;

      expect(primaryModelIdCount).toBe(1); // Only one column
      expect(primaryConfidenceCount).toBe(1);
    });

    it('TC-M10.3: Existing transactions retain data after migration', async () => {
      // Given: v9 DB with existing transactions
      const { db, tables, data } = createMockDatabase();
      await setMigrationVersion(db, tables, 9);

      // Insert existing transaction (before migration)
      const existingTx = {
        id: 'tx-1',
        user_id: 'user-1',
        amount: 1000,
        type: 'expense',
        date: '2026-01-01',
        status: 'confirmed',
      };
      data.get('transactions')?.push(existingTx);

      // When: Run migration v10
      await runMigrations(db);

      // Then: Old data preserved, new columns NULL
      const result = await db.select<Array<Record<string, unknown>>>(
        'SELECT * FROM transactions WHERE id = ?',
        ['tx-1']
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tx-1');
      expect(result[0].amount).toBe(1000);
      expect(result[0].primary_model_id).toBeUndefined(); // New columns not in old data
      expect(result[0].primary_confidence).toBeUndefined();
    });

    it('TC-M10.4: New transactions can write model metadata', async () => {
      // Given: v10 DB (fresh migration)
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 9);
      await runMigrations(db);

      // When: Insert transaction with model metadata
      const columns = tables.get('transactions');
      expect(columns?.some((col) => col.name === 'primary_model_id')).toBe(true);
      expect(columns?.some((col) => col.name === 'primary_confidence')).toBe(true);

      await db.execute(
        `INSERT INTO transactions (id, user_id, amount, type, date, status, primary_model_id, primary_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['tx-2', 'user-1', 2000, 'income', '2026-01-02', 'confirmed', 'us.amazon.nova-lite-v1:0', 85.5]
      );

      // Then: Model metadata stored correctly
      const result = await db.select<Array<Record<string, unknown>>>(
        'SELECT * FROM transactions WHERE id = ?',
        ['tx-2']
      );

      expect(result).toHaveLength(1);
      expect(result[0].primary_model_id).toBe('us.amazon.nova-lite-v1:0');
      expect(result[0].primary_confidence).toBe(85.5);
    });
  });

  describe('safeAddColumn', () => {
    it('TC-M10.5: safeAddColumn is idempotent (no error on duplicate)', async () => {
      // Given: Fresh table
      const { db, tables } = createMockDatabase();

      // When: Add column twice
      await safeAddColumn(db, 'transactions', 'test_column', 'TEXT');
      await safeAddColumn(db, 'transactions', 'test_column', 'TEXT'); // Should not throw

      // Then: Column exists (only once)
      const columns = tables.get('transactions');
      const testColumns = columns?.filter((col) => col.name === 'test_column');
      expect(testColumns?.length).toBe(1);
    });
  });

  describe('migration_v12', () => {
    it('TC-M12.1: Adds subtotal, tax_amount, and tax_rate columns (Issue #155)', async () => {
      // Given: Fresh DB at v11
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 11);

      // When: Run migration v12 (via runMigrations)
      await runMigrations(db);

      // Then: Three tax columns exist
      const txColumns = tables.get('transactions');
      expect(txColumns).toBeDefined();
      const columnNames = txColumns?.map((col) => col.name);
      expect(columnNames).toContain('subtotal');
      expect(columnNames).toContain('tax_amount');
      expect(columnNames).toContain('tax_rate');
    });

    it('TC-M12.2: Tax columns are correct types (for Japanese tax reporting)', async () => {
      // Given: Fresh DB at v11
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 11);

      // When: Run migration v12
      await runMigrations(db);

      // Then: Columns have correct types
      const txColumns = tables.get('transactions');
      const subtotalCol = txColumns?.find((col) => col.name === 'subtotal');
      const taxAmountCol = txColumns?.find((col) => col.name === 'tax_amount');
      const taxRateCol = txColumns?.find((col) => col.name === 'tax_rate');

      expect(subtotalCol?.type).toBe('INTEGER'); // Pre-tax amount in ¥
      expect(taxAmountCol?.type).toBe('INTEGER'); // Tax amount in ¥
      expect(taxRateCol?.type).toBe('REAL'); // Tax rate (8.0 or 10.0)
    });

    it('TC-M12.3: Migration is idempotent (safe to run twice)', async () => {
      // Given: DB already has v12 columns
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 11);

      // When: Run migration v12 twice
      await runMigrations(db); // First run
      await runMigrations(db); // Second run

      // Then: No error, columns still exist (not duplicated)
      const txColumns = tables.get('transactions');
      const subtotalCount = txColumns?.filter((col) => col.name === 'subtotal').length;
      const taxAmountCount = txColumns?.filter((col) => col.name === 'tax_amount').length;
      const taxRateCount = txColumns?.filter((col) => col.name === 'tax_rate').length;

      expect(subtotalCount).toBe(1); // Only one column
      expect(taxAmountCount).toBe(1);
      expect(taxRateCount).toBe(1);
    });

    it('TC-M12.4: Existing transactions retain data after migration', async () => {
      // Given: v11 DB with existing transactions
      const { db, tables, data } = createMockDatabase();
      await setMigrationVersion(db, tables, 11);

      // Insert existing transaction (before migration) - from KFC receipt scenario
      const existingTx = {
        id: 'tx-kfc-001',
        user_id: 'user-1',
        amount: 1950,
        type: 'expense',
        date: '2026-01-15',
        status: 'confirmed',
        primary_model_id: 'azure_di',
        primary_confidence: 68.9,
      };
      data.get('transactions')?.push(existingTx);

      // When: Run migration v12
      await runMigrations(db);

      // Then: Old data preserved, new columns NULL for existing records
      const result = await db.select<Array<Record<string, unknown>>>(
        'SELECT * FROM transactions WHERE id = ?',
        ['tx-kfc-001']
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tx-kfc-001');
      expect(result[0].amount).toBe(1950);
      expect(result[0].primary_model_id).toBe('azure_di');
      expect(result[0].subtotal).toBeUndefined(); // New columns not in old data
      expect(result[0].tax_amount).toBeUndefined();
      expect(result[0].tax_rate).toBeUndefined();
    });

    it('TC-M12.5: New transactions can write complete tax information', async () => {
      // Given: v12 DB (fresh migration)
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 11);
      await runMigrations(db);

      // When: Insert transaction with complete tax data (Big-A supermarket scenario)
      const columns = tables.get('transactions');
      expect(columns?.some((col) => col.name === 'subtotal')).toBe(true);
      expect(columns?.some((col) => col.name === 'tax_amount')).toBe(true);
      expect(columns?.some((col) => col.name === 'tax_rate')).toBe(true);

      await db.execute(
        `INSERT INTO transactions (id, user_id, amount, type, date, status, primary_model_id, primary_confidence, subtotal, tax_amount, tax_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['tx-biga-001', 'user-1', 1150, 'expense', '2026-01-14', 'confirmed', 'azure_di', 92.5, 1065, 85, 8.0]
      );

      // Then: Tax data stored correctly
      const result = await db.select<Array<Record<string, unknown>>>(
        'SELECT * FROM transactions WHERE id = ?',
        ['tx-biga-001']
      );

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(1150);
      expect(result[0].subtotal).toBe(1065); // Pre-tax: 1150 - 85 = 1065
      expect(result[0].tax_amount).toBe(85); // 8% of 1065 ≈ 85
      expect(result[0].tax_rate).toBe(8.0); // 8% consumption tax
    });

    it('TC-M12.6: New transactions can write partial tax information', async () => {
      // Given: v12 DB (fresh migration)
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 11);
      await runMigrations(db);

      // When: Insert transaction with only some tax fields
      await db.execute(
        `INSERT INTO transactions (id, user_id, amount, type, date, status, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['tx-partial-001', 'user-1', 1000, 'expense', '2026-01-13', 'confirmed', 950]
      );

      // Then: Partial tax data stored (tax_amount and tax_rate NULL)
      const result = await db.select<Array<Record<string, unknown>>>(
        'SELECT * FROM transactions WHERE id = ?',
        ['tx-partial-001']
      );

      expect(result).toHaveLength(1);
      expect(result[0].subtotal).toBe(950);
      expect(result[0].tax_amount).toBeUndefined(); // NULL (not provided)
      expect(result[0].tax_rate).toBeUndefined(); // NULL (not provided)
    });

    it('TC-M12.7: Tax fields support 10% rate (latest Japan consumption tax)', async () => {
      // Given: v12 DB (fresh migration)
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 11);
      await runMigrations(db);

      // When: Insert transaction with 10% tax rate
      await db.execute(
        `INSERT INTO transactions (id, user_id, amount, type, date, status, subtotal, tax_amount, tax_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['tx-10pct-001', 'user-1', 1100, 'expense', '2026-01-12', 'confirmed', 1000, 100, 10.0]
      );

      // Then: 10% rate stored correctly
      const result = await db.select<Array<Record<string, unknown>>>(
        'SELECT * FROM transactions WHERE id = ?',
        ['tx-10pct-001']
      );

      expect(result).toHaveLength(1);
      expect(result[0].tax_rate).toBe(10.0); // 10% consumption tax
      expect(result[0].tax_amount).toBe(100); // 10% of 1000
      expect(result[0].subtotal).toBe(1000);
    });

    it('TC-M12.8: Tax fields are nullable (backward compatibility with non-Japanese receipts)', async () => {
      // Given: v12 DB (fresh migration)
      const { db, tables } = createMockDatabase();
      await setMigrationVersion(db, tables, 11);
      await runMigrations(db);

      // When: Insert transaction without any tax information (international receipt)
      await db.execute(
        `INSERT INTO transactions (id, user_id, amount, type, date, status) VALUES (?, ?, ?, ?, ?, ?)`,
        ['tx-intl-001', 'user-1', 2000, 'expense', '2026-01-11', 'confirmed']
      );

      // Then: Transaction created successfully (tax fields remain NULL)
      const result = await db.select<Array<Record<string, unknown>>>(
        'SELECT * FROM transactions WHERE id = ?',
        ['tx-intl-001']
      );

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(2000);
      expect(result[0].subtotal).toBeUndefined();
      expect(result[0].tax_amount).toBeUndefined();
      expect(result[0].tax_rate).toBeUndefined();
    });
  });
});
