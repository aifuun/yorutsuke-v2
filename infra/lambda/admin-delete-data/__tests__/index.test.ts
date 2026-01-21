/**
 * Unit Tests for Admin Delete Data Lambda (Phase 2 - P0)
 *
 * Tests cover:
 * - User data deletion from DynamoDB and S3
 * - Input validation
 * - Batch processing
 * - CORS handling
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from '../types/aws-events.js';
import { handler } from '../index.js';

// Mock AWS clients
const dynamoDbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

// Mock logger
vi.mock('/opt/nodejs/shared/logger.mjs', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
  initContext: vi.fn(),
  EVENTS: {
    ADMIN_DELETE_DATA_START: 'ADMIN_DELETE_DATA_START',
    ADMIN_DELETE_DATA_COMPLETED: 'ADMIN_DELETE_DATA_COMPLETED',
    ADMIN_DELETE_DATA_ERROR: 'ADMIN_DELETE_DATA_ERROR',
    DELETE_USER_TRANSACTIONS_STARTED: 'DELETE_USER_TRANSACTIONS_STARTED',
    DELETE_USER_TRANSACTIONS_FOUND: 'DELETE_USER_TRANSACTIONS_FOUND',
    DELETE_USER_TRANSACTIONS_BATCH_COMPLETED: 'DELETE_USER_TRANSACTIONS_BATCH_COMPLETED',
    DELETE_USER_IMAGES_STARTED: 'DELETE_USER_IMAGES_STARTED',
    DELETE_USER_IMAGES_FOUND: 'DELETE_USER_IMAGES_FOUND',
    DELETE_USER_IMAGES_BATCH_COMPLETED: 'DELETE_USER_IMAGES_BATCH_COMPLETED',
  },
}));

/**
 * Mock data generators
 */
function createMockEvent(body: Record<string, unknown>, method = 'POST'): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /admin/delete-data',
    rawPath: '/admin/delete-data',
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method,
        path: '/admin/delete-data',
      },
      requestId: 'test-request-id',
    } as any,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function createMockDynamoDBItems(count: number, userId: string) {
  return Array.from({ length: count }, (_, i) => ({
    userId,
    transactionId: `txn-${i}`,
  }));
}

function createMockS3Objects(count: number, userId: string) {
  return Array.from({ length: count }, (_, i) => ({
    Key: `uploads/${userId}/img-${i}.jpg`,
    Size: 1024,
  }));
}

