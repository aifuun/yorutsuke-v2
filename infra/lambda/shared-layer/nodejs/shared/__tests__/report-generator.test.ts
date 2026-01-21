/**
 * Unit Tests for Diagnostic Report Generator (Phase C)
 *
 * TDD: Tests define the interface before implementation
 * Tests cover:
 * - Local diagnostic data aggregation
 * - Cloud data collection from DynamoDB, S3, CloudWatch
 * - Report generation and merging
 * - S3 presigned URL generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { CloudWatchLogsClient, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { ReportGenerator } from '../report-generator.js';

// Mock AWS clients
const dynamoDbMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);
const cloudwatchMock = mockClient(CloudWatchLogsClient);

// Mock getSignedUrl function
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-presigned-url.s3.amazonaws.com/report.json'),
}));

/**
 * Mock data generators
 */
function createMockLocalDiagnosticData() {
  return {
    timestamp: new Date().toISOString(),
    appVersion: '0.1.0-alpha.11',
    platform: 'darwin',
    systemInfo: {
      osVersion: '14.2',
      locale: 'en-US',
      timezone: 'UTC+9',
    },
    localStorage: {
      transactions: [
        {
          id: 'txn-001',
          userId: 'user-test-123',
          amount: 1500,
          currency: 'JPY',
          date: new Date().toISOString(),
          status: 'confirmed',
        },
      ],
      images: [
        {
          id: 'img-001',
          size: 2048,
          uploadedAt: new Date().toISOString(),
          status: 'uploaded',
        },
      ],
      settings: { theme: 'light', debugEnabled: true },
    },
    appState: {
      lastSyncTime: new Date(Date.now() - 3600000).toISOString(),
      queuedImages: 0,
      syncStatus: 'idle',
      dbSize: '5.2 MB',
    },
    debugLogs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'App started',
      },
    ],
  };
}

function createMockCloudData() {
  return {
    dynamodbTransactions: [
      {
        userId: { S: 'user-test-123' },
        transactionId: { S: 'txn-001' },
        amount: { N: '1500' },
        type: { S: 'expense' },
        date: { S: '2026-01-20' },
        category: { S: 'shopping' },
        status: { S: 'confirmed' },
        createdAt: { S: new Date().toISOString() },
      },
    ],
    s3Images: [
      {
        Key: 'user-test-123/img-001.webp',
        Size: 2048,
        LastModified: new Date(),
      },
    ],
    cloudwatchLogs: [
      {
        timestamp: Date.now(),
        message: 'Transaction processed successfully',
      },
    ],
  };
}

interface MockLogger {
  info: Mock;
  debug: Mock;
  error: Mock;
  warn: Mock;
}

/**
 * =========================================================================
 * Unit Tests (TDD: Define expected behavior before implementation)
 * =========================================================================
 */

