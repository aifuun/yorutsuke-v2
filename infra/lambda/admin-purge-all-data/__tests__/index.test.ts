/**
 * Unit Tests for Admin Purge All Data Lambda (Phase 2 - P0)
 *
 * Tests cover:
 * - Admin authorization validation
 * - Purge all transactions from DynamoDB (SCAN)
 * - Purge all images from S3
 * - Audit logging to CloudWatch
 * - CORS handling
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { CloudWatchLogsClient, CreateLogStreamCommand, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from '../types/aws-events.js';
import { handler } from '../index.js';

// Mock AWS clients
const dynamoDbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);
const cloudwatchMock = mockClient(CloudWatchLogsClient);

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
    ADMIN_PURGE_ALL_DATA_REQUEST: 'ADMIN_PURGE_ALL_DATA_REQUEST',
    ADMIN_PURGE_ALL_DATA_INITIATED: 'ADMIN_PURGE_ALL_DATA_INITIATED',
    ADMIN_PURGE_ALL_DATA_COMPLETED: 'ADMIN_PURGE_ALL_DATA_COMPLETED',
    ADMIN_PURGE_ALL_DATA_ERROR: 'ADMIN_PURGE_ALL_DATA_ERROR',
    ADMIN_PURGE_UNAUTHORIZED: 'ADMIN_PURGE_UNAUTHORIZED',
    PURGE_ALL_TRANSACTIONS_STARTED: 'PURGE_ALL_TRANSACTIONS_STARTED',
    PURGE_ALL_TRANSACTIONS_SCAN_BATCH: 'PURGE_ALL_TRANSACTIONS_SCAN_BATCH',
    PURGE_ALL_TRANSACTIONS_FOUND: 'PURGE_ALL_TRANSACTIONS_FOUND',
    PURGE_ALL_TRANSACTIONS_BATCH_COMPLETED: 'PURGE_ALL_TRANSACTIONS_BATCH_COMPLETED',
    PURGE_ALL_IMAGES_STARTED: 'PURGE_ALL_IMAGES_STARTED',
    PURGE_ALL_IMAGES_LIST_BATCH: 'PURGE_ALL_IMAGES_LIST_BATCH',
    PURGE_ALL_IMAGES_FOUND: 'PURGE_ALL_IMAGES_FOUND',
    PURGE_ALL_IMAGES_BATCH_COMPLETED: 'PURGE_ALL_IMAGES_BATCH_COMPLETED',
    AUDIT_LOG_WRITE_FAILED: 'AUDIT_LOG_WRITE_FAILED',
  },
}));

/**
 * Mock data generators
 */
function createMockEvent(adminUserId?: string, method = 'POST'): APIGatewayProxyEventV2 {
  const headers: Record<string, string> = {};
  if (adminUserId) {
    headers['x-admin-user-id'] = adminUserId;
  }

  return {
    version: '2.0',
    routeKey: 'POST /admin/purge-all-data',
    rawPath: '/admin/purge-all-data',
    rawQueryString: '',
    headers,
    requestContext: {
      http: {
        method,
        path: '/admin/purge-all-data',
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: null,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function createMockDynamoDBItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    userId: `user-${i}`,
    transactionId: `txn-${i}`,
  }));
}

function createMockS3Objects(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    Key: `uploads/user-${i}/img-${i}.jpg`,
    Size: 1024,
  }));
}