describe('Admin Delete Data Lambda', () => {
  beforeEach(() => {
    // Reset mocks
    dynamoDbMock.reset();
    s3Mock.reset();
    vi.clearAllMocks();

    // Set environment variables
    process.env.TRANSACTIONS_TABLE = 'test-transactions-table';
    process.env.IMAGES_BUCKET = 'test-images-bucket';
  });

  // =========================================================================
  // Test Suite 1: CORS Handling
  // =========================================================================

  describe('CORS Handling', () => {
    it('should handle OPTIONS request with CORS headers', async () => {
      const event = createMockEvent({}, 'OPTIONS');

      const result = await handler(event);

      expect(result.statusCode).toBe(204);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      });
    });
  });

  // =========================================================================
  // Test Suite 2: Input Validation
  // =========================================================================

  describe('Input Validation', () => {
    it('should reject missing userId', async () => {
      const event = createMockEvent({
        types: ['transactions'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('userId');
    });

    it('should reject invalid userId type', async () => {
      const event = createMockEvent({
        userId: 123,
        types: ['transactions'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('userId');
    });

    it('should reject missing types array', async () => {
      const event = createMockEvent({
        userId: 'user-123',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('types');
    });

    it('should reject empty types array', async () => {
      const event = createMockEvent({
        userId: 'user-123',
        types: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('types');
    });

    it('should reject invalid types', async () => {
      const event = createMockEvent({
        userId: 'user-123',
        types: ['transactions', 'invalid-type'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid types');
    });
  });

  // =========================================================================
  // Test Suite 3: Delete Transactions
  // =========================================================================

  describe('Delete Transactions', () => {
    it('should delete transactions successfully', async () => {
      const userId = 'user-123';
      const mockItems = createMockDynamoDBItems(10, userId);

      dynamoDbMock.on(QueryCommand).resolves({
        Items: mockItems,
        LastEvaluatedKey: undefined,
      });
      dynamoDbMock.on(BatchWriteCommand).resolves({});

      const event = createMockEvent({
        userId,
        types: ['transactions'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(10);
    });

    it('should handle paginated DynamoDB query', async () => {
      const userId = 'user-123';
      const batch1 = createMockDynamoDBItems(5, userId);
      const batch2 = createMockDynamoDBItems(5, userId);

      dynamoDbMock
        .on(QueryCommand)
        .resolvesOnce({
          Items: batch1,
          LastEvaluatedKey: { userId, transactionId: 'txn-4' },
        })
        .resolvesOnce({
          Items: batch2,
          LastEvaluatedKey: undefined,
        });
      dynamoDbMock.on(BatchWriteCommand).resolves({});

      const event = createMockEvent({
        userId,
        types: ['transactions'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(10);
    });

    it('should handle batch deletion (>25 items)', async () => {
      const userId = 'user-123';
      const mockItems = createMockDynamoDBItems(30, userId);

      dynamoDbMock.on(QueryCommand).resolves({
        Items: mockItems,
        LastEvaluatedKey: undefined,
      });
      dynamoDbMock.on(BatchWriteCommand).resolves({});

      const event = createMockEvent({
        userId,
        types: ['transactions'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(30);
      // Should make 2 batch calls (25 + 5)
      expect(dynamoDbMock.commandCalls(BatchWriteCommand).length).toBe(2);
    });

    it('should handle zero transactions', async () => {
      const userId = 'user-123';

      dynamoDbMock.on(QueryCommand).resolves({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const event = createMockEvent({
        userId,
        types: ['transactions'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 4: Delete Images
  // =========================================================================

  describe('Delete Images', () => {
    it('should delete images successfully', async () => {
      const userId = 'user-123';
      const mockObjects = createMockS3Objects(10, userId);

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: mockObjects,
        NextContinuationToken: undefined,
      });
      s3Mock.on(DeleteObjectsCommand).resolves({});

      const event = createMockEvent({
        userId,
        types: ['images'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.images).toBe(10);
    });

    it('should handle paginated S3 list', async () => {
      const userId = 'user-123';
      const batch1 = createMockS3Objects(5, userId);
      const batch2 = createMockS3Objects(5, userId);

      s3Mock
        .on(ListObjectsV2Command)
        .resolvesOnce({
          Contents: batch1,
          NextContinuationToken: 'token-123',
        })
        .resolvesOnce({
          Contents: batch2,
          NextContinuationToken: undefined,
        });
      s3Mock.on(DeleteObjectsCommand).resolves({});

      const event = createMockEvent({
        userId,
        types: ['images'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.images).toBe(10);
    });

    it('should handle batch deletion (>1000 objects)', async () => {
      const userId = 'user-123';
      const mockObjects = createMockS3Objects(1500, userId);

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: mockObjects,
        NextContinuationToken: undefined,
      });
      s3Mock.on(DeleteObjectsCommand).resolves({});

      const event = createMockEvent({
        userId,
        types: ['images'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.images).toBe(1500);
      // Should make 2 batch calls (1000 + 500)
      expect(s3Mock.commandCalls(DeleteObjectsCommand).length).toBe(2);
    });

    it('should handle zero images', async () => {
      const userId = 'user-123';

      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
        NextContinuationToken: undefined,
      });

      const event = createMockEvent({
        userId,
        types: ['images'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.images).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 5: Combined Deletion
  // =========================================================================

  describe('Combined Deletion', () => {
    it('should delete both transactions and images', async () => {
      const userId = 'user-123';
      const mockTransactions = createMockDynamoDBItems(10, userId);
      const mockImages = createMockS3Objects(5, userId);

      dynamoDbMock.on(QueryCommand).resolves({
        Items: mockTransactions,
        LastEvaluatedKey: undefined,
      });
      dynamoDbMock.on(BatchWriteCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: mockImages,
        NextContinuationToken: undefined,
      });
      s3Mock.on(DeleteObjectsCommand).resolves({});

      const event = createMockEvent({
        userId,
        types: ['transactions', 'images'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(10);
      expect(body.deleted.images).toBe(5);
    });
  });

  // =========================================================================
  // Test Suite 6: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle DynamoDB error', async () => {
      const userId = 'user-123';

      dynamoDbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const event = createMockEvent({
        userId,
        types: ['transactions'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle S3 error', async () => {
      const userId = 'user-123';

      s3Mock.on(ListObjectsV2Command).rejects(new Error('S3 error'));

      const event = createMockEvent({
        userId,
        types: ['images'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle malformed JSON body', async () => {
      const event = {
        ...createMockEvent({}, 'POST'),
        body: '{invalid-json}',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });
});
