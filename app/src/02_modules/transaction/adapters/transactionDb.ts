// Pillar B: Airlock - validate all database responses
import type { TransactionId as TransactionIdType, UserId as UserIdType } from '../../../00_kernel/types';
import { TransactionId, UserId, ImageId } from '../../../00_kernel/types';
import type { Transaction, TransactionCategory, TransactionType } from '../../../01_domains/transaction';
import { getDb } from '../../../00_kernel/storage/db';

interface DbTransaction {
  id: string;
  user_id: string;
  image_id: string | null;
  s3_key: string | null; // v9: Image sync optimization
  type: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  merchant: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  confidence: number | null;
  raw_text: string | null;
  status: string | null; // v6: Cloud sync support
  version: number | null; // v6: Optimistic locking
}

function mapDbToTransaction(row: DbTransaction): Transaction {
  return {
    id: TransactionId(row.id),
    userId: UserId(row.user_id),
    imageId: row.image_id ? ImageId(row.image_id) : null,
    s3Key: row.s3_key,
    type: row.type as TransactionType,
    category: row.category as TransactionCategory,
    amount: row.amount,
    currency: 'JPY',
    description: row.description,
    merchant: row.merchant,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    confidence: row.confidence,
    rawText: row.raw_text,
  };
}

export interface FetchTransactionsOptions {
  startDate?: string;
  endDate?: string;
  sortBy?: 'date' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  /** Filter by confirmation status: 'pending' (unconfirmed) or 'confirmed' */
  statusFilter?: 'pending' | 'confirmed';
  /** Filter by transaction type: 'income' or 'expense' */
  typeFilter?: 'income' | 'expense';
  /** Filter by transaction category */
  categoryFilter?: TransactionCategory;
}

export async function fetchTransactions(
  userId: UserIdType,
  options: FetchTransactionsOptions = {},
): Promise<Transaction[]> {
  const database = await getDb();
  const { startDate, endDate, sortBy = 'date', sortOrder = 'DESC', limit, offset, statusFilter, typeFilter, categoryFilter } = options;

  // Filter out deleted transactions (Issue #109: Soft delete)
  let query = 'SELECT * FROM transactions WHERE user_id = ? AND (status IS NULL OR status != ?)';
  const params: unknown[] = [userId, 'deleted'];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  // Status filter: pending (unconfirmed) or confirmed
  if (statusFilter === 'pending') {
    query += ' AND confirmed_at IS NULL';
  } else if (statusFilter === 'confirmed') {
    query += ' AND confirmed_at IS NOT NULL';
  }

  // Type filter (NEW: Issue #115)
  if (typeFilter) {
    query += ' AND type = ?';
    params.push(typeFilter);
  }

  // Category filter (NEW: Issue #115)
  if (categoryFilter) {
    query += ' AND category = ?';
    params.push(categoryFilter);
  }

  // Sorting (default: invoice date descending)
  const sortField = sortBy === 'createdAt' ? 'created_at' : 'date';
  query += ` ORDER BY ${sortField} ${sortOrder}`;

  // Pagination
  if (limit !== undefined) {
    query += ' LIMIT ?';
    params.push(limit);
    if (offset !== undefined) {
      query += ' OFFSET ?';
      params.push(offset);
    }
  }

  const rows = await database.select<DbTransaction[]>(query, params);
  return rows.map(mapDbToTransaction);
}

/**
 * Count total transactions for a user (used for pagination)
 * Excludes soft-deleted transactions (Issue #109)
 */