describe('Admin Purge All Data Lambda', () => {
  beforeEach(() => {
    // Reset mocks
    dynamoDbMock.reset();
    s3Mock.reset();
    cloudwatchMock.reset();
    vi.clearAllMocks();

    // Set environment variables
    process.env.TRANSACTIONS_TABLE = 'test-transactions-table';
    process.env.IMAGES_BUCKET = 'test-images-bucket';

    // Mock CloudWatch audit logging (always succeed)
    cloudwatchMock.on(CreateLogStreamCommand).resolves({});
    cloudwatchMock.on(PutLogEventsCommand).resolves({});
  });

  // =========================================================================
  // Test Suite 1: CORS Handling
  // =========================================================================

  describe('CORS Handling', () => {
    it('should handle OPTIONS request with CORS headers', async () => {
      const event = createMockEvent('admin-123', 'OPTIONS');

      const result = await handler(event);

      expect(result.statusCode).toBe(204);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-user-id',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      });
    });
  });

  // =========================================================================
  // Test Suite 2: Authorization
  // =========================================================================

  describe('Authorization', () => {
    it('should reject request without admin user ID', async () => {
      const event = createMockEvent(); // No adminUserId

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Unauthorized');
    });

    it('should reject request with empty admin user ID', async () => {
      const event = createMockEvent(''); // Empty adminUserId

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Unauthorized');
    });

    it('should accept request with valid admin user ID', async () => {
      const event = createMockEvent('admin-123');

      // Mock empty data
      dynamoDbMock.on(ScanCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // Test Suite 3: Purge All Transactions
  // =========================================================================

  describe('Purge All Transactions', () => {
    it('should purge all transactions successfully', async () => {
      const event = createMockEvent('admin-123');
      const mockItems = createMockDynamoDBItems(10);

      dynamoDbMock.on(ScanCommand).resolves({
        Items: mockItems,
        LastEvaluatedKey: undefined,
      });
      dynamoDbMock.on(BatchWriteCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(10);
    });

    it('should handle paginated DynamoDB scan', async () => {
      const event = createMockEvent('admin-123');
      const batch1 = createMockDynamoDBItems(5);
      const batch2 = createMockDynamoDBItems(5);

      dynamoDbMock
        .on(ScanCommand)
        .resolvesOnce({
          Items: batch1,
          LastEvaluatedKey: { userId: 'user-4', transactionId: 'txn-4' },
        })
        .resolvesOnce({
          Items: batch2,
          LastEvaluatedKey: undefined,
        });
      dynamoDbMock.on(BatchWriteCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(10);
    });

    it('should handle batch deletion (>25 items)', async () => {
      const event = createMockEvent('admin-123');
      const mockItems = createMockDynamoDBItems(30);

      dynamoDbMock.on(ScanCommand).resolves({
        Items: mockItems,
        LastEvaluatedKey: undefined,
      });
      dynamoDbMock.on(BatchWriteCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(30);
      // Should make 2 batch calls (25 + 5)
      expect(dynamoDbMock.commandCalls(BatchWriteCommand).length).toBe(2);
    });

    it('should handle zero transactions', async () => {
      const event = createMockEvent('admin-123');

      dynamoDbMock.on(ScanCommand).resolves({
        Items: [],
        LastEvaluatedKey: undefined,
      });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 4: Purge All Images
  // =========================================================================

  describe('Purge All Images', () => {
    it('should purge all images successfully', async () => {
      const event = createMockEvent('admin-123');
      const mockObjects = createMockS3Objects(10);

      dynamoDbMock.on(ScanCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: mockObjects,
        NextContinuationToken: undefined,
      });
      s3Mock.on(DeleteObjectsCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.images).toBe(10);
    });

    it('should handle paginated S3 list', async () => {
      const event = createMockEvent('admin-123');
      const batch1 = createMockS3Objects(5);
      const batch2 = createMockS3Objects(5);

      dynamoDbMock.on(ScanCommand).resolves({ Items: [] });
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

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.images).toBe(10);
    });

    it('should handle batch deletion (>1000 objects)', async () => {
      const event = createMockEvent('admin-123');
      const mockObjects = createMockS3Objects(1500);

      dynamoDbMock.on(ScanCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: mockObjects,
        NextContinuationToken: undefined,
      });
      s3Mock.on(DeleteObjectsCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.images).toBe(1500);
      // Should make 2 batch calls (1000 + 500)
      expect(s3Mock.commandCalls(DeleteObjectsCommand).length).toBe(2);
    });

    it('should handle zero images', async () => {
      const event = createMockEvent('admin-123');

      dynamoDbMock.on(ScanCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
        NextContinuationToken: undefined,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.images).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 5: Combined Purge
  // =========================================================================

  describe('Combined Purge', () => {
    it('should purge both transactions and images', async () => {
      const event = createMockEvent('admin-123');
      const mockTransactions = createMockDynamoDBItems(10);
      const mockImages = createMockS3Objects(5);

      dynamoDbMock.on(ScanCommand).resolves({
        Items: mockTransactions,
        LastEvaluatedKey: undefined,
      });
      dynamoDbMock.on(BatchWriteCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: mockImages,
        NextContinuationToken: undefined,
      });
      s3Mock.on(DeleteObjectsCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.deleted.transactions).toBe(10);
      expect(body.deleted.images).toBe(5);
      expect(body.adminUserId).toBe('admin-123');
      expect(body.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // Test Suite 6: Audit Logging
  // =========================================================================

  describe('Audit Logging', () => {
    it('should write audit logs for purge operation', async () => {
      const event = createMockEvent('admin-123');

      dynamoDbMock.on(ScanCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

      await handler(event);

      // Should create log stream and write events
      expect(cloudwatchMock.commandCalls(CreateLogStreamCommand).length).toBeGreaterThanOrEqual(1);
      expect(cloudwatchMock.commandCalls(PutLogEventsCommand).length).toBeGreaterThanOrEqual(2);
    });

    it('should continue operation if audit logging fails', async () => {
      const event = createMockEvent('admin-123');

      dynamoDbMock.on(ScanCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      cloudwatchMock.on(PutLogEventsCommand).rejects(new Error('CloudWatch error'));

      const result = await handler(event);

      // Should still succeed even if audit logging fails
      expect(result.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // Test Suite 7: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle DynamoDB error', async () => {
      const event = createMockEvent('admin-123');

      dynamoDbMock.on(ScanCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle S3 error', async () => {
      const event = createMockEvent('admin-123');

      dynamoDbMock.on(ScanCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).rejects(new Error('S3 error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should log failure to audit trail', async () => {
      const event = createMockEvent('admin-123');

      dynamoDbMock.on(ScanCommand).rejects(new Error('Test error'));

      await handler(event);

      // Should write failure audit log
      expect(cloudwatchMock.commandCalls(PutLogEventsCommand).length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Test Suite 8: Response Format
  // =========================================================================

  describe('Response Format', () => {
    it('should return correctly formatted response', async () => {
      const event = createMockEvent('admin-123');

      dynamoDbMock.on(ScanCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        action: 'admin_purge_all_data',
        adminUserId: 'admin-123',
        deleted: {
          transactions: 0,
          images: 0,
        },
        timestamp: expect.any(String),
      });
    });
  });
});
