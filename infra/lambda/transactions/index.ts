/**
 * Transactions Lambda
 *
 * Handles CRUD operations for transactions, including:
 * - Query with pagination and filters
 * - Update with optimistic locking
 * - Delete
 * - Pull sync (fetch all)
 * - Push sync (sync from local)
 */

import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { logger, initContext, EVENTS } from '/opt/nodejs/shared/logger.mjs';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from './types/aws-events.js';

const ddb = new DynamoDBClient({});
const s3 = new S3Client({});
const TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * CORS headers (Issue #86: Added GET method for pull sync)
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Transaction interface
 */
interface Transaction {
  userId: string;
  transactionId: string;
  imageId?: string;
  s3Key?: string | null;
  date: string;
  amount: number;
  type?: string;
  category?: string;
  merchant?: string;
  description?: string;
  status?: string;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  version?: number;
  [key: string]: unknown;
}

/**
 * Query transactions request body
 */
interface QueryTransactionsBody {
  userId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Update transaction body
 */
interface UpdateTransactionBody {
  userId?: string;
  amount?: number;
  category?: string;
  description?: string;
  merchant?: string;
  date?: string;
  confirmedAt?: string | null;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  expectedVersion?: number;
  [key: string]: unknown;
}

/**
 * Sync transactions request body
 */
interface SyncTransactionsBody {
  userId?: string;
  transactions?: Transaction[];
}

/**
 * Last Evaluated Key for pagination
 */
interface LastEvaluatedKey {
  userId: { S: string };
  transactionId: { S: string };
  [key: string]: unknown;
}

/**
 * Create response with CORS headers
 */
function response(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  };
}

/**
 * Encode cursor for pagination
 */
function encodeCursor(lastEvaluatedKey: LastEvaluatedKey | undefined): string | null {
  if (!lastEvaluatedKey) return null;
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
}

/**
 * Decode cursor for pagination
 */
function decodeCursor(cursor: string | undefined): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Query transactions with filters
 * POST /transactions
 */
async function queryTransactions(body: QueryTransactionsBody): Promise<APIGatewayProxyResultV2> {
  const { userId, startDate, endDate, status = 'all', limit = DEFAULT_LIMIT, cursor } = body;

  if (!userId) {
    return response(400, { error: 'MISSING_USER_ID', message: 'userId is required' });
  }

  const queryLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  // Build query parameters
  const params: any = {
    TableName: TABLE_NAME,
    IndexName: 'byDate',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': { S: userId },
    },
    Limit: queryLimit,
    ScanIndexForward: false, // Newest first
  };

  // Add date range filter
  if (startDate && endDate) {
    params.KeyConditionExpression += ' AND #date BETWEEN :startDate AND :endDate';
    params.ExpressionAttributeNames = { '#date': 'date' };
    params.ExpressionAttributeValues[':startDate'] = { S: startDate };
    params.ExpressionAttributeValues[':endDate'] = { S: endDate };
  } else if (startDate) {
    params.KeyConditionExpression += ' AND #date >= :startDate';
    params.ExpressionAttributeNames = { '#date': 'date' };
    params.ExpressionAttributeValues[':startDate'] = { S: startDate };
  } else if (endDate) {
    params.KeyConditionExpression += ' AND #date <= :endDate';
    params.ExpressionAttributeNames = { '#date': 'date' };
    params.ExpressionAttributeValues[':endDate'] = { S: endDate };
  }

  // Add status filter
  if (status !== 'all') {
    params.FilterExpression =
      status === 'confirmed' ? 'attribute_exists(confirmedAt)' : 'attribute_not_exists(confirmedAt)';
  }

  // Add pagination cursor
  const exclusiveStartKey = decodeCursor(cursor);
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }

  try {
    const result = await ddb.send(new QueryCommand(params));

    const transactions = (result.Items || []).map((item) => unmarshall(item) as Transaction);
    const nextCursor = encodeCursor(result.LastEvaluatedKey as LastEvaluatedKey | undefined);

    return response(200, { transactions, nextCursor });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.TRANSACTION_QUERY_ERROR, { error: errorMessage });
    return response(500, { error: 'QUERY_FAILED', message: 'Failed to query transactions' });
  }
}

/**
 * Update a transaction
 * PUT /transactions/{id}
 */
