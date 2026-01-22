/**
 * Image Sync Adapter Tests
 * Verifies adapter correctly delegates to underlying capture adapters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserId, ImageId, TraceId } from '../../../00_kernel/types';
import type { ImageRow } from '../../../00_kernel/storage';
import * as imageSyncAdapter from './imageSyncAdapter';

// Mock capture module
vi.mock('../../capture', () => ({
  getImageById: vi.fn(),
  updateImageS3Key: vi.fn(),
  createImageRecord: vi.fn(),
}));

import * as capture from '../../capture';

describe('imageSyncAdapter', () => {
  const mockImageId = ImageId('img-123');
  const mockUserId = UserId('user-456');
  const mockTraceId = TraceId('trace-789');
  const mockS3Key = 'uploads/user-456/img-123.webp';

  const mockImageRow: ImageRow = {
    id: mockImageId,
    user_id: mockUserId,
    original_path: null,
    compressed_path: '/path/to/compressed.webp',
    s3_key: mockS3Key,
    md5_hash: 'abc123',
    file_size: 50000,
    format: 'webp',
    width: 800,
    height: 600,
    status: 'uploaded',
    created_at: '2026-01-22T10:00:00.000Z',
    updated_at: '2026-01-22T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getImageById', () => {
    it('should delegate to capture.getImageById', async () => {
      vi.mocked(capture.getImageById).mockResolvedValue(mockImageRow);

      const result = await imageSyncAdapter.getImageById(mockImageId);

      expect(capture.getImageById).toHaveBeenCalledWith(mockImageId);
      expect(result).toEqual(mockImageRow);
    });

    it('should return null when image not found', async () => {
      vi.mocked(capture.getImageById).mockResolvedValue(null);

      const result = await imageSyncAdapter.getImageById(mockImageId);

      expect(capture.getImageById).toHaveBeenCalledWith(mockImageId);
      expect(result).toBeNull();
    });
  });

  describe('updateImageS3Key', () => {
    it('should delegate to capture.updateImageS3Key', async () => {
      vi.mocked(capture.updateImageS3Key).mockResolvedValue();

      await imageSyncAdapter.updateImageS3Key(mockImageId, mockS3Key);

      expect(capture.updateImageS3Key).toHaveBeenCalledWith(mockImageId, mockS3Key);
    });
  });

  describe('createImageRecord', () => {
    it('should delegate to capture.createImageRecord', async () => {
      const mockData = {
        id: mockImageId,
        userId: mockUserId,
        traceId: mockTraceId,
        s3Key: mockS3Key,
        createdAt: '2026-01-22T10:00:00.000Z',
      };

      vi.mocked(capture.createImageRecord).mockResolvedValue();

      await imageSyncAdapter.createImageRecord(mockData);

      expect(capture.createImageRecord).toHaveBeenCalledWith(mockData);
    });
  });
});
