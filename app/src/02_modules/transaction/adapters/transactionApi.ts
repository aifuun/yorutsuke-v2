// Pillar B: Airlock - validate all API responses with Zod
import { z } from 'zod';
import { fetch } from '@tauri-apps/plugin-http';
import type { UserId } from '../../../00_kernel/types';
import { TransactionId, ImageId, UserId as UserIdConstructor } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import { isMockingOnline, isMockingOffline, mockDelay } from '../../../00_kernel/config/mock';
import { logger, EVENTS } from '../../../00_kernel/telemetry/logger';

// Transactions Lambda URL
const TRANSACTIONS_URL = 'https://yy2xogwnhx4sxu7tbmt6ax67r40zhzzo.lambda-url.ap-northeast-1.on.aws/';

// Timeouts
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

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
  category: z.string(),
  description: z.string(),
  status: z.enum(['unconfirmed', 'confirmed', 'deleted', 'needs_review']),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
  confirmedAt: z.string().nullable().optional(),
  version: z.number().default(1),
  // Additional fields we don't sync locally
  aiProcessed: z.boolean().optional(),
  validationErrors: z.array(z.any()).optional(),
  isGuest: z.boolean().optional(),
  ttl: z.number().optional(),
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
    category: cloudTx.category as Transaction['category'],
    amount: cloudTx.amount,
    currency: 'JPY',
    description: cloudTx.description,
    merchant: cloudTx.merchant,
    date: cloudTx.date,
    createdAt: cloudTx.createdAt,
    updatedAt: cloudTx.updatedAt,
    confirmedAt: cloudTx.confirmedAt ?? null,
    confidence: null, // Not stored in DynamoDB
    rawText: null, // Not stored in DynamoDB
  };
}

/**
 * Generate mock transactions for testing
 */
function createMockTransactions(userId: UserId, count: number = 3): Transaction[] {
  const now = new Date();
  const transactions: Transaction[] = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    transactions.push({
      id: TransactionId(`mock-tx-${i + 1}`),
      userId,
      imageId: i % 2 === 0 ? ImageId(`mock-img-${i + 1}`) : null,
      s3Key: null,
      type: i % 2 === 0 ? 'expense' : 'income',
      category: i % 2 === 0 ? 'purchase' : 'sale',
      amount: 1000 + i * 500,
      currency: 'JPY',
      description: `Mock transaction ${i + 1}`,
      merchant: `Mock Merchant ${i + 1}`,
      date: date.toISOString().split('T')[0],
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
      confirmedAt: i === 0 ? date.toISOString() : null,
      confidence: null,
      rawText: null,
    });
  }

  return transactions;
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
    throw new Error('Network error: offline mode');
  }

  // Mocking online - return mock transactions
  if (isMockingOnline()) {
    await mockDelay(300);
    logger.debug(EVENTS.APP_ERROR, { component: 'transactionApi', phase: 'mock_online', count: 3 });
    return createMockTransactions(userId, 3);
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