describe('ReportGenerator', () => {
  let generator: ReportGenerator;
  let mockLogger: MockLogger;
  const userId = 'user-test-123';
  const traceId = 'trace-test-001';
  const token = 'mock-token-xyz';

  beforeEach(() => {
    // Reset mocks
    dynamoDbMock.reset();
    s3Mock.reset();
    cloudwatchMock.reset();

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    generator = new ReportGenerator(
      {
        dynamoDb: dynamoDbMock as any,
        s3: s3Mock as any,
        cloudwatch: cloudwatchMock as any,
      },
      mockLogger
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Test Suite 1: Basic Report Generation
  // =========================================================================

  describe('generate()', () => {
    it('should successfully generate report from local + cloud data', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = createMockCloudData();

      // Mock DynamoDB Query
      dynamoDbMock.on(QueryCommand).resolves({
        Items: cloudData.dynamodbTransactions,
      });
      // Mock S3 ListObjects
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: cloudData.s3Images,
      });
      // Mock CloudWatch GetLogEvents
      cloudwatchMock.on(GetLogEventsCommand).resolves({
        events: cloudData.cloudwatchLogs,
      });
      // Mock S3 PutObject
      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
      expect(result.s3Url).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should validate input parameters', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      // Act & Assert: Empty userId should be rejected
      await expect(
        generator.generate({
          userId: '',
          localData,
          token,
          traceId,
        })
      ).rejects.toThrow('userId cannot be empty');

      // Assert: Empty token should be rejected
      await expect(
        generator.generate({
          userId,
          localData,
          token: '',
          traceId,
        })
      ).rejects.toThrow('token cannot be empty');

      // Assert: Missing localData should be rejected
      await expect(
        generator.generate({
          userId,
          localData: null as any,
          token,
          traceId,
        })
      ).rejects.toThrow('localData is required');
    });

    it('should include DynamoDB transactions in report', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = createMockCloudData();

      dynamoDbMock.on(QueryCommand).resolves({
        Items: cloudData.dynamodbTransactions,
      });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).resolves({ events: [] });

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result.report).toBeDefined();
      expect(result.report.cloudData).toBeDefined();
      expect(result.report.cloudData.transactions).toHaveLength(1);
    });

    it('should include S3 images metadata in report', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = createMockCloudData();

      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: cloudData.s3Images });
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).resolves({ events: [] });

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result.report.cloudData.images).toHaveLength(1);
      expect(result.report.cloudData.images[0].key).toBe('user-test-123/img-001.webp');
    });

    it('should include CloudWatch logs in report', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = createMockCloudData();

      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).resolves({
        events: cloudData.cloudwatchLogs,
      });

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result.report.cloudData.logs).toHaveLength(1);
    });
  });

  // =========================================================================
  // Test Suite 2: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle DynamoDB query failure gracefully', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      dynamoDbMock.on(QueryCommand).rejects(new Error('AccessDenied: User is not authorized'));
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).resolves({ events: [] });

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert: Report should still be generated
      expect(result.success).toBe(true);
      expect(result.report.cloudData.transactions).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'DYNAMODB_QUERY_FAILED',
        expect.objectContaining({ traceId })
      );
    });

    it('should handle S3 list failure gracefully', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).rejects(new Error('NoSuchBucket'));
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).resolves({ events: [] });

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.report.cloudData.images).toEqual([]);
    });

    it('should handle CloudWatch query failure gracefully', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).rejects(new Error('InvalidParameterException'));

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.report.cloudData.logs).toEqual([]);
    });

    it('should fail if S3 upload fails', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      s3Mock.on(PutObjectCommand).rejects(new Error('AccessDenied'));
      cloudwatchMock.on(GetLogEventsCommand).resolves({ events: [] });

      // Act & Assert
      await expect(
        generator.generate({
          userId,
          localData,
          token,
          traceId,
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Test Suite 3: Data Merging
  // =========================================================================

  describe('Data Merging', () => {
    it('should merge local and cloud data correctly', () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = {
        transactions: [],
        images: [],
        logs: [],
      };

      // Act
      const merged = generator.mergeData(localData, cloudData);

      // Assert
      expect(merged).toBeDefined();
      expect(merged.localData).toEqual(localData);
      expect(merged.cloudData).toBeDefined();
      expect(merged.mergedAt).toBeDefined();
    });

    it('should preserve metadata in merged report', () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = {
        transactions: [],
        images: [],
        logs: [],
      };

      // Act
      const merged = generator.mergeData(localData, cloudData);

      // Assert
      expect(merged.appVersion).toBe(localData.appVersion);
      expect(merged.platform).toBe(localData.platform);
      expect(merged.timestamp).toBe(localData.timestamp);
    });

    it('should include totals for cloud data', () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = {
        transactions: [{ userId: 'test' }],
        images: [{ key: 'test.jpg' }, { key: 'test2.jpg' }],
        logs: [{ message: 'log1' }],
      };

      // Act
      const merged = generator.mergeData(localData, cloudData);

      // Assert
      expect(merged.totalTransactions).toBe(1);
      expect(merged.totalImages).toBe(2);
      expect(merged.totalLogs).toBe(1);
    });
  });

  // =========================================================================
  // Test Suite 4: Response Format
  // =========================================================================

  describe('Response Format (DiagnosticExportSuccess)', () => {
    it('should return correctly formatted success response', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).resolves({ events: [] });

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result).toMatchObject({
        success: true,
        reportId: expect.stringContaining('diag-'),
        s3Url: expect.stringContaining('https://'),
        timestamp: expect.any(String), // ISO 8601
        fileSize: expect.any(Number),
      });
    });

    it('should have report ID with timestamp', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).resolves({ events: [] });

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result.reportId).toMatch(/^diag-\d+$/);
    });
  });

  // =========================================================================
  // Test Suite 5: Logging & Observability (Pillar N & R)
  // =========================================================================

  describe('Observability (Pillar N & R)', () => {
    it('should log key events with traceId', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      dynamoDbMock.on(QueryCommand).resolves({ Items: [] });
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).resolves({ events: [] });

      // Act
      await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DIAGNOSTIC_GENERATION_START',
        expect.objectContaining({
          traceId,
          userId,
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'DIAGNOSTIC_GENERATION_SUCCESS',
        expect.objectContaining({
          traceId,
        })
      );
    });

    it('should log errors with full context', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      dynamoDbMock.on(QueryCommand).rejects(new Error('AccessDenied'));
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
      s3Mock.on(PutObjectCommand).resolves({});
      cloudwatchMock.on(GetLogEventsCommand).resolves({ events: [] });

      // Act
      await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'DYNAMODB_QUERY_FAILED',
        expect.objectContaining({
          traceId,
          error: expect.any(String),
        })
      );
    });
  });
});
