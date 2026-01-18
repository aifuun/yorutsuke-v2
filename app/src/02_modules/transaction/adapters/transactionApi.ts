// Pillar B: Airlock - validate all API responses with Zod
import { z } from 'zod';
import { fetch } from '@tauri-apps/plugin-http';
import type { UserId } from '../../../00_kernel/types';
import { TransactionId, ImageId, UserId as UserIdConstructor } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import { isMockingOnline, isMockingOffline, mockDelay } from '../../../00_kernel/config/mock';
import { mockTransactionPull, mockNetworkError } from '../../../00_kernel/mocks';
import { logger, EVENTS } from '../../../00_kernel/telemetry/logger';

// Transactions Lambda URL (from environment variable)
const TRANSACTIONS_URL = import.meta.env.VITE_LAMBDA_SYNC_URL;
if (!TRANSACTIONS_URL) {
  throw new Error('VITE_LAMBDA_SYNC_URL environment variable not configured');
}

// Timeouts
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

// Zod schema for transaction category
const TransactionCategorySchema = z.enum([
  'food', 'transport', 'shopping', 'entertainment', 'utilities', 'health', 'other'
]);

// Zod schema for transaction response (Cloud DynamoDB format)
const CloudTransactionSchema = z.object({
  userId: z.string(),
  transactionId: z.string(),
  imageId: z.string().optional().nullable(),
  s3Key: z.string().optional().nullable(), // S3 object key for image sync optimization
  amount: z.number(),
  type: z.enum(['income', 'expense']),
  date: z.string(), // YYYY-MM-DD
  merchant: z.string(),
  category: TransactionCategorySchema,
  description: z.string(),
  status: z.enum(['unconfirmed', 'confirmed', 'deleted', 'needs_review']),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
  version: z.number().default(1),
  // Additional fields we don't sync locally
  aiProcessed: z.boolean().optional(),
  validationErrors: z.array(z.any()).optional(),
  isGuest: z.boolean().optional(),
  ttl: z.number().optional(),
  // AI Processing Metadata (simplified)
  processingModel: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

// API response schema
const FetchTransactionsResponseSchema = z.object({
  transactions: z.array(CloudTransactionSchema),
  nextCursor: z.string().nullable().optional(),
});

type CloudTransaction = z.infer<typeof CloudTransactionSchema>;

/**
 * Wrap a promise with timeout protection
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Map cloud transaction to domain transaction
 * (DynamoDB format → Frontend domain model)
 */
function mapCloudToTransaction(cloudTx: CloudTransaction): Transaction {
  return {
    id: TransactionId(cloudTx.transactionId),
    userId: UserIdConstructor(cloudTx.userId),
    imageId: cloudTx.imageId ? ImageId(cloudTx.imageId) : null,
    s3Key: cloudTx.s3Key ?? null, // S3 object key for image sync
    type: cloudTx.type,
    category: cloudTx.category,
    amount: cloudTx.amount,
    currency: 'JPY',
    description: cloudTx.description,
    merchant: cloudTx.merchant,
    date: cloudTx.date,
    createdAt: cloudTx.createdAt,
    updatedAt: cloudTx.updatedAt,
    status: cloudTx.status,
    confidence: cloudTx.confidence ?? null,
    rawText: null, // Not stored in DynamoDB
    processingModel: cloudTx.processingModel ?? null,
  };
}

/**
 * Fetch transactions from cloud (DynamoDB via Lambda)
 * Pillar B: Validate response with Zod schema
 *
 * @param userId - User ID to fetch transactions for
 * @param startDate - Optional start date filter (YYYY-MM-DD)
 * @param endDate - Optional end date filter (YYYY-MM-DD)
 * @param status - Optional status filter ('all' | 'confirmed' | 'unconfirmed')
 * @returns Array of transactions
 */
export async function fetchTransactions(
  userId: UserId,
  startDate?: string,
  endDate?: string,
  status: 'all' | 'confirmed' | 'unconfirmed' = 'all'
): Promise<Transaction[]> {
  // Mocking offline - simulate network failure
  if (isMockingOffline()) {
    await mockDelay(100);
    logger.debug(EVENTS.APP_ERROR, { component: 'transactionApi', phase: 'mock_offline' });
    throw mockNetworkError('fetch transactions');
  }

  // Mocking online - return mock transactions
  if (isMockingOnline()) {
    await mockDelay(300);
    logger.debug(EVENTS.APP_ERROR, { component: 'transactionApi', phase: 'mock_online', count: 3 });
    return mockTransactionPull(userId, 3);
  }

  // Build request body
  const requestBody = {
    userId,
    startDate,
    endDate,
    status,
    limit: 100, // Fetch up to 100 transactions per request
  };

  logger.info('transaction_fetch_started', { userId, filters: { startDate, endDate, status } });

  try {
    const fetchPromise = fetch(TRANSACTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await withTimeout(
      fetchPromise,
      FETCH_TIMEOUT_MS,
      'Transaction fetch timeout (10s)'
    );

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 400) {
        throw new Error('400: Invalid request parameters');
      }
      if (response.status === 403) {
        throw new Error('403: Unauthorized');
      }
      if (response.status === 429) {
        throw new Error('429: Rate limit exceeded');
      }
      if (response.status === 500) {
        throw new Error('500: Server error');
      }
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const data = await response.json();

    // Pillar B: Validate response with Zod schema
    const parsed = FetchTransactionsResponseSchema.safeParse(data);
    if (!parsed.success) {
      logger.error(EVENTS.APP_ERROR, {
        component: 'transactionApi',
        error: 'Invalid response schema',
        details: parsed.error.message,
      });
      throw new Error(`Invalid transaction response: ${parsed.error.message}`);
    }

    // Map cloud transactions to domain transactions
    const transactions = parsed.data.transactions.map(mapCloudToTransaction);

    logger.info('transaction_fetch_success', {
      userId,
      count: transactions.length,
      hasMore: !!parsed.data.nextCursor,
    });

    return transactions;
  } catch (error) {
    logger.error(EVENTS.APP_ERROR, {
      component: 'transactionApi',
      error: String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Sync local transactions to cloud (Issue #86)
 * POST /transactions/sync
 *
 * Used to push local changes (confirm/edit/delete) to DynamoDB
 *
 * @param userId - User ID
 * @param transactions - Array of transactions to sync
 * @returns Result with synced count and failed IDs
 */
export interface SyncResult {
  synced: number;
  failed: string[];
}

const SyncResponseSchema = z.object({
  synced: z.number(),
  failed: z.array(z.string()),
});

export async function syncTransactions(
  userId: UserId,
  transactions: Transaction[]
): Promise<SyncResult> {
  // Mocking - skip sync in mock mode
  if (isMockingOffline()) {
    await mockDelay(100);
    throw mockNetworkError('sync transactions');
  }

  if (isMockingOnline()) {
    await mockDelay(300);
    logger.debug(EVENTS.APP_ERROR, { component: 'transactionApi', phase: 'mock_sync', count: transactions.length });
    return { synced: transactions.length, failed: [] };
  }

  const requestBody = {
    userId,
    transactions: transactions.map(tx => ({
      transactionId: tx.id,
      userId: tx.userId,
      imageId: tx.imageId,
      s3Key: tx.s3Key,
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
      merchant: tx.merchant,
      description: tx.description,
      date: tx.date,
      confirmedAt: tx.status === 'confirmed' ? tx.updatedAt : null,
      updatedAt: tx.updatedAt,
      createdAt: tx.createdAt,
      status: tx.status,
    })),
  };

  logger.info('transaction_sync_started', { userId, count: transactions.length });

  try {
    const fetchPromise = fetch(`${TRANSACTIONS_URL}sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await withTimeout(
      fetchPromise,
      FETCH_TIMEOUT_MS,
      'Transaction sync timeout (10s)'
    );

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    const data = await response.json();
    const parsed = SyncResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new Error(`Invalid sync response: ${parsed.error.message}`);
    }

    logger.info('transaction_sync_success', {
      userId,
      synced: parsed.data.synced,
      failed: parsed.data.failed.length,
    });

    return parsed.data;
  } catch (error) {
    logger.error(EVENTS.APP_ERROR, {
      component: 'transactionApi',
      error: String(error),
      operation: 'sync',
      userId,
    });
    throw error;
  }
}

/**
 * Fetch all transactions for a user (Issue #86: Data recovery)
 * GET /transactions?userId={userId}
 *
 * Used for restoring cloud data to new device
 *
 * @param userId - User ID
 * @returns All user's transactions from cloud
 */
export async function fetchAllTransactions(userId: UserId): Promise<Transaction[]> {
  // Mocking
  if (isMockingOffline()) {
    await mockDelay(100);
    throw mockNetworkError('fetch all transactions');
  }

  if (isMockingOnline()) {
    await mockDelay(500);
    logger.debug(EVENTS.APP_ERROR, { component: 'transactionApi', phase: 'mock_fetch_all' });
    return mockTransactionPull(userId, 5);
  }

  logger.info('transaction_fetch_all_started', { userId });

  try {
    const fetchPromise = fetch(`${TRANSACTIONS_URL}?userId=${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await withTimeout(
      fetchPromise,
      FETCH_TIMEOUT_MS * 2, // 20 seconds for potentially large dataset
      'Fetch all transactions timeout (20s)'
    );

    if (!response.ok) {
      throw new Error(`Fetch all failed: ${response.status}`);
    }

    const data = await response.json();
    const parsed = FetchTransactionsResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new Error(`Invalid response: ${parsed.error.message}`);
    }

    const transactions = parsed.data.transactions.map(mapCloudToTransaction);

    logger.info('transaction_fetch_all_success', {
      userId,
      count: transactions.length,
    });

    return transactions;
  } catch (error) {
    logger.error(EVENTS.APP_ERROR, {
      component: 'transactionApi',
      error: String(error),
      operation: 'fetch_all',
      userId,
    });
    throw error;
  }
}
