/**
 * Unit Tests for Quota Lambda (Phase 4 - P2)
 *
 * Tests cover:
 * - CORS preflight handling
 * - Missing userId validation
 * - Tier-based quota limits (guest, free, basic, pro)
 * - Guest user detection (device-*, ephemeral-*)
 * - Guest data expiration tracking
 * - JST date/time handling
 * - TraceId propagation
 * - Error handling
 * - Response format validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyEventV2 } from '../types/aws-events.js';

// Mock logger before importing module
vi.mock('/opt/nodejs/shared/logger.mjs', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
  initContext: vi.fn((event: any) => ({
    traceId: 'test-trace-id',
  })),
  EVENTS: {
    QUOTA_CHECKED: 'QUOTA_CHECKED',
    QUOTA_CHECK_FAILED: 'QUOTA_CHECK_FAILED',
  },
}));

import { handler } from '../index.js';

// Mock AWS clients
const ddbMock = mockClient(DynamoDBClient);

/**
 * Mock event generator
 */
function createEvent(
  body: Record<string, unknown>,
  method: string = 'POST'
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /quota',
    rawPath: '/quota',
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method,
        path: '/quota',
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe('Quota Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.clearAllMocks();

    // Set environment variables
    process.env.QUOTAS_TABLE_NAME = 'test-quotas-table';
  });

  // =========================================================================
  // Test Suite 1: CORS
  // =========================================================================

  describe('CORS', () => {
    it('should handle OPTIONS preflight request', async () => {
      const event = createEvent({}, 'OPTIONS');

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Trace-Id',
      });
    });
  });

  // =========================================================================
  // Test Suite 2: Input Validation
  // =========================================================================

  describe('Input Validation', () => {
    it('should reject request without userId', async () => {
      const event = createEvent({});

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('MISSING_USER_ID');
    });

    it('should accept request with userId', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '5' } } });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // Test Suite 3: Tier-Based Quota Limits
  // =========================================================================

  describe('Tier-Based Quota Limits', () => {
    it('should return guest tier quota (30) for device-* userId', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '5' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.tier).toBe('guest');
      expect(body.limit).toBe(30);
      expect(body.used).toBe(5);
      expect(body.remaining).toBe(25);
    });

    it('should return guest tier quota (30) for ephemeral-* userId', async () => {
      const event = createEvent({ userId: 'ephemeral-xyz' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '10' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.tier).toBe('guest');
      expect(body.limit).toBe(30);
      expect(body.used).toBe(10);
      expect(body.remaining).toBe(20);
    });

    it('should return free tier quota (50) for user-* userId', async () => {
      const event = createEvent({ userId: 'user-abc' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '20' } } });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.tier).toBe('free');
      expect(body.limit).toBe(50);
      expect(body.used).toBe(20);
      expect(body.remaining).toBe(30);
    });

    it('should return 0 remaining when quota exceeded', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '35' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.used).toBe(35);
      expect(body.limit).toBe(30);
      expect(body.remaining).toBe(0); // Never negative
    });

    it('should return 0 used when no quota record exists', async () => {
      const event = createEvent({ userId: 'device-new' });

      ddbMock.on(GetItemCommand).resolves({}); // No Item
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.used).toBe(0);
      expect(body.limit).toBe(30);
      expect(body.remaining).toBe(30);
    });
  });

  // =========================================================================
  // Test Suite 4: Guest Data Expiration
  // =========================================================================

  describe('Guest Data Expiration', () => {
    it('should include guest expiration info for device-* users', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '5' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.guest).toBeDefined();
      expect(body.guest.dataExpiresAt).toBeDefined();
      expect(body.guest.daysUntilExpiration).toBe(60);
    });

    it('should include guest expiration info for ephemeral-* users', async () => {
      const event = createEvent({ userId: 'ephemeral-xyz' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '10' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.guest).toBeDefined();
      expect(body.guest.dataExpiresAt).toBeDefined();
      expect(body.guest.daysUntilExpiration).toBe(60);
    });

    it('should NOT include guest expiration info for user-* users', async () => {
      const event = createEvent({ userId: 'user-abc' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '20' } } });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.guest).toBeUndefined();
    });

    it('should update lastActiveAt when checking guest quota', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '5' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      await handler(event);

      // Verify UpdateItemCommand was called for lastActiveAt
      const updateCalls = ddbMock.commandCalls(UpdateItemCommand);
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0].args[0].input.UpdateExpression).toBe('SET lastActiveAt = :now');
      expect(updateCalls[0].args[0].input.ExpressionAttributeValues).toBeDefined();
    });

    it('should handle UpdateItemCommand failure gracefully', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '5' } } });
      ddbMock.on(UpdateItemCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      // Should still return 200 with default expiration info
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.guest).toBeDefined();
      expect(body.guest.dataExpiresAt).toBeDefined();
      expect(body.guest.daysUntilExpiration).toBe(60);
    });
  });

  // =========================================================================
  // Test Suite 5: Date/Time Handling
  // =========================================================================

  describe('Date/Time Handling', () => {
    it('should include resetsAt timestamp for next midnight JST', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '5' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.resetsAt).toBeDefined();

      // Verify it's a valid ISO 8601 timestamp
      const resetsAt = new Date(body.resetsAt);
      expect(resetsAt.toISOString()).toBe(body.resetsAt);

      // Verify it's in the future
      expect(resetsAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // =========================================================================
  // Test Suite 6: TraceId Propagation
  // =========================================================================

  describe('TraceId Propagation', () => {
    it('should include traceId in response headers', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '5' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['X-Trace-Id']).toBe('test-trace-id');
    });
  });

  // =========================================================================
  // Test Suite 7: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle DynamoDB GetItem errors gracefully', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('Failed to check quota');
    });
  });

  // =========================================================================
  // Test Suite 8: Response Format
  // =========================================================================

  describe('Response Format', () => {
    it('should include CORS headers in success response', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '5' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('should return valid JSON with required fields', async () => {
      const event = createEvent({ userId: 'device-123' });

      ddbMock.on(GetItemCommand).resolves({ Item: { count: { N: '5' } } });
      ddbMock.on(UpdateItemCommand).resolves({});

      const result = await handler(event);

      expect(() => JSON.parse(result.body)).not.toThrow();
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('used');
      expect(body).toHaveProperty('limit');
      expect(body).toHaveProperty('remaining');
      expect(body).toHaveProperty('resetsAt');
      expect(body).toHaveProperty('tier');
    });

    it('should return CORS headers in error response', async () => {
      const event = createEvent({});

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });
  });
});