export async function countTransactions(
  userId: UserIdType,
  options: {
    startDate?: string;
    endDate?: string;
    statusFilter?: 'pending' | 'confirmed';
    typeFilter?: 'income' | 'expense';
    categoryFilter?: TransactionCategory;
  } = {},
): Promise<number> {
  const database = await getDb();
  const { startDate, endDate, statusFilter, typeFilter, categoryFilter } = options;

  // Filter out deleted transactions
  let query = 'SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND (status IS NULL OR status != ?)';
  const params: unknown[] = [userId, 'deleted'];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  // Status filter: pending (unconfirmed) or confirmed
  if (statusFilter === 'pending') {
    query += ' AND confirmed_at IS NULL';
  } else if (statusFilter === 'confirmed') {
    query += ' AND confirmed_at IS NOT NULL';
  }

  // Type filter (NEW: Issue #115)
  if (typeFilter) {
    query += ' AND type = ?';
    params.push(typeFilter);
  }

  // Category filter (NEW: Issue #115)
  if (categoryFilter) {
    query += ' AND category = ?';
    params.push(categoryFilter);
  }

  const rows = await database.select<Array<{ count: number }>>(query, params);
  return rows[0]?.count ?? 0;
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const database = await getDb();

  await database.execute(
    `INSERT OR REPLACE INTO transactions
     (id, user_id, image_id, s3_key, type, category, amount, currency, description, merchant, date, created_at, updated_at, confirmed_at, confidence, raw_text, status, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transaction.id,
      transaction.userId,
      transaction.imageId,
      transaction.s3Key,
      transaction.type,
      transaction.category,
      transaction.amount,
      transaction.currency,
      transaction.description,
      transaction.merchant,
      transaction.date,
      transaction.createdAt,
      transaction.updatedAt,
      transaction.confirmedAt,
      transaction.confidence,
      transaction.rawText,
      'unconfirmed', // Default status for new transactions
      1, // Default version for new transactions
    ],
  );
}

/**
 * Upsert transaction (insert or update with conflict resolution)
 * Used for cloud sync to merge cloud data into local storage
 * Pillar B: Input is already validated domain Transaction
 *
 * @param transaction - Domain transaction to upsert
 */
export async function upsertTransaction(transaction: Transaction): Promise<void> {
  const database = await getDb();

  // INSERT OR REPLACE will update all fields if transaction.id already exists
  await database.execute(
    `INSERT OR REPLACE INTO transactions
     (id, user_id, image_id, s3_key, type, category, amount, currency, description, merchant, date, created_at, updated_at, confirmed_at, confidence, raw_text, status, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transaction.id,
      transaction.userId,
      transaction.imageId,
      transaction.s3Key,
      transaction.type,
      transaction.category,
      transaction.amount,
      transaction.currency,
      transaction.description,
      transaction.merchant,
      transaction.date,
      transaction.createdAt,
      transaction.updatedAt,
      transaction.confirmedAt,
      transaction.confidence,
      transaction.rawText,
      'unconfirmed', // Status from cloud (will be updated in future when cloud has status)
      1, // Version from cloud (will be synced in future)
    ],
  );
}

/**
 * Soft delete transaction (mark as deleted, don't remove from database)
 * Issue #109: Soft delete strategy for cloud sync
 *
 * Benefits:
 * - Offline support: Mark deleted locally, sync later
 * - Audit trail: Keep history of deleted transactions
 * - Sync compatibility: Cloud can receive delete status
 * - Undo support (future): Can restore deleted transactions
 */
export async function deleteTransaction(id: TransactionIdType): Promise<void> {
  const database = await getDb();
  await database.execute(
    'UPDATE transactions SET status = ?, dirty_sync = ?, updated_at = ? WHERE id = ?',
    ['deleted', 1, new Date().toISOString(), id],
  );
}

/**
 * Confirm transaction (mark as confirmed with dirty flag for sync)
 * Issue #109: Confirm changes need cloud sync
 *
 * MVP4: Set dirty_sync flag to mark for future sync
 * MVP5: Bidirectional sync will push confirmed status to cloud
 */
export async function confirmTransaction(id: TransactionIdType): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    'UPDATE transactions SET confirmed_at = ?, updated_at = ?, dirty_sync = ? WHERE id = ?',
    [now, now, 1, id],
  );
}

