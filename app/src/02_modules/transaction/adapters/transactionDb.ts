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
}

export async function fetchTransactions(
  userId: UserIdType,
  options: FetchTransactionsOptions = {},
): Promise<Transaction[]> {
  const database = await getDb();
  const { startDate, endDate, sortBy = 'date', sortOrder = 'DESC', limit, offset, statusFilter } = options;

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
  options: { startDate?: string; endDate?: string; statusFilter?: 'pending' | 'confirmed' } = {},
): Promise<number> {
  const database = await getDb();
  const { startDate, endDate, statusFilter } = options;

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
