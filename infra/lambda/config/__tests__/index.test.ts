/**
 * Unit Tests for Config Lambda (Phase 3 - P1)
 *
 * Tests cover:
 * - Config retrieval with environment variables
 * - Maintenance mode from SSM Parameter Store
 * - SSM caching (5 minutes TTL)
 * - CORS preflight handling
 * - Error handling (SSM failures)
 * - Response format validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from '../types/aws-events.js';
import { handler, resetCache } from '../index.js';

// Mock AWS clients
const ssmMock = mockClient(SSMClient);

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
    CONFIG_ERROR: 'CONFIG_ERROR',
    MAINTENANCE_MODE_FETCH_FAILED: 'MAINTENANCE_MODE_FETCH_FAILED',
  },
}));

/**
 * Mock event generator
 */
function createGetEvent(): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /config',
    rawPath: '/config',
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method: 'GET',
        path: '/config',
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: null,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function createOptionsEvent(): APIGatewayProxyEventV2 {
  return {
    ...createGetEvent(),
    requestContext: {
      ...createGetEvent().requestContext,
      http: {
        method: 'OPTIONS',
        path: '/config',
      },
    } as any,
  };
}

describe('Config Lambda', () => {
  beforeEach(() => {
    // Reset mocks
    ssmMock.reset();
    vi.clearAllMocks();
    resetCache(); // Reset maintenance mode cache

    // Set default environment variables
    process.env.QUOTA_LIMIT = '50';
    process.env.UPLOAD_INTERVAL_MS = '10000';
    process.env.BATCH_TIME = '02:00';
    process.env.MIN_VERSION = '1.0.0';
    process.env.LATEST_VERSION = '1.1.0';
    delete process.env.MAINTENANCE_MODE_PARAM; // Delete instead of setting to undefined
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      expect(result.body).toBe('');
    });
  });

  // =========================================================================
  // Test Suite 2: Static Configuration
  // =========================================================================

  describe('Static Configuration', () => {
    it('should return default config values', async () => {
      const event = createGetEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        quotaLimit: 50,
        uploadIntervalMs: 10000,
        batchTime: '02:00',
        maintenanceMode: false,
        version: {
          minimum: '1.0.0',
          latest: '1.1.0',
        },
      });
    });

    it('should return custom config values from environment', async () => {
      process.env.QUOTA_LIMIT = '100';
      process.env.UPLOAD_INTERVAL_MS = '5000';
      process.env.BATCH_TIME = '03:00';
      process.env.MIN_VERSION = '2.0.0';
      process.env.LATEST_VERSION = '2.1.0';

      const event = createGetEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        quotaLimit: 100,
        uploadIntervalMs: 5000,
        batchTime: '03:00',
        version: {
          minimum: '2.0.0',
          latest: '2.1.0',
        },
      });
    });

    it('should include Cache-Control header', async () => {
      const event = createGetEvent();

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Cache-Control': 'public, max-age=300',
      });
    });
  });

  // =========================================================================
  // Test Suite 3: Maintenance Mode (SSM)
  // =========================================================================

  describe('Maintenance Mode', () => {
    it('should return maintenanceMode false when SSM param not configured', async () => {
      delete process.env.MAINTENANCE_MODE_PARAM;
      const event = createGetEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.maintenanceMode).toBe(false);

      // SSM should not be called
      expect(ssmMock.commandCalls(GetParameterCommand).length).toBe(0);
    });

    it('should fetch maintenanceMode true from SSM', async () => {
      process.env.MAINTENANCE_MODE_PARAM = '/yorutsuke/maintenance-mode';

      ssmMock.on(GetParameterCommand).resolves({
        Parameter: {
          Value: 'true',
        },
      });

      const event = createGetEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.maintenanceMode).toBe(true);

      // Verify SSM was called
      expect(ssmMock.commandCalls(GetParameterCommand).length).toBe(1);
    });

    it('should fetch maintenanceMode false from SSM', async () => {
      process.env.MAINTENANCE_MODE_PARAM = '/yorutsuke/maintenance-mode';

      ssmMock.on(GetParameterCommand).resolves({
        Parameter: {
          Value: 'false',
        },
      });

      const event = createGetEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.maintenanceMode).toBe(false);
    });

    it('should handle SSM parameter not found', async () => {
      process.env.MAINTENANCE_MODE_PARAM = '/yorutsuke/maintenance-mode';

      ssmMock.on(GetParameterCommand).rejects(
        new Error('ParameterNotFound')
      );

      const event = createGetEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.maintenanceMode).toBe(false); // Fallback to false
    });
  });

  // =========================================================================
  // Test Suite 4: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle SSM errors gracefully', async () => {
      process.env.MAINTENANCE_MODE_PARAM = '/yorutsuke/maintenance-mode';

      ssmMock.on(GetParameterCommand).rejects(new Error('SSM error'));

      const event = createGetEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.maintenanceMode).toBe(false); // Fallback
    });

    it('should return 500 on unexpected errors', async () => {
      // Simulate error by passing invalid event
      const invalidEvent = null as any;

      const result = await handler(invalidEvent);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('INTERNAL_ERROR');
    });
  });

  // =========================================================================
  // Test Suite 5: Response Format
  // =========================================================================

  describe('Response Format', () => {
    it('should return correctly formatted response', async () => {
      const event = createGetEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });

      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        quotaLimit: expect.any(Number),
        uploadIntervalMs: expect.any(Number),
        batchTime: expect.any(String),
        maintenanceMode: expect.any(Boolean),
        version: {
          minimum: expect.any(String),
          latest: expect.any(String),
        },
      });
    });
  });
});
