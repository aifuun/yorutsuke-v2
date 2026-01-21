/**
 * Unit Tests for Admin Stats Lambda (Phase 3 - P1)
 *
 * Tests cover:
 * - Emergency stop status retrieval
 * - Image count aggregation (today + total)
 * - Active user counting
 * - Batch process CloudWatch metrics
 * - Full stats response format
 * - Error handling for each AWS service
 * - CORS headers and JSON response validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, ScanCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
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
    ADMIN_STATS_REQUEST: 'ADMIN_STATS_REQUEST',
    ADMIN_STATS_EMERGENCY_ERROR: 'ADMIN_STATS_EMERGENCY_ERROR',
    ADMIN_STATS_IMAGES_ERROR: 'ADMIN_STATS_IMAGES_ERROR',
    ADMIN_STATS_USERS_ERROR: 'ADMIN_STATS_USERS_ERROR',
    ADMIN_STATS_BATCH_ERROR: 'ADMIN_STATS_BATCH_ERROR',
    ADMIN_STATS_HANDLER_ERROR: 'ADMIN_STATS_HANDLER_ERROR',
  },
}));

import { handler } from '../index.js';

// Mock AWS clients
const ddbMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);
const cloudwatchMock = mockClient(CloudWatchClient);

/**
 * Mock event generator
 */
function createGetEvent(): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /admin/stats',
    rawPath: '/admin/stats',
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method: 'GET',
        path: '/admin/stats',
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: null,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe('Admin Stats Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
    cloudwatchMock.reset();
    vi.clearAllMocks();
  });

  // =========================================================================
  // Test Suite 1: Emergency Stop Status
  // =========================================================================

  describe('Emergency Stop Status', () => {
    it('should fetch emergency stop status when enabled', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({
        Item: {
          key: { S: 'global_state' },
          emergency_stop: { BOOL: true },
          emergency_reason: { S: 'High error rate detected' },
          updated_at: { S: '2026-01-21T10:00:00.000Z' },
        },
      });

      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.emergency).toMatchObject({
        emergencyStop: true,
        reason: 'High error rate detected',
        updatedAt: '2026-01-21T10:00:00.000Z',
      });
    });

    it('should return default values when emergency item does not exist', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.emergency).toMatchObject({
        emergencyStop: false,
        reason: null,
        updatedAt: null,
      });
    });

    it('should handle DynamoDB GetItem errors gracefully', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).rejects(new Error('DynamoDB GetItem error'));
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.emergency).toMatchObject({
        emergencyStop: false,
        reason: null,
        updatedAt: null,
      });
    });
  });

  // =========================================================================
  // Test Suite 2: Image Counts
  // =========================================================================

  describe('Image Counts', () => {
    it('should count today images correctly', async () => {
      const event = createGetEvent();
      const today = new Date().toISOString().split('T')[0];

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'uploads/img1.jpg', LastModified: new Date(`${today}T10:00:00.000Z`) },
          { Key: 'uploads/img2.jpg', LastModified: new Date(`${today}T11:00:00.000Z`) },
          { Key: 'uploads/img3.jpg', LastModified: new Date('2026-01-20T12:00:00.000Z') },
        ],
        KeyCount: 3,
      });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.images.today).toBe(2);
      expect(body.images.total).toBe(3);
    });

    it('should return zero when no images found', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.images).toMatchObject({
        today: 0,
        total: 0,
      });
    });

    it('should handle S3 errors gracefully', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).rejects(new Error('S3 error'));
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.images).toMatchObject({
        today: 0,
        total: 0,
      });
    });
  });

  // =========================================================================
  // Test Suite 3: Active Users
  // =========================================================================

  describe('Active Users', () => {
    it('should count active users for today', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 15 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.activeUsers).toBe(15);
    });

    it('should return 0 when no active users', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.activeUsers).toBe(0);
    });

    it('should handle DynamoDB Scan errors gracefully', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).rejects(new Error('DynamoDB Scan error'));
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.activeUsers).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 4: Batch Metrics
  // =========================================================================

  describe('Batch Metrics', () => {
    it('should fetch CloudWatch batch metrics', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({
        MetricDataResults: [
          { Id: 'invocations', Values: [120] },
          { Id: 'errors', Values: [5] },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.batch).toMatchObject({
        invocations: 120,
        errors: 5,
        lastRun: null,
      });
    });

    it('should handle missing CloudWatch metric data', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.batch).toMatchObject({
        invocations: 0,
        errors: 0,
        lastRun: null,
      });
    });

    it('should handle CloudWatch errors gracefully', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).rejects(new Error('CloudWatch error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.batch).toMatchObject({
        invocations: 0,
        errors: 0,
        lastRun: null,
      });
    });
  });

  // =========================================================================
  // Test Suite 5: Full Stats Response
  // =========================================================================

  describe('Full Stats Response', () => {
    it('should return complete stats with all data', async () => {
      const event = createGetEvent();
      const today = new Date().toISOString().split('T')[0];

      ddbMock.on(GetItemCommand).resolves({
        Item: {
          key: { S: 'global_state' },
          emergency_stop: { BOOL: false },
          emergency_reason: { S: null },
          updated_at: { S: '2026-01-21T10:00:00.000Z' },
        },
      });
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: 'uploads/img1.jpg', LastModified: new Date(`${today}T10:00:00.000Z`) },
        ],
        KeyCount: 1,
      });
      ddbMock.on(ScanCommand).resolves({ Count: 10 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({
        MetricDataResults: [
          { Id: 'invocations', Values: [50] },
          { Id: 'errors', Values: [2] },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('emergency');
      expect(body).toHaveProperty('images');
      expect(body).toHaveProperty('activeUsers');
      expect(body).toHaveProperty('batch');
      expect(body).toHaveProperty('generatedAt');
      expect(body.activeUsers).toBe(10);
      expect(body.images.today).toBe(1);
      expect(body.batch.invocations).toBe(50);
    });

    it('should include generatedAt timestamp', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.generatedAt).toBeTruthy();
      expect(new Date(body.generatedAt).toISOString()).toBe(body.generatedAt);
    });
  });

  // =========================================================================
  // Test Suite 6: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle handler-level errors', async () => {
      const event = createGetEvent();

      // Simulate all services failing
      ddbMock.on(GetItemCommand).rejects(new Error('Fatal error'));
      s3Mock.on(ListObjectsV2Command).rejects(new Error('Fatal error'));
      ddbMock.on(ScanCommand).rejects(new Error('Fatal error'));
      cloudwatchMock.on(GetMetricDataCommand).rejects(new Error('Fatal error'));

      const result = await handler(event);

      // Should still return 200 with graceful defaults
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.emergency.emergencyStop).toBe(false);
      expect(body.images.today).toBe(0);
      expect(body.activeUsers).toBe(0);
      expect(body.batch.invocations).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 7: Response Format
  // =========================================================================

  describe('Response Format', () => {
    it('should include CORS headers', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('should return valid JSON', async () => {
      const event = createGetEvent();

      ddbMock.on(GetItemCommand).resolves({});
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [], KeyCount: 0 });
      ddbMock.on(ScanCommand).resolves({ Count: 0 });
      cloudwatchMock.on(GetMetricDataCommand).resolves({ MetricDataResults: [] });

      const result = await handler(event);

      expect(() => JSON.parse(result.body)).not.toThrow();
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('emergency');
      expect(body).toHaveProperty('images');
      expect(body).toHaveProperty('activeUsers');
      expect(body).toHaveProperty('batch');
      expect(body).toHaveProperty('generatedAt');
    });
  });
});
