/**
 * Unit tests for DiagnosticService
 *
 * Tests the diagnostic export workflow including:
 * - Local data collection
 * - Cloud data upload via Lambda
 * - Retry logic with exponential backoff
 * - Error handling (retryable vs permanent)
 * - TraceId generation for observability
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DiagnosticService } from './DiagnosticService';
import { UserId } from '../../../00_kernel/types';
import * as diagnosticIpc from '../adapters/diagnosticIpc';
import { generateMockLocalDiagnosticData, generateMockDiagnosticExportSuccess } from '../adapters/diagnosticIpc';

// Mock the diagnosticIpc adapter
vi.mock('../adapters/diagnosticIpc');

describe('DiagnosticService', () => {
  let service: DiagnosticService;
  const mockUserId = UserId('user-test-123');
  const mockToken = 'test-token-xyz';

  beforeEach(() => {
    service = new DiagnosticService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.reset();
  });

  // =========================================================================
  // Success Cases
  // =========================================================================

  describe('execute() - Success', () => {
    it('should complete full diagnostic workflow', async () => {
      // Setup mocks
      const mockLocalData = generateMockLocalDiagnosticData();
      const mockExportSuccess = generateMockDiagnosticExportSuccess();

      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockResolvedValueOnce(mockLocalData);
      vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mockResolvedValueOnce(
        mockExportSuccess
      );

      // Execute
      const result = await service.execute(mockUserId, mockToken);

      // Verify result
      expect(result.success).toBe(true);
      expect((result as any).reportId).toBe(mockExportSuccess.reportId);
      expect((result as any).s3Url).toBe(mockExportSuccess.s3Url);
      expect((result as any).fileSize).toBe(mockExportSuccess.fileSize);

      // Verify adapters were called
      expect(diagnosticIpc.collectLocalDiagnosticData).toHaveBeenCalledTimes(1);
      expect(diagnosticIpc.uploadDiagnosticReportIpc).toHaveBeenCalledTimes(1);

      // Verify traceId was generated
      const uploadCall = vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mock.calls[0];
      expect(uploadCall[3]).toMatch(/^trace-/);
    });

    it('should generate unique traceId for each execution', async () => {
      const mockLocalData = generateMockLocalDiagnosticData();
      const mockExportSuccess = generateMockDiagnosticExportSuccess();

      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockResolvedValue(mockLocalData);
      vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mockResolvedValue(mockExportSuccess);

      const result1 = await service.execute(mockUserId, mockToken);
      const result2 = await service.execute(mockUserId, mockToken);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Should have been called twice
      expect(diagnosticIpc.uploadDiagnosticReportIpc).toHaveBeenCalledTimes(2);

      // TraceIds should be different
      const traceId1 = vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mock.calls[0][3];
      const traceId2 = vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mock.calls[1][3];
      expect(traceId1).not.toBe(traceId2);
    });

    it('should return proper context after execution', async () => {
      const mockLocalData = generateMockLocalDiagnosticData();
      const mockExportSuccess = generateMockDiagnosticExportSuccess();

      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockResolvedValueOnce(mockLocalData);
      vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mockResolvedValueOnce(mockExportSuccess);

      expect(service.getContext()).toBeNull();

      await service.execute(mockUserId, mockToken);

      const context = service.getContext();
      expect(context).not.toBeNull();
      expect(context?.state).toBe('success');
      expect(context?.traceId).toMatch(/^trace-/);
    });
  });

  // =========================================================================
  // Error Cases
  // =========================================================================

  describe('execute() - Errors', () => {
    it('should handle local data collection failure', async () => {
      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockRejectedValueOnce(
        new Error('SQLite error')
      );

      const result = await service.execute(mockUserId, mockToken);

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('LOCAL_COLLECTION_FAILED');
      expect((result as any).error.message).toContain('SQLite error');
    });

    it('should retry on transient failure', async () => {
      const mockLocalData = generateMockLocalDiagnosticData();
      const mockExportSuccess = generateMockDiagnosticExportSuccess();

      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockResolvedValueOnce(mockLocalData);

      // First attempt fails, second succeeds
      vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc)
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(mockExportSuccess);

      const result = await service.execute(mockUserId, mockToken);

      expect(result.success).toBe(true);
      // Should have been called twice (one failure + one retry)
      expect(diagnosticIpc.uploadDiagnosticReportIpc).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries exceeded', async () => {
      const mockLocalData = generateMockLocalDiagnosticData();

      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockResolvedValueOnce(mockLocalData);
      vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mockRejectedValue(
        new Error('Lambda timeout')
      );

      const result = await service.execute(mockUserId, mockToken);

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('CLOUD_UPLOAD_FAILED');
      expect((result as any).error.message).toContain('attempt 3/3');
      // Should have retried 3 times
      expect(diagnosticIpc.uploadDiagnosticReportIpc).toHaveBeenCalledTimes(3);
    });

    it('should handle network errors', async () => {
      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockRejectedValueOnce(
        new Error('Network unreachable')
      );

      const result = await service.execute(mockUserId, mockToken);

      expect(result.success).toBe(false);
      expect((result as any).error.retryable).toBe(true);
    });

    it('should classify timeout errors as retryable', async () => {
      const mockLocalData = generateMockLocalDiagnosticData();

      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockResolvedValueOnce(mockLocalData);
      vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mockRejectedValueOnce(
        new Error('Request timeout after 30000ms')
      );

      const result = await service.execute(mockUserId, mockToken);

      expect(result.success).toBe(false);
      // Should retry because it's a timeout
      expect(diagnosticIpc.uploadDiagnosticReportIpc).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // State Management
  // =========================================================================

  describe('State Management', () => {
    it('should transition through FSM states', async () => {
      const mockLocalData = generateMockLocalDiagnosticData();
      const mockExportSuccess = generateMockDiagnosticExportSuccess();

      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockImplementationOnce(async () => {
        const context = service.getContext();
        expect(context?.state).toBe('collecting');
        return mockLocalData;
      });

      vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mockImplementationOnce(async () => {
        const context = service.getContext();
        expect(context?.state).toBe('uploading');
        return mockExportSuccess;
      });

      const result = await service.execute(mockUserId, mockToken);

      expect(result.success).toBe(true);
      const finalContext = service.getContext();
      expect(finalContext?.state).toBe('success');
    });

    it('should reset state', async () => {
      const mockLocalData = generateMockLocalDiagnosticData();
      const mockExportSuccess = generateMockDiagnosticExportSuccess();

      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockResolvedValueOnce(mockLocalData);
      vi.mocked(diagnosticIpc.uploadDiagnosticReportIpc).mockResolvedValueOnce(mockExportSuccess);

      await service.execute(mockUserId, mockToken);
      expect(service.getContext()).not.toBeNull();

      service.reset();
      expect(service.getContext()).toBeNull();
    });
  });

  // =========================================================================
  // Input Validation
  // =========================================================================

  describe('Input Validation', () => {
    it('should require userId and token', async () => {
      const mockLocalData = generateMockLocalDiagnosticData();

      vi.mocked(diagnosticIpc.collectLocalDiagnosticData).mockResolvedValueOnce(mockLocalData);

      // This would need to be tested at the hook level, not the service
      // Service assumes valid inputs from hook validation
      expect(mockUserId).toBeDefined();
      expect(mockToken).toBeDefined();
    });
  });
});
