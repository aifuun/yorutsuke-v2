/**
 * Unit Tests for Report Lambda (Phase 3 - P1)
 *
 * Tests cover:
 * - Report generation for specific date
 * - Report history for date range
 * - Summary calculation (income, expense, net profit, by category)
 * - Date validation (YYYY-MM-DD format)
 * - Limit validation (1-30 days)
 * - Transaction grouping by date
 * - CORS preflight handling
 * - Error handling (DynamoDB failures)
 * - Response format validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
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
    REPORT_ERROR: 'REPORT_ERROR',
    REPORT_HISTORY_ERROR: 'REPORT_HISTORY_ERROR',
    REPORT_HANDLER_ERROR: 'REPORT_HANDLER_ERROR',
  },
}));

import { handler } from '../index.js';

// Mock AWS clients
const ddbMock = mockClient(DynamoDBClient);

/**
 * Mock event generator
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

function createOptionsEvent(): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'OPTIONS /report',
    rawPath: '/report',
    rawQueryString: '',
    headers: {},
    requestContext: {
      http: {
        method: 'OPTIONS',
        path: '/report',
      },
      requestId: 'test-request-id',
    } as any,
    body: null,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe('Report Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.clearAllMocks();

    // Set environment variables
    process.env.TRANSACTIONS_TABLE_NAME = 'test-transactions-table';
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      expect(result.body).toBe('');
    });
  });

  // =========================================================================
  // Test Suite 2: Single Date Report
  // =========================================================================

  describe('Single Date Report', () => {
    it('should generate report for specific date', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '1000' },
            type: { S: 'income' },
            category: { S: 'sales' },
          },
          {
            transactionId: { S: 'tx-2' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '-500' },
            type: { S: 'expense' },
            category: { S: 'supplies' },
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        date: '2026-01-20',
        summary: {
          totalIncome: 1000,
          totalExpense: 500,
          netProfit: 500,
          transactionCount: 2,
        },
        transactions: expect.arrayContaining([
          expect.objectContaining({ transactionId: 'tx-1' }),
          expect.objectContaining({ transactionId: 'tx-2' }),
        ]),
        generatedAt: expect.any(String),
      });
    });

    it('should return empty report for date with no transactions', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.summary).toMatchObject({
        totalIncome: 0,
        totalExpense: 0,
        netProfit: 0,
        transactionCount: 0,
      });
      expect(body.transactions).toEqual([]);
    });

    it('should aggregate transactions by category', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '1000' },
            category: { S: 'sales' },
          },
          {
            transactionId: { S: 'tx-2' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '500' },
            category: { S: 'sales' },
          },
          {
            transactionId: { S: 'tx-3' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '-300' },
            category: { S: 'supplies' },
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.summary.byCategory).toEqual({
        sales: 1500,
        supplies: -300,
      });
    });
  });

  // =========================================================================
  // Test Suite 3: Input Validation
  // =========================================================================

  describe('Input Validation', () => {
    it('should reject missing userId', async () => {
      const event = createPostEvent('/report', {
        date: '2026-01-20',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('MISSING_USER_ID');
    });

    it('should reject missing date', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('MISSING_DATE');
    });

    it('should reject invalid date format', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026/01/20', // Wrong format
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('INVALID_DATE');
    });

    it('should reject invalid date format (incomplete)', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01', // Incomplete
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('INVALID_DATE');
    });
  });

  // =========================================================================
  // Test Suite 4: Report History
  // =========================================================================

  describe('Report History', () => {
    it('should generate history for default 7 days', async () => {
      const event = createPostEvent('/report/history', {
        userId: 'user-123',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            date: { S: new Date().toISOString().slice(0, 10) },
            amount: { N: '1000' },
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.reports).toHaveLength(7);
      expect(body.reports[0]).toMatchObject({
        date: expect.any(String),
        summary: expect.any(Object),
        transactions: expect.any(Array),
        generatedAt: expect.any(String),
      });
    });

    it('should generate history for custom limit', async () => {
      const event = createPostEvent('/report/history', {
        userId: 'user-123',
        limit: 3,
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.reports).toHaveLength(3);
    });

    it('should cap limit at 30 days', async () => {
      const event = createPostEvent('/report/history', {
        userId: 'user-123',
        limit: 100, // Exceeds max
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.reports).toHaveLength(30);
    });

    it('should enforce minimum limit of 1 day', async () => {
      const event = createPostEvent('/report/history', {
        userId: 'user-123',
        limit: 0, // Below min
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.reports).toHaveLength(1);
    });

    it('should group transactions by date correctly', async () => {
      const event = createPostEvent('/report/history', {
        userId: 'user-123',
        limit: 2,
      });

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            date: { S: today },
            amount: { N: '1000' },
          },
          {
            transactionId: { S: 'tx-2' },
            userId: { S: 'user-123' },
            date: { S: today },
            amount: { N: '500' },
          },
          {
            transactionId: { S: 'tx-3' },
            userId: { S: 'user-123' },
            date: { S: yesterday },
            amount: { N: '300' },
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);

      // Today's report should have 2 transactions
      const todayReport = body.reports.find((r: any) => r.date === today);
      expect(todayReport?.transactions).toHaveLength(2);
      expect(todayReport?.summary.transactionCount).toBe(2);

      // Yesterday's report should have 1 transaction
      const yesterdayReport = body.reports.find((r: any) => r.date === yesterday);
      expect(yesterdayReport?.transactions).toHaveLength(1);
      expect(yesterdayReport?.summary.transactionCount).toBe(1);
    });

    it('should reject missing userId for history', async () => {
      const event = createPostEvent('/report/history', {
        limit: 7,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('MISSING_USER_ID');
    });
  });

  // =========================================================================
  // Test Suite 5: Summary Calculation
  // =========================================================================

  describe('Summary Calculation', () => {
    it('should calculate total income correctly', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '1000' },
            type: { S: 'income' },
          },
          {
            transactionId: { S: 'tx-2' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '500' },
            type: { S: 'income' },
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.summary.totalIncome).toBe(1500);
      expect(body.summary.totalExpense).toBe(0);
      expect(body.summary.netProfit).toBe(1500);
    });

    it('should calculate total expense correctly', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '-300' },
            type: { S: 'expense' },
          },
          {
            transactionId: { S: 'tx-2' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '-200' },
            type: { S: 'expense' },
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.summary.totalIncome).toBe(0);
      expect(body.summary.totalExpense).toBe(500);
      expect(body.summary.netProfit).toBe(-500);
    });

    it('should handle missing category', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            amount: { N: '1000' },
            // No category field
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.summary.byCategory).toHaveProperty('other');
      expect(body.summary.byCategory.other).toBe(1000);
    });

    it('should handle missing amount', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            transactionId: { S: 'tx-1' },
            userId: { S: 'user-123' },
            date: { S: '2026-01-20' },
            // No amount field
            category: { S: 'sales' },
          },
        ],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.summary.totalIncome).toBe(0);
      expect(body.summary.totalExpense).toBe(0);
      expect(body.summary.byCategory.sales).toBe(0);
    });
  });

  // =========================================================================
  // Test Suite 6: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle DynamoDB errors for single date', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('REPORT_FAILED');
    });

    it('should handle DynamoDB errors for history', async () => {
      const event = createPostEvent('/report/history', {
        userId: 'user-123',
      });

      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('HISTORY_FAILED');
    });

    it('should handle invalid JSON body', async () => {
      const event = createPostEvent('/report', {});
      event.body = 'invalid-json{';

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('INTERNAL_ERROR');
    });
  });

  // =========================================================================
  // Test Suite 7: Response Format
  // =========================================================================

  describe('Response Format', () => {
    it('should include CORS headers in all responses', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      });
    });

    it('should return valid JSON for single date report', async () => {
      const event = createPostEvent('/report', {
        userId: 'user-123',
        date: '2026-01-20',
      });

      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(event);

      expect(() => JSON.parse(result.body)).not.toThrow();
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('date');
      expect(body).toHaveProperty('summary');
      expect(body).toHaveProperty('transactions');
      expect(body).toHaveProperty('generatedAt');
    });

    it('should return valid JSON for history report', async () => {
      const event = createPostEvent('/report/history', {
        userId: 'user-123',
      });

      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(event);

      expect(() => JSON.parse(result.body)).not.toThrow();
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('reports');
      expect(Array.isArray(body.reports)).toBe(true);
    });
  });
});
