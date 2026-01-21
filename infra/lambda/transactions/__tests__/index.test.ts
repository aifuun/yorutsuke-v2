/**
 * Unit Tests for Transactions Lambda (Phase 3 - P1)
 *
 * Tests cover:
 * - CRUD operations (Query, Update, Delete)
 * - Pull sync (GET /transactions)
 * - Push sync (POST /transactions/sync)
 * - Cursor-based pagination
 * - Date range filtering
 * - Status filtering (confirmed/unconfirmed/all)
 * - Optimistic locking (version checking)
 * - Last-Write-Wins sync strategy
 * - S3 image deletion
 * - Error handling (DynamoDB, version conflicts)
 * - Response format validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from '../types/aws-events.js';

// Mock logger before importing module
vi.mock('/opt/nodejs/shared/logger.mjs', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
  initContext: vi.fn(),
  EVENTS: {
    TRANSACTION_QUERY_ERROR: 'TRANSACTION_QUERY_ERROR',
    TRANSACTION_UPDATE_ERROR: 'TRANSACTION_UPDATE_ERROR',
    TRANSACTION_DELETE_ERROR: 'TRANSACTION_DELETE_ERROR',
    TRANSACTION_FETCH_ERROR: 'TRANSACTION_FETCH_ERROR',
    TRANSACTION_HANDLER_ERROR: 'TRANSACTION_HANDLER_ERROR',
    SYNC_STARTED: 'SYNC_STARTED',
    SYNC_SUCCESS: 'SYNC_SUCCESS',
    SYNC_FAILED: 'SYNC_FAILED',
    SYNC_SKIPPED: 'SYNC_SKIPPED',
    SYNC_COMPLETED: 'SYNC_COMPLETED',
    S3_IMAGE_SKIP_DELETE: 'S3_IMAGE_SKIP_DELETE',
    S3_IMAGE_DELETED: 'S3_IMAGE_DELETED',
    S3_IMAGE_DELETE_FAILED: 'S3_IMAGE_DELETE_FAILED',
  },
}));

import { handler } from '../index.js';

// Mock AWS clients
const ddbMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);

/**
 * Mock event generators
 */