async function updateTransaction(
  userId: string | undefined,
  transactionId: string | null,
  body: UpdateTransactionBody,
  expectedVersion: number | undefined
): Promise<APIGatewayProxyResultV2> {
  if (!userId || !transactionId) {
    return response(400, { error: 'MISSING_PARAMS', message: 'userId and transactionId required' });
  }

  // Build update expression
  const updateFields: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  const allowedFields = [
    'amount',
    'category',
    'description',
    'merchant',
    'date',
    'confirmedAt',
    'subtotal',
    'taxAmount',
    'taxRate',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateFields.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = marshall({ v: body[field] }).v;
    }
  }

  if (updateFields.length === 0) {
    return response(400, { error: 'NO_UPDATES', message: 'No fields to update' });
  }

  // Add updatedAt and increment version
  updateFields.push('#updatedAt = :updatedAt');
  updateFields.push('#version = #version + :one');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeNames['#version'] = 'version';
  expressionAttributeValues[':updatedAt'] = { S: new Date().toISOString() };
  expressionAttributeValues[':one'] = { N: '1' };

  const params: any = {
    TableName: TABLE_NAME,
    Key: {
      userId: { S: userId },
      transactionId: { S: transactionId },
    },
    UpdateExpression: `SET ${updateFields.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  // Optimistic locking (Pillar F)
  if (expectedVersion !== undefined) {
    params.ConditionExpression = '#version = :expectedVersion';
    expressionAttributeValues[':expectedVersion'] = { N: String(expectedVersion) };
  }

  try {
    const result = await ddb.send(new UpdateItemCommand(params));
    const transaction = unmarshall(result.Attributes!) as Transaction;

    return response(200, { transaction });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return response(409, {
        error: 'VERSION_CONFLICT',
        message: 'Transaction was modified by another request',
      });
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.TRANSACTION_UPDATE_ERROR, { error: errorMessage });
    return response(500, { error: 'UPDATE_FAILED', message: 'Failed to update transaction' });
  }
}

/**
 * Delete a transaction
 * DELETE /transactions/{id}
 */
async function deleteTransaction(
  userId: string | undefined,
  transactionId: string | null
): Promise<APIGatewayProxyResultV2> {
  if (!userId || !transactionId) {
    return response(400, { error: 'MISSING_PARAMS', message: 'userId and transactionId required' });
  }

  try {
    await ddb.send(
      new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: {
          userId: { S: userId },
          transactionId: { S: transactionId },
        },
      })
    );

    return response(200, { success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.TRANSACTION_DELETE_ERROR, { error: errorMessage });
    return response(500, { error: 'DELETE_FAILED', message: 'Failed to delete transaction' });
  }
}

/**
 * Fetch all transactions for a user (Issue #86 - Pull Sync)
 * GET /transactions?userId=xxx&startDate=xxx&endDate=xxx
 */
async function fetchAllTransactions(
  userId: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined
): Promise<APIGatewayProxyResultV2> {
  if (!userId) {
    return response(400, { error: 'MISSING_USER_ID', message: 'userId is required' });
  }

  try {
    const params: any = {
      TableName: TABLE_NAME,
      IndexName: 'byDate',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': { S: userId },
      },
      ScanIndexForward: false, // Newest first
    };

    // Add date range filter if provided
    if (startDate && endDate) {
      params.KeyConditionExpression += ' AND #date BETWEEN :startDate AND :endDate';
      params.ExpressionAttributeNames = { '#date': 'date' };
      params.ExpressionAttributeValues[':startDate'] = { S: startDate };
      params.ExpressionAttributeValues[':endDate'] = { S: endDate };
    } else if (startDate) {
      params.KeyConditionExpression += ' AND #date >= :startDate';
      params.ExpressionAttributeNames = { '#date': 'date' };
      params.ExpressionAttributeValues[':startDate'] = { S: startDate };
    } else if (endDate) {
      params.KeyConditionExpression += ' AND #date <= :endDate';
      params.ExpressionAttributeNames = { '#date': 'date' };
      params.ExpressionAttributeValues[':endDate'] = { S: endDate };
    }

    // Fetch all pages
    const transactions: Transaction[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await ddb.send(new QueryCommand(params));
      transactions.push(...(result.Items || []).map((item) => unmarshall(item) as Transaction));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return response(200, { transactions });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.TRANSACTION_FETCH_ERROR, { error: errorMessage });
    return response(500, { error: 'FETCH_FAILED', message: 'Failed to fetch transactions' });
  }
}

/**
 * Delete S3 image for a transaction
 * Called when transaction status is 'deleted'
 */
async function deleteS3Image(s3Key: string, transactionId: string): Promise<void> {
  const IMAGES_BUCKET = process.env.IMAGES_BUCKET_NAME; // Lazy evaluation for testability

  if (!s3Key || !IMAGES_BUCKET) {
    logger.info(EVENTS.S3_IMAGE_SKIP_DELETE, { s3Key, transactionId });
    return;
  }

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: s3Key,
      })
    );
    logger.info(EVENTS.S3_IMAGE_DELETED, { s3Key, transactionId });
  } catch (error: unknown) {
    // Log but don't fail - S3 cleanup is best-effort
    // Image may already be deleted or not exist
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.S3_IMAGE_DELETE_FAILED, { s3Key, transactionId, error: errorMessage });
  }
}

/**
 * Sync transactions from local to cloud (Issue #86 - Push Sync)
 * POST /transactions/sync
 * Body: { userId, transactions: [...] }
 *
 * Uses PutItem with condition to prevent overwriting newer data (Last-Write-Wins)
 * Pillar Q: Idempotent - safe to retry
 *
 * When status='deleted':
 * - Updates DynamoDB record with deleted status (soft delete)
 * - Deletes S3 image if s3Key exists (hard delete for storage cleanup)
 */
async function syncTransactionsFromLocal(
  body: SyncTransactionsBody
): Promise<APIGatewayProxyResultV2> {
  const { userId, transactions } = body;

  if (!userId || !Array.isArray(transactions) || transactions.length === 0) {
    return response(400, {
      error: 'INVALID_REQUEST',
      message: 'userId and transactions array required',
    });
  }

  logger.info(EVENTS.SYNC_STARTED, { userId, count: transactions.length });

  const synced: string[] = [];
  const failed: string[] = [];

  // Process each transaction individually with optimistic concurrency control
  for (const tx of transactions) {
    try {
      if (!tx.transactionId || !tx.updatedAt) {
        failed.push(tx.transactionId || 'unknown');
        continue;
      }

      // PutItem with condition: only write if cloud version is older (Last-Write-Wins)
      const item = marshall({
        userId: tx.userId,
        transactionId: tx.transactionId,
        imageId: tx.imageId,
        s3Key: tx.s3Key || null,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        merchant: tx.merchant || '',
        description: tx.description || '',
        status: tx.status || 'unconfirmed',
        confirmedAt: tx.confirmedAt || null,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        version: tx.version || 1,
      });

      await ddb.send(
        new PutItemCommand({
          TableName: TABLE_NAME,
          Item: item,
          // Pillar F: Only overwrite if cloud version is older (or doesn't exist)
          ConditionExpression: 'attribute_not_exists(transactionId) OR updatedAt < :localUpdatedAt',
          ExpressionAttributeValues: {
            ':localUpdatedAt': { S: tx.updatedAt },
          },
        })
      );

      // If transaction is deleted, also delete the S3 image
      if (tx.status === 'deleted' && tx.s3Key) {
        await deleteS3Image(tx.s3Key, tx.transactionId);
      }

      synced.push(tx.transactionId);
      logger.info(EVENTS.SYNC_SUCCESS, {
        transactionId: tx.transactionId,
        status: tx.status || 'unconfirmed',
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        // Cloud version is newer - skip this transaction (not a failure)
        logger.info(EVENTS.SYNC_SKIPPED, { transactionId: tx.transactionId });
        synced.push(tx.transactionId); // Consider it synced (cloud wins)
      } else {
        // Real error - mark as failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(EVENTS.SYNC_FAILED, { transactionId: tx.transactionId, error: errorMessage });
        failed.push(tx.transactionId);
      }
    }
  }

  logger.info(EVENTS.SYNC_COMPLETED, { synced: synced.length, failed: failed.length });

  return response(200, {
    synced: synced.length,
    failed,
  });
}

/**
 * Lambda handler
 * POST /transactions - Query transactions
 * PUT /transactions/{id} - Update transaction
 * DELETE /transactions/{id} - Delete transaction
 * GET /transactions - Fetch all transactions (pull sync)
 * POST /transactions/sync - Sync from local (push sync)
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  initContext(event);

  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const method = event.requestContext?.http?.method || (event as any).httpMethod;
  const path = event.rawPath || (event as any).path || '';

  try {
    const body = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
    const queryParams = event.queryStringParameters || {};

    // Route: GET / (Issue #86 - Pull Sync)
    if (method === 'GET' && path === '/') {
      const { userId, startDate, endDate } = queryParams;
      return await fetchAllTransactions(userId, startDate, endDate);
    }

    // Route: POST /sync (Issue #86 - Push Sync)
    if (method === 'POST' && path === '/sync') {
      return await syncTransactionsFromLocal(body as SyncTransactionsBody);
    }

    // Extract transactionId from path: /{id}
    const pathMatch = path.match(/^\/([^/]+)$/);
    const transactionId = pathMatch ? pathMatch[1] : null;

    // For PUT/DELETE, userId comes from body or query params
    const userId = (body as any).userId || queryParams.userId;

    switch (method) {
      case 'POST':
        // POST /transactions - Query transactions (existing)
        return await queryTransactions(body as QueryTransactionsBody);

      case 'PUT':
        // PUT /transactions/{id} - Update transaction
        return await updateTransaction(
          userId,
          transactionId,
          body as UpdateTransactionBody,
          (body as UpdateTransactionBody).expectedVersion
        );

      case 'DELETE':
        // DELETE /transactions/{id} - Delete transaction
        return await deleteTransaction(userId, transactionId);

      default:
        return response(405, {
          error: 'METHOD_NOT_ALLOWED',
          message: `Method ${method} not allowed`,
        });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.TRANSACTION_HANDLER_ERROR, { error: errorMessage });
    return response(500, { error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}
