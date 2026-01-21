/**
 * Unit Tests for Admin Control Lambda (Phase 2 - P0)
 *
 * Tests cover:
 * - Emergency stop status GET (retrieve current state)
 * - Emergency stop toggle POST (activate/deactivate)
 * - History retrieval
 * - Input validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from '../types/aws-events.js';
import { handler } from '../index.js';

// Mock AWS clients
const dynamoDbMock = mockClient(DynamoDBClient);

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
    ADMIN_CONTROL_REQUEST: 'ADMIN_CONTROL_REQUEST',
    ADMIN_CONTROL_GET_HISTORY_FAILED: 'ADMIN_CONTROL_GET_HISTORY_FAILED',
    EMERGENCY_STOP_STATUS_CHANGED: 'EMERGENCY_STOP_STATUS_CHANGED',
    ADMIN_CONTROL_HANDLER_ERROR: 'ADMIN_CONTROL_HANDLER_ERROR',
  },
}));

/**
 * Mock event generators
 */
function createGetEvent(): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /admin/control',
    rawPath: '/admin/control',
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method: 'GET',
        path: '/admin/control',
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: null,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function createPostEvent(action: 'activate' | 'deactivate', reason?: string): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /admin/control',
    rawPath: '/admin/control',
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method: 'POST',
        path: '/admin/control',
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
      identity: {
        userArn: 'admin@example.com',
      } as any,
    } as any,
    body: JSON.stringify({ action, reason }),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe('Admin Control Lambda', () => {
  beforeEach(() => {
    // Reset mocks
    dynamoDbMock.reset();
    vi.clearAllMocks();

    // Set environment variables
    process.env.CONTROL_TABLE_NAME = 'test-control-table';
  });

  // =========================================================================
  // Test Suite 1: GET - Retrieve Status
  // =========================================================================

  describe('GET - Retrieve Status', () => {
    it('should retrieve current status (emergency stop inactive)', async () => {
      const event = createGetEvent();

      // Mock DynamoDB responses
      dynamoDbMock.on(GetItemCommand).resolves({
        Item: {
          key: { S: 'global_state' },
          emergency_stop: { BOOL: false },
          emergency_reason: { S: '' },
          updated_at: { S: '2026-01-21T10:00:00.000Z' },
          updated_by: { S: 'admin@example.com' },
        },
      });

      dynamoDbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.emergencyStop).toBe(false);
      expect(body.updatedAt).toBe('2026-01-21T10:00:00.000Z');
      expect(body.history).toEqual([]);
    });

    it('should retrieve current status (emergency stop active)', async () => {
      const event = createGetEvent();

      dynamoDbMock.on(GetItemCommand).resolves({
        Item: {
          key: { S: 'global_state' },
          emergency_stop: { BOOL: true },
          emergency_reason: { S: 'System maintenance' },
          updated_at: { S: '2026-01-21T10:00:00.000Z' },
          updated_by: { S: 'admin@example.com' },
        },
      });

      dynamoDbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.emergencyStop).toBe(true);
      expect(body.reason).toBe('System maintenance');
      expect(body.updatedBy).toBe('admin@example.com');
    });

    it('should return default status when no state exists', async () => {
      const event = createGetEvent();

      dynamoDbMock.on(GetItemCommand).resolves({});
      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.emergencyStop).toBe(false);
      expect(body.reason).toBe(null);
      expect(body.updatedAt).toBe(null);
      expect(body.updatedBy).toBe(null);
    });

    it('should handle query history error gracefully', async () => {
      const event = createGetEvent();

      dynamoDbMock.on(GetItemCommand).resolves({
        Item: {
          key: { S: 'global_state' },
          emergency_stop: { BOOL: false },
        },
      });

      dynamoDbMock.on(QueryCommand).rejects(new Error('Query failed'));

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.history).toEqual([]);
    });
  });

  // =========================================================================
  // Test Suite 2: POST - Toggle Status
  // =========================================================================

  describe('POST - Toggle Status', () => {
    it('should activate emergency stop', async () => {
      const event = createPostEvent('activate', 'System maintenance');

      dynamoDbMock.on(PutItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('activated successfully');
      expect(body.emergencyStop).toBe(true);
      expect(body.reason).toBe('System maintenance');
      expect(body.updatedBy).toBe('admin@example.com');

      // Verify DynamoDB was called twice (global state + history)
      expect(dynamoDbMock.commandCalls(PutItemCommand).length).toBe(2);
    });

    it('should deactivate emergency stop', async () => {
      const event = createPostEvent('deactivate', 'Maintenance complete');

      dynamoDbMock.on(PutItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('deactivated successfully');
      expect(body.emergencyStop).toBe(false);
      expect(body.reason).toBe('Maintenance complete');

      // Verify DynamoDB was called twice
      expect(dynamoDbMock.commandCalls(PutItemCommand).length).toBe(2);
    });

    it('should activate without reason', async () => {
      const event = createPostEvent('activate');

      dynamoDbMock.on(PutItemCommand).resolves({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.emergencyStop).toBe(true);
      expect(body.reason).toBe(null);
    });
  });

  // =========================================================================
  // Test Suite 3: Validation
  // =========================================================================

  describe('Validation', () => {
    it('should reject invalid action', async () => {
      const event = createPostEvent('invalid' as any);

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid action');
    });

    it('should reject empty action', async () => {
      const event: APIGatewayProxyEventV2 = {
        ...createPostEvent('activate'),
        body: JSON.stringify({}),
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid action');
    });

    it('should reject invalid method', async () => {
      const event: APIGatewayProxyEventV2 = {
        ...createGetEvent(),
        requestContext: {
          ...createGetEvent().requestContext,
          http: {
            method: 'DELETE',
            path: '/admin/control',
          },
        } as any,
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(405);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Method not allowed');
    });
  });

  // =========================================================================
  // Test Suite 4: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle DynamoDB error on GET', async () => {
      const event = createGetEvent();

      dynamoDbMock.on(GetItemCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle DynamoDB error on POST', async () => {
      const event = createPostEvent('activate', 'Test');

      dynamoDbMock.on(PutItemCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle malformed JSON body', async () => {
      const event: APIGatewayProxyEventV2 = {
        ...createPostEvent('activate'),
        body: 'invalid json{',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });
  });

  // =========================================================================
  // Test Suite 5: Response Format
  // =========================================================================

  describe('Response Format', () => {
    it('should include CORS headers in response', async () => {
      const event = createGetEvent();

      dynamoDbMock.on(GetItemCommand).resolves({});
      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('should return correctly formatted GET response', async () => {
      const event = createGetEvent();

      dynamoDbMock.on(GetItemCommand).resolves({
        Item: {
          key: { S: 'global_state' },
          emergency_stop: { BOOL: true },
          emergency_reason: { S: 'Test' },
          updated_at: { S: '2026-01-21T10:00:00.000Z' },
          updated_by: { S: 'admin@example.com' },
        },
      });

      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        emergencyStop: expect.any(Boolean),
        reason: expect.any(String),
        updatedAt: expect.any(String),
        updatedBy: expect.any(String),
        history: expect.any(Array),
      });
    });

    it('should return correctly formatted POST response', async () => {
      const event = createPostEvent('activate', 'Test');

      dynamoDbMock.on(PutItemCommand).resolves({});

      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        message: expect.any(String),
        emergencyStop: expect.any(Boolean),
        updatedAt: expect.any(String),
      });
    });
  });
});