function createPostEvent(path: string, body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `POST ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method: 'POST',
        path,
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function createGetEvent(path: string, queryParams: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `GET ${path}`,
    rawPath: path,
    rawQueryString: new URLSearchParams(queryParams).toString(),
    headers: {},
    requestContext: {
      http: {
        method: 'GET',
        path,
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: null,
    isBase64Encoded: false,
    queryStringParameters: queryParams,
  } as APIGatewayProxyEventV2;
}

function createPutEvent(path: string, body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `PUT ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method: 'PUT',
        path,
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function createDeleteEvent(path: string, queryParams: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `DELETE ${path}`,
    rawPath: path,
    rawQueryString: new URLSearchParams(queryParams).toString(),
    headers: {},
    requestContext: {
      http: {
        method: 'DELETE',
        path,
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: null,
    isBase64Encoded: false,
    queryStringParameters: queryParams,
  } as APIGatewayProxyEventV2;
}

function createOptionsEvent(): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'OPTIONS /transactions',
    rawPath: '/transactions',
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method: 'OPTIONS',
        path: '/transactions',
      },
      requestId: 'test-request-id',
    } as any,
    body: null,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe('Transactions Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
    vi.clearAllMocks();

    // Set environment variables
    process.env.TRANSACTIONS_TABLE_NAME = 'test-transactions-table';
    process.env.IMAGES_BUCKET_NAME = 'test-images-bucket';
  });

  // =========================================================================
  // Test Suite 1: CORS Handling
  // =========================================================================

  describe('CORS Handling', () => {
    it('should handle OPTIONS preflight request', async () => {
      const event = createOptionsEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      expect(result.body).toBe('');
    });
  });

  // =========================================================================
  // Test Suite 2: Query Transactions (POST /transactions)
  // =========================================================================

  describe('Query Transactions', () => {
    it('should query transactions for a user', async () => {
      const event = createPostEvent('/transactions', {
        userId: 'user-123',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            amount: { N: '1000' },
            date: { S: '2026-01-20' },
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.transactions).toHaveLength(1);
      expect(body.transactions[0]).toMatchObject({
        transactionId: 'tx-1',
        userId: 'user-123',
      });
    });

    it('should reject query without userId', async () => {
      const event = createPostEvent('/transactions', {});

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('MISSING_USER_ID');
    });

    it('should apply date range filter', async () => {
      const event = createPostEvent('/transactions', {
        userId: 'user-123',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(ddbMock.commandCalls(QueryCommand).length).toBe(1);
    });

    it('should apply status filter for confirmed transactions', async () => {
      const event = createPostEvent('/transactions', {
        userId: 'user-123',
        status: 'confirmed',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    it('should apply status filter for unconfirmed transactions', async () => {
      const event = createPostEvent('/transactions', {
        userId: 'user-123',
        status: 'unconfirmed',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    it('should handle pagination with cursor', async () => {
      const event = createPostEvent('/transactions', {
        userId: 'user-123',
        limit: 10,
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
          },
        ],
        LastEvaluatedKey: {
          userId: { S: 'user-123' },
          transactionId: { S: 'tx-1' },
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.nextCursor).toBeTruthy();
    });

    it('should enforce max limit of 500', async () => {
      const event = createPostEvent('/transactions', {
        userId: 'user-123',
        limit: 1000, // Exceeds max
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    it('should handle DynamoDB errors', async () => {
      const event = createPostEvent('/transactions', {
        userId: 'user-123',
      });

      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('QUERY_FAILED');
    });
  });

  // =========================================================================
  // Test Suite 3: Update Transaction (PUT /transactions/{id})
  // =========================================================================

  describe('Update Transaction', () => {
    it('should update a transaction', async () => {
      const event = createPutEvent('/tx-123', {
        userId: 'user-123',
        amount: 1500,
        category: 'sales',
      });

      ddbMock.on(UpdateItemCommand).resolves({
        Attributes: {
          transactionId: { S: 'tx-123' },
          userId: { S: 'user-123' },
          amount: { N: '1500' },
          category: { S: 'sales' },
          version: { N: '2' },
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.transaction).toMatchObject({
        transactionId: 'tx-123',
        amount: 1500,
        version: 2,
      });
    });

    it('should reject update without userId', async () => {
      const event = createPutEvent('/tx-123', {
        amount: 1500,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('MISSING_PARAMS');
    });

    it('should reject update with no fields', async () => {
      const event = createPutEvent('/tx-123', {
        userId: 'user-123',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('NO_UPDATES');
    });

    it('should handle version conflict (optimistic locking)', async () => {
      const event = createPutEvent('/tx-123', {
        userId: 'user-123',
        amount: 1500,
        expectedVersion: 1,
      });

      const error: any = new Error('ConditionalCheckFailed');
      error.name = 'ConditionalCheckFailedException';
      ddbMock.on(UpdateItemCommand).rejects(error);

      const result = await handler(event);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('VERSION_CONFLICT');
    });

    it('should handle DynamoDB errors', async () => {
      const event = createPutEvent('/tx-123', {
        userId: 'user-123',
        amount: 1500,
      });

      ddbMock.on(UpdateItemCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('UPDATE_FAILED');
    });
  });

  // =========================================================================
  // Test Suite 4: Delete Transaction (DELETE /transactions/{id})
  // =========================================================================

  describe('Delete Transaction', () => {
    it('should delete a transaction', async () => {
      const event = createDeleteEvent('/tx-123', {
        userId: 'user-123',
      });

      ddbMock.on(DeleteItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    it('should reject delete without userId', async () => {
      const event = createDeleteEvent('/tx-123', {});

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('MISSING_PARAMS');
    });

    it('should handle DynamoDB errors', async () => {
      const event = createDeleteEvent('/tx-123', {
        userId: 'user-123',
      });

      ddbMock.on(DeleteItemCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('DELETE_FAILED');
    });
  });

  // =========================================================================
  // Test Suite 5: Fetch All Transactions (GET /transactions)
  // =========================================================================

  describe('Fetch All Transactions (Pull Sync)', () => {
    it('should fetch all transactions for a user', async () => {
      const event = createGetEvent('/', {
        userId: 'user-123',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            amount: { N: '1000' },
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.transactions).toHaveLength(1);
    });

    it('should fetch transactions with date range', async () => {
      const event = createGetEvent('/', {
        userId: 'user-123',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    it('should handle pagination (fetch all pages)', async () => {
      const event = createGetEvent('/', {
        userId: 'user-123',
      });

      ddbMock
        .on(QueryCommand)
        .resolvesOnce({
          Items: [{ transactionId: { S: 'tx-1' } }],
          LastEvaluatedKey: { userId: { S: 'user-123' }, transactionId: { S: 'tx-1' } },
        })
        .resolvesOnce({
          Items: [{ transactionId: { S: 'tx-2' } }],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.transactions).toHaveLength(2);
    });

    it('should reject fetch without userId', async () => {
      const event = createGetEvent('/', {});

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('MISSING_USER_ID');
    });

    it('should handle DynamoDB errors', async () => {
      const event = createGetEvent('/', {
        userId: 'user-123',
      });

      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('FETCH_FAILED');
    });
  });

  // =========================================================================
  // Test Suite 6: Sync Transactions (POST /transactions/sync)
  // =========================================================================

  describe('Sync Transactions (Push Sync)', () => {
    it('should sync transactions from local to cloud', async () => {
      const event = createPostEvent('/sync', {
        userId: 'user-123',
        transactions: [
          {
            userId: 'user-123',
            transactionId: 'tx-1',
            imageId: 'img-1',
            amount: 1000,
            date: '2026-01-20',
            type: 'income',
            category: 'sales',
            createdAt: '2026-01-20T09:00:00.000Z',
            updatedAt: '2026-01-20T10:00:00.000Z',
          },
        ],
      });

      ddbMock.on(PutItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.synced).toBe(1);
      expect(body.failed).toEqual([]);
    });

    it('should reject sync without userId', async () => {
      const event = createPostEvent('/sync', {
        transactions: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('INVALID_REQUEST');
    });

    it('should reject sync with empty transactions array', async () => {
      const event = createPostEvent('/sync', {
        userId: 'user-123',
        transactions: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('INVALID_REQUEST');
    });

    it('should handle Last-Write-Wins (cloud version is newer)', async () => {
      const event = createPostEvent('/sync', {
        userId: 'user-123',
        transactions: [
          {
            userId: 'user-123',
            transactionId: 'tx-1',
            imageId: 'img-1',
            amount: 1000,
            date: '2026-01-20',
            type: 'income',
            category: 'sales',
            createdAt: '2026-01-20T09:00:00.000Z',
            updatedAt: '2026-01-20T10:00:00.000Z',
          },
        ],
      });

      const error: any = new Error('ConditionalCheckFailed');
      error.name = 'ConditionalCheckFailedException';
      ddbMock.on(PutItemCommand).rejects(error);

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.synced).toBe(1); // Considered synced (cloud wins)
      expect(body.failed).toEqual([]);
    });

    it('should delete S3 image when status is deleted', async () => {
      const event = createPostEvent('/sync', {
        userId: 'user-123',
        transactions: [
          {
            userId: 'user-123',
            transactionId: 'tx-1',
            imageId: 'img-1',
            s3Key: 'uploads/image.jpg',
            status: 'deleted',
            amount: 1000,
            date: '2026-01-20',
            type: 'income',
            category: 'sales',
            createdAt: '2026-01-20T09:00:00.000Z',
            updatedAt: '2026-01-20T10:00:00.000Z',
          },
        ],
      });

      ddbMock.on(PutItemCommand).resolves({});
      s3Mock.on(DeleteObjectCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(1);
    });

    it('should skip S3 deletion if no s3Key', async () => {
      const event = createPostEvent('/sync', {
        userId: 'user-123',
        transactions: [
          {
            userId: 'user-123',
            transactionId: 'tx-1',
            imageId: 'img-1',
            status: 'deleted',
            amount: 1000,
            date: '2026-01-20',
            type: 'income',
            category: 'sales',
            createdAt: '2026-01-20T09:00:00.000Z',
            updatedAt: '2026-01-20T10:00:00.000Z',
          },
        ],
      });

      ddbMock.on(PutItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(0);
    });

    it('should handle S3 deletion failure gracefully', async () => {
      const event = createPostEvent('/sync', {
        userId: 'user-123',
        transactions: [
          {
            userId: 'user-123',
            transactionId: 'tx-1',
            imageId: 'img-1',
            s3Key: 'uploads/image.jpg',
            status: 'deleted',
            amount: 1000,
            date: '2026-01-20',
            type: 'income',
            category: 'sales',
            createdAt: '2026-01-20T09:00:00.000Z',
            updatedAt: '2026-01-20T10:00:00.000Z',
          },
        ],
      });

      ddbMock.on(PutItemCommand).resolves({});
      s3Mock.on(DeleteObjectCommand).rejects(new Error('S3 error'));

      const result = await handler(event);

      // S3 failure should not fail the sync
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.synced).toBe(1);
    });

    it('should handle partial sync success', async () => {
      const event = createPostEvent('/sync', {
        userId: 'user-123',
        transactions: [
          {
            userId: 'user-123',
            transactionId: 'tx-1',
            imageId: 'img-1',
            amount: 1000,
            date: '2026-01-20',
            type: 'income',
            category: 'sales',
            createdAt: '2026-01-20T09:00:00.000Z',
            updatedAt: '2026-01-20T10:00:00.000Z',
          },
          {
            userId: 'user-123',
            transactionId: 'tx-2',
            imageId: 'img-2',
            amount: 2000,
            date: '2026-01-20',
            type: 'income',
            category: 'sales',
            createdAt: '2026-01-20T09:00:00.000Z',
            updatedAt: '2026-01-20T10:00:00.000Z',
          },
        ],
      });

      ddbMock
        .on(PutItemCommand)
        .resolvesOnce({})
        .rejectsOnce(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.synced).toBe(1);
      expect(body.failed).toEqual(['tx-2']);
    });
  });

  // =========================================================================
  // Test Suite 7: Response Format
  // =========================================================================

  describe('Response Format', () => {
    it('should include CORS headers in all responses', async () => {
      const event = createPostEvent('/transactions', {
        userId: 'user-123',
      });

      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });
  });

  // =========================================================================
  // Test Suite 8: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle invalid JSON body', async () => {
      const event = createPostEvent('/transactions', {});
      event.body = 'invalid-json{';

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('INTERNAL_ERROR');
    });

    it('should reject unsupported HTTP methods', async () => {
      const event = createPostEvent('/transactions', {});
      event.requestContext.http.method = 'PATCH';

      const result = await handler(event);

      expect(result.statusCode).toBe(405);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('METHOD_NOT_ALLOWED');
    });
  });
});
