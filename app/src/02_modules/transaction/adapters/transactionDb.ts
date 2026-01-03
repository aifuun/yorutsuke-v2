// Pillar B: Airlock - validate all database responses
import Database from '@tauri-apps/plugin-sql';
import type { TransactionId as TransactionIdType, UserId as UserIdType } from '../../../00_kernel/types';
import { TransactionId, UserId, ImageId } from '../../../00_kernel/types';
import type { Transaction, TransactionCategory, TransactionType } from '../../../01_domains/transaction';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:yorutsuke.db');
  }
  return db;
}

interface DbTransaction {
  id: string;
  user_id: string;
  image_id: string | null;
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
}

function mapDbToTransaction(row: DbTransaction): Transaction {
  return {
    id: TransactionId(row.id),
    userId: UserId(row.user_id),
    imageId: row.image_id ? ImageId(row.image_id) : null,
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

export async function fetchTransactions(
  userId: UserIdType,
  startDate?: string,
  endDate?: string,
): Promise<Transaction[]> {
  const database = await getDb();

  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const params: unknown[] = [userId];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY date DESC, created_at DESC';

  const rows = await database.select<DbTransaction[]>(query, params);
  return rows.map(mapDbToTransaction);
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const database = await getDb();

  await database.execute(
    `INSERT OR REPLACE INTO transactions
     (id, user_id, image_id, type, category, amount, currency, description, merchant, date, created_at, updated_at, confirmed_at, confidence, raw_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transaction.id,
      transaction.userId,
      transaction.imageId,
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
    ],
  );
}

export async function deleteTransaction(id: TransactionIdType): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function confirmTransaction(id: TransactionIdType): Promise<void> {
  const database = await getDb();
  await database.execute(
    'UPDATE transactions SET confirmed_at = ?, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), new Date().toISOString(), id],
  );
}
