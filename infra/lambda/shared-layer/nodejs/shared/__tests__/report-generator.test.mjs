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
import { ReportGenerator } from '../report-generator.mjs';

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
        userId: 'user-test-123',
        transactionId: 'txn-001',
        amount: 1500,
        type: 'expense',
        date: '2026-01-20',
        category: 'shopping',
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        modelComparison: {
          textract: { totalAmount: 1500, confidence: 95 },
          azure_di: { totalAmount: 1500, confidence: 98 },
        },
      },
    ],
    s3Images: [
      {
        key: 'user-test-123/img-001.webp',
        size: 2048,
        uploadedAt: new Date().toISOString(),
        status: 'processed',
      },
    ],
    cloudwatchLogs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Transaction processed successfully',
      },
    ],
  };
}

/**
 * =========================================================================
 * Unit Tests (TDD: Define expected behavior before implementation)
 * =========================================================================
 */

describe('ReportGenerator', () => {
  let generator;
  let mockAwsClients;
  let mockLogger;
  const userId = 'user-test-123';
  const traceId = 'trace-test-001';
  const token = 'mock-token-xyz';

  beforeEach(() => {
    // Mock AWS clients with .send() method (AWS SDK v3 pattern)
    mockAwsClients = {
      dynamoDb: {
        send: vi.fn(),
      },
      s3: {
        send: vi.fn(),
      },
      cloudwatch: {
        send: vi.fn(),
      },
    };

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    generator = new ReportGenerator(mockAwsClients, mockLogger);
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

      mockAwsClients.dynamoDb.send.mockResolvedValue({
        Items: cloudData.dynamodbTransactions,
      });
      mockAwsClients.s3.send
        .mockResolvedValueOnce({
          Contents: cloudData.s3Images,
        })
        .mockResolvedValueOnce({
          // For presigned URL generation
        });
      mockAwsClients.cloudwatch.send.mockResolvedValue({
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
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
      expect(result.s3Url).toContain('https://yorutsuke-diagnostics.s3.amazonaws.com');
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
    });

    it('should include DynamoDB transactions in report', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = createMockCloudData();

      mockAwsClients.dynamoDb.query.mockResolvedValue({
        Items: cloudData.dynamodbTransactions,
      });
      mockAwsClients.s3.listObjects.mockResolvedValue({
        Contents: [],
      });
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: [],
      });
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

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
      expect(result.report.cloudData.transactions).toEqual(
        cloudData.dynamodbTransactions
      );
    });

    it('should include S3 images metadata in report', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = createMockCloudData();

      mockAwsClients.dynamoDb.query.mockResolvedValue({ Items: [] });
      mockAwsClients.s3.listObjects.mockResolvedValue({
        Contents: cloudData.s3Images,
      });
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: [],
      });
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result.report.cloudData.images).toEqual(cloudData.s3Images);
    });

    it('should include CloudWatch logs in report', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = createMockCloudData();

      mockAwsClients.dynamoDb.query.mockResolvedValue({ Items: [] });
      mockAwsClients.s3.listObjects.mockResolvedValue({ Contents: [] });
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: cloudData.cloudwatchLogs,
      });
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result.report.cloudData.logs).toEqual(cloudData.cloudwatchLogs);
    });
  });

  // =========================================================================
  // Test Suite 2: Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle DynamoDB query failure gracefully', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      mockAwsClients.dynamoDb.query.mockRejectedValue(
        new Error('AccessDenied: User is not authorized')
      );
      mockAwsClients.s3.listObjects.mockResolvedValue({ Contents: [] });
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: [],
      });
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert: Report should still be generated with error details
      expect(result.success).toBe(true);
      expect(result.report.cloudData.transactionsError).toBeDefined();
      expect(result.report.cloudData.transactionsError).toContain('AccessDenied');
    });

    it('should handle S3 list failure gracefully', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      mockAwsClients.dynamoDb.query.mockResolvedValue({ Items: [] });
      mockAwsClients.s3.listObjects.mockRejectedValue(
        new Error('NoSuchBucket')
      );
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: [],
      });
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

      // Act & Assert
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      expect(result.report.cloudData.imagesError).toBeDefined();
    });

    it('should handle CloudWatch query failure gracefully', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      mockAwsClients.dynamoDb.query.mockResolvedValue({ Items: [] });
      mockAwsClients.s3.listObjects.mockResolvedValue({ Contents: [] });
      mockAwsClients.cloudwatch.getLogEvents.mockRejectedValue(
        new Error('InvalidParameterException')
      );
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

      // Act
      const result = await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(result.report.cloudData.logsError).toBeDefined();
    });

    it('should fail if S3 upload fails', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      mockAwsClients.dynamoDb.query.mockResolvedValue({ Items: [] });
      mockAwsClients.s3.listObjects.mockResolvedValue({ Contents: [] });
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: [],
      });
      mockAwsClients.s3.getSignedUrl.mockRejectedValue(
        new Error('AccessDenied')
      );

      // Act & Assert
      await expect(
        generator.generate({
          userId,
          localData,
          token,
          traceId,
        })
      ).rejects.toThrow('Failed to generate S3 presigned URL');
    });
  });

  // =========================================================================
  // Test Suite 3: Data Merging
  // =========================================================================

  describe('Data Merging', () => {
    it('should merge local and cloud data correctly', () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = createMockCloudData();

      // Act
      const merged = generator.mergeData(localData, cloudData);

      // Assert
      expect(merged).toBeDefined();
      expect(merged.localData).toEqual(localData);
      expect(merged.cloudData).toBeDefined();
      expect(merged.cloudData.transactions).toEqual(
        cloudData.dynamodbTransactions
      );
      expect(merged.cloudData.images).toEqual(cloudData.s3Images);
      expect(merged.cloudData.logs).toEqual(cloudData.cloudwatchLogs);
      expect(merged.mergedAt).toBeDefined();
    });

    it('should preserve metadata in merged report', () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const cloudData = createMockCloudData();

      // Act
      const merged = generator.mergeData(localData, cloudData);

      // Assert
      expect(merged.appVersion).toBe(localData.appVersion);
      expect(merged.platform).toBe(localData.platform);
      expect(merged.timestamp).toBe(localData.timestamp);
    });
  });

  // =========================================================================
  // Test Suite 4: S3 Integration
  // =========================================================================

  describe('S3 Integration', () => {
    it('should upload report to S3 with correct structure', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();
      const reportKey = `diagnostics/user-test-123/diag-${Date.now()}.json`;

      mockAwsClients.s3.putObject.mockResolvedValue({
        ETag: '"abc123"',
      });

      // Act
      const result = await generator.uploadReportToS3(
        reportKey,
        { data: 'mock' },
        traceId
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockAwsClients.s3.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: reportKey,
          ContentType: 'application/json',
        })
      );
    });

    it('should generate presigned URL with 7-day expiration', async () => {
      // Arrange
      const reportKey = `diagnostics/user-test-123/diag-${Date.now()}.json`;
      const presignedUrl =
        'https://yorutsuke-diagnostics.s3.amazonaws.com/...?X-Amz-Expires=604800';

      mockAwsClients.s3.getSignedUrl.mockResolvedValue(presignedUrl);

      // Act
      const result = await generator.generatePresignedUrl(reportKey);

      // Assert
      expect(result).toBe(presignedUrl);
      expect(mockAwsClients.s3.getSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          expires: 604800, // 7 days in seconds
        })
      );
    });

    it('should include report metadata in S3 object', async () => {
      // Arrange
      const reportKey = `diagnostics/user-test-123/diag-${Date.now()}.json`;
      const report = createMockLocalDiagnosticData();

      mockAwsClients.s3.putObject.mockResolvedValue({ ETag: '"abc"' });

      // Act
      await generator.uploadReportToS3(reportKey, report, traceId);

      // Assert
      expect(mockAwsClients.s3.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Metadata: expect.objectContaining({
            'trace-id': traceId,
            'report-type': 'diagnostic',
          }),
        })
      );
    });
  });

  // =========================================================================
  // Test Suite 5: Response Format
  // =========================================================================

  describe('Response Format (DiagnosticExportSuccess)', () => {
    it('should return correctly formatted success response', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      mockAwsClients.dynamoDb.query.mockResolvedValue({ Items: [] });
      mockAwsClients.s3.listObjects.mockResolvedValue({ Contents: [] });
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: [],
      });
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

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
      expect(result.s3Url).toContain('X-Amz-Expires=604800');
    });

    it('should have report ID with timestamp', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      mockAwsClients.dynamoDb.query.mockResolvedValue({ Items: [] });
      mockAwsClients.s3.listObjects.mockResolvedValue({ Contents: [] });
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: [],
      });
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

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
  // Test Suite 6: Logging & Observability (Pillar N & R)
  // =========================================================================

  describe('Observability (Pillar N & R)', () => {
    it('should log key events with traceId', async () => {
      // Arrange
      const localData = createMockLocalDiagnosticData();

      mockAwsClients.dynamoDb.query.mockResolvedValue({ Items: [] });
      mockAwsClients.s3.listObjects.mockResolvedValue({ Contents: [] });
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: [],
      });
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

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

      mockAwsClients.dynamoDb.query.mockRejectedValue(
        new Error('AccessDenied')
      );
      mockAwsClients.s3.listObjects.mockResolvedValue({ Contents: [] });
      mockAwsClients.cloudwatch.getLogEvents.mockResolvedValue({
        events: [],
      });
      mockAwsClients.s3.getSignedUrl.mockResolvedValue(
        'https://example.com/report.json'
      );

      // Act
      await generator.generate({
        userId,
        localData,
        token,
        traceId,
      });

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'DYNAMODB_QUERY_FAILED',
        expect.objectContaining({
          traceId,
          error: expect.any(String),
        })
      );
    });
  });
});
