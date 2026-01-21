/**
 * Unit Tests for Admin Costs Lambda (Phase 3 - P1)
 *
 * Tests cover:
 * - Cost data retrieval for different periods (7d, 30d, 90d)
 * - Daily cost breakdown
 * - Service-level breakdown with percentages
 * - Period validation
 * - Cost Explorer error handling (AccessDenied)
 * - Response format validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
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
    ADMIN_COSTS_REQUEST: 'ADMIN_COSTS_REQUEST',
    ADMIN_COSTS_FETCH_ERROR: 'ADMIN_COSTS_FETCH_ERROR',
    ADMIN_COSTS_HANDLER_ERROR: 'ADMIN_COSTS_HANDLER_ERROR',
  },
}));

import { handler } from '../index.js';

// Mock AWS clients
const ceMock = mockClient(CostExplorerClient);

/**
 * Mock event generator
 */
function createGetEvent(queryParams: Record<string, string> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /admin/costs',
    rawPath: '/admin/costs',
    rawQueryString: new URLSearchParams(queryParams).toString(),
    headers: {},
    requestContext: {
      http: {
        method: 'GET',
        path: '/admin/costs',
        sourceIp: '192.168.1.1',
      },
      requestId: 'test-request-id',
    } as any,
    body: null,
    isBase64Encoded: false,
    queryStringParameters: queryParams,
  } as APIGatewayProxyEventV2;
}