/**
 * Update transaction fields (for editing)
 * Issue #116: Transaction editing
 *
 * Supports partial updates of editable fields:
 * - type, amount, category, description, merchant, date
 *
 * Sets dirty_sync flag for future cloud sync (MVP5)
 */
export interface UpdateTransactionFields {
  type?: TransactionType;
  amount?: number;
  category?: TransactionCategory;
  description?: string;
  merchant?: string | null;
  date?: string; // YYYY-MM-DD format
}

export async function updateTransaction(
  id: TransactionIdType,
  fields: UpdateTransactionFields,
): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();

  // Build dynamic UPDATE query based on provided fields
  const updates: string[] = [];
  const params: unknown[] = [];

  if (fields.type !== undefined) {
    updates.push('type = ?');
    params.push(fields.type);
  }
  if (fields.amount !== undefined) {
    updates.push('amount = ?');
    params.push(fields.amount);
  }
  if (fields.category !== undefined) {
    updates.push('category = ?');
    params.push(fields.category);
  }
  if (fields.description !== undefined) {
    updates.push('description = ?');
    params.push(fields.description);
  }
  if (fields.merchant !== undefined) {
    updates.push('merchant = ?');
    params.push(fields.merchant);
  }
  if (fields.date !== undefined) {
    updates.push('date = ?');
    params.push(fields.date);
  }

  // Always update timestamp and dirty flag
  updates.push('updated_at = ?');
  params.push(now);
  updates.push('dirty_sync = ?');
  params.push(1);

  // Add ID at end
  params.push(id);

  if (updates.length === 2) {
    // Only timestamp and dirty_sync, no fields to update
    return;
  }

  const query = `UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`;
  await database.execute(query, params);
}

/**
 * Delete all transactions for a user (for dev tools)
 */
export async function clearAllTransactions(userId: UserIdType): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    'DELETE FROM transactions WHERE user_id = ?',
    [userId],
  );
  return result.rowsAffected ?? 0;
}

/**
 * Fetch transactions marked for cloud sync (Issue #86)
 * Returns transactions where dirty_sync = 1
 *
 * Used by syncService to push local changes to cloud
 */
export async function fetchDirtyTransactions(userId: UserIdType): Promise<Transaction[]> {
  const database = await getDb();
  const query = 'SELECT * FROM transactions WHERE user_id = ? AND dirty_sync = 1';
  const rows = await database.select<DbTransaction[]>(query, [userId]);
  return rows.map(mapDbToTransaction);
}

/**
 * Clear dirty_sync flags for successfully synced transactions (Issue #86)
 * Called after cloud sync succeeds
 *
 * @param ids - TransactionIds that were successfully synced
 */
export async function clearDirtyFlags(ids: TransactionIdType[]): Promise<void> {
  if (ids.length === 0) return;

  const database = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  const query = `UPDATE transactions SET dirty_sync = 0 WHERE id IN (${placeholders})`;
  await database.execute(query, ids);
}

/**
 * Bulk upsert transactions (Issue #86: Data recovery)
 * Used when restoring cloud data to local SQLite
 *
 * @param transactions - Array of transactions to upsert
 */
export async function bulkUpsertTransactions(transactions: Transaction[]): Promise<void> {
  if (transactions.length === 0) return;

  const database = await getDb();

  // Execute upserts in sequence (SQLite doesn't support batch well in Tauri)
  for (const tx of transactions) {
    await database.execute(
      `INSERT OR REPLACE INTO transactions
       (id, user_id, image_id, s3_key, type, category, amount, currency, description, merchant, date, created_at, updated_at, confirmed_at, confidence, raw_text, status, version, dirty_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.userId,
        tx.imageId,
        tx.s3Key,
        tx.type,
        tx.category,
        tx.amount,
        tx.currency,
        tx.description,
        tx.merchant,
        tx.date,
        tx.createdAt,
        tx.updatedAt,
        tx.confirmedAt,
        tx.confidence,
        tx.rawText,
        'unconfirmed', // Default status
        1, // Default version
        0, // Don't mark cloud data as dirty
      ],
    );
  }
}