describe('Admin Costs Lambda', () => {
  beforeEach(() => {
    ceMock.reset();
    vi.clearAllMocks();
  });

  // =========================================================================
  // Test Suite 1: Cost Data Retrieval
  // =========================================================================

  describe('Cost Data Retrieval', () => {
    it('should fetch costs for default period (7d)', async () => {
      const event = createGetEvent();

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({
          ResultsByTime: [
            {
              TimePeriod: { Start: '2026-01-14', End: '2026-01-15' },
              Total: { BlendedCost: { Amount: '10.50', Unit: 'USD' } },
            },
            {
              TimePeriod: { Start: '2026-01-15', End: '2026-01-16' },
              Total: { BlendedCost: { Amount: '12.30', Unit: 'USD' } },
            },
          ],
        })
        .resolvesOnce({
          ResultsByTime: [
            {
              Groups: [
                {
                  Keys: ['Amazon S3'],
                  Metrics: { BlendedCost: { Amount: '15.00', Unit: 'USD' } },
                },
                {
                  Keys: ['AWS Lambda'],
                  Metrics: { BlendedCost: { Amount: '7.80', Unit: 'USD' } },
                },
              ],
            },
          ],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        period: '7d',
        currency: 'USD',
        total: expect.any(Number),
        daily: expect.arrayContaining([
          expect.objectContaining({ date: expect.any(String), amount: expect.any(Number) }),
        ]),
        services: expect.arrayContaining([
          expect.objectContaining({
            service: expect.any(String),
            amount: expect.any(Number),
            percentage: expect.any(Number),
          }),
        ]),
      });
    });

    it('should fetch costs for 30d period', async () => {
      const event = createGetEvent({ period: '30d' });

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({
          ResultsByTime: [
            {
              TimePeriod: { Start: '2025-12-22', End: '2025-12-23' },
              Total: { BlendedCost: { Amount: '5.00', Unit: 'USD' } },
            },
          ],
        })
        .resolvesOnce({
          ResultsByTime: [
            {
              Groups: [
                {
                  Keys: ['Amazon S3'],
                  Metrics: { BlendedCost: { Amount: '100.00', Unit: 'USD' } },
                },
              ],
            },
          ],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.period).toBe('30d');
    });

    it('should fetch costs for 90d period', async () => {
      const event = createGetEvent({ period: '90d' });

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({
          ResultsByTime: [
            {
              TimePeriod: { Start: '2025-10-23', End: '2025-10-24' },
              Total: { BlendedCost: { Amount: '2.50', Unit: 'USD' } },
            },
          ],
        })
        .resolvesOnce({
          ResultsByTime: [
            {
              Groups: [
                {
                  Keys: ['AWS Lambda'],
                  Metrics: { BlendedCost: { Amount: '200.00', Unit: 'USD' } },
                },
              ],
            },
          ],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.period).toBe('90d');
    });
  });

  // =========================================================================
  // Test Suite 2: Daily Cost Breakdown
  // =========================================================================

  describe('Daily Cost Breakdown', () => {
    it('should parse daily costs correctly', async () => {
      const event = createGetEvent();

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({
          ResultsByTime: [
            {
              TimePeriod: { Start: '2026-01-14', End: '2026-01-15' },
              Total: { BlendedCost: { Amount: '10.50', Unit: 'USD' } },
            },
            {
              TimePeriod: { Start: '2026-01-15', End: '2026-01-16' },
              Total: { BlendedCost: { Amount: '12.30', Unit: 'USD' } },
            },
          ],
        })
        .resolvesOnce({
          ResultsByTime: [{ Groups: [] }],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.daily).toHaveLength(2);
      expect(body.daily[0]).toMatchObject({
        date: '2026-01-14',
        amount: 10.5,
      });
      expect(body.daily[1]).toMatchObject({
        date: '2026-01-15',
        amount: 12.3,
      });
    });

    it('should handle missing daily data', async () => {
      const event = createGetEvent();

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({
          ResultsByTime: [],
        })
        .resolvesOnce({
          ResultsByTime: [{ Groups: [] }],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.daily).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 3: Service Breakdown
  // =========================================================================

  describe('Service Breakdown', () => {
    it('should parse service breakdown correctly', async () => {
      const event = createGetEvent();

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({
          ResultsByTime: [
            {
              TimePeriod: { Start: '2026-01-14', End: '2026-01-15' },
              Total: { BlendedCost: { Amount: '100.00', Unit: 'USD' } },
            },
          ],
        })
        .resolvesOnce({
          ResultsByTime: [
            {
              Groups: [
                {
                  Keys: ['Amazon S3'],
                  Metrics: { BlendedCost: { Amount: '60.00', Unit: 'USD' } },
                },
                {
                  Keys: ['AWS Lambda'],
                  Metrics: { BlendedCost: { Amount: '40.00', Unit: 'USD' } },
                },
              ],
            },
          ],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.services).toHaveLength(2);
      expect(body.services[0]).toMatchObject({
        service: 'Amazon S3',
        amount: 60.0,
        percentage: 60.0,
      });
      expect(body.services[1]).toMatchObject({
        service: 'AWS Lambda',
        amount: 40.0,
        percentage: 40.0,
      });
    });

    it('should sort services by amount descending', async () => {
      const event = createGetEvent();

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({
          ResultsByTime: [
            {
              TimePeriod: { Start: '2026-01-14', End: '2026-01-15' },
              Total: { BlendedCost: { Amount: '100.00', Unit: 'USD' } },
            },
          ],
        })
        .resolvesOnce({
          ResultsByTime: [
            {
              Groups: [
                {
                  Keys: ['AWS Lambda'],
                  Metrics: { BlendedCost: { Amount: '10.00', Unit: 'USD' } },
                },
                {
                  Keys: ['Amazon S3'],
                  Metrics: { BlendedCost: { Amount: '50.00', Unit: 'USD' } },
                },
                {
                  Keys: ['DynamoDB'],
                  Metrics: { BlendedCost: { Amount: '30.00', Unit: 'USD' } },
                },
              ],
            },
          ],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.services[0].service).toBe('Amazon S3');
      expect(body.services[1].service).toBe('DynamoDB');
      expect(body.services[2].service).toBe('AWS Lambda');
    });

    it('should filter out zero-cost services', async () => {
      const event = createGetEvent();

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({
          ResultsByTime: [
            {
              TimePeriod: { Start: '2026-01-14', End: '2026-01-15' },
              Total: { BlendedCost: { Amount: '50.00', Unit: 'USD' } },
            },
          ],
        })
        .resolvesOnce({
          ResultsByTime: [
            {
              Groups: [
                {
                  Keys: ['Amazon S3'],
                  Metrics: { BlendedCost: { Amount: '50.00', Unit: 'USD' } },
                },
                {
                  Keys: ['AWS Lambda'],
                  Metrics: { BlendedCost: { Amount: '0.00', Unit: 'USD' } },
                },
              ],
            },
          ],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.services).toHaveLength(1);
      expect(body.services[0].service).toBe('Amazon S3');
    });

    it('should handle missing service data', async () => {
      const event = createGetEvent();

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({
          ResultsByTime: [
            {
              TimePeriod: { Start: '2026-01-14', End: '2026-01-15' },
              Total: { BlendedCost: { Amount: '10.00', Unit: 'USD' } },
            },
          ],
        })
        .resolvesOnce({
          ResultsByTime: [{ Groups: [] }],
        });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.services).toEqual([]);
    });
  });

  // =========================================================================
  // Test Suite 4: Validation
  // =========================================================================

  describe('Validation', () => {
    it('should reject invalid period', async () => {
      const event = createGetEvent({ period: '1d' });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid period');
    });

    it('should reject invalid period format', async () => {
      const event = createGetEvent({ period: 'invalid' });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid period');
    });
  });

  // =========================================================================
  // Test Suite 5: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle Cost Explorer AccessDenied error', async () => {
      const event = createGetEvent();

      const error: any = new Error('Access Denied');
      error.name = 'AccessDeniedException';
      ceMock.on(GetCostAndUsageCommand).rejects(error);

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Cost Explorer access denied');
    });

    it('should handle generic Cost Explorer errors', async () => {
      const event = createGetEvent();

      ceMock.on(GetCostAndUsageCommand).rejects(new Error('Cost Explorer error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Failed to fetch costs');
    });
  });

  // =========================================================================
  // Test Suite 6: Response Format
  // =========================================================================

  describe('Response Format', () => {
    it('should include CORS headers', async () => {
      const event = createGetEvent();

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({ ResultsByTime: [] })
        .resolvesOnce({ ResultsByTime: [{ Groups: [] }] });

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('should return valid JSON', async () => {
      const event = createGetEvent();

      ceMock
        .on(GetCostAndUsageCommand)
        .resolvesOnce({ ResultsByTime: [] })
        .resolvesOnce({ ResultsByTime: [{ Groups: [] }] });

      const result = await handler(event);

      expect(() => JSON.parse(result.body)).not.toThrow();
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('period');
      expect(body).toHaveProperty('currency');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('daily');
      expect(body).toHaveProperty('services');
    });
  });
});
