import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserId, ImageId, TraceId } from '../../../00_kernel/types';
import type { ReceiptImage } from '../../../01_domains/receipt';
import type { ImageRow } from '../../../00_kernel/storage';

// Mock dependencies
const mockExists = vi.fn();
const mockLoadUnfinishedImages = vi.fn();
const mockLoadRecentImagesWithTransactions = vi.fn();
const mockResetInterruptedUploads = vi.fn();
const mockUpdateImageStatus = vi.fn();

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
}));

vi.mock('../adapters', () => ({
  loadUnfinishedImages: (...args: unknown[]) => mockLoadUnfinishedImages(...args),
  loadRecentImagesWithTransactions: (...args: unknown[]) => mockLoadRecentImagesWithTransactions(...args),
  resetInterruptedUploads: (...args: unknown[]) => mockResetInterruptedUploads(...args),
  updateImageStatus: (...args: unknown[]) => mockUpdateImageStatus(...args),
  compressImage: vi.fn(),
  deleteLocalImage: vi.fn(),
  findImageByMd5: vi.fn(),
  getImageById: vi.fn(),
  saveImage: vi.fn(),
  deleteImageRecord: vi.fn(),
}));

vi.mock('../../../00_kernel/eventBus', () => ({
  emit: vi.fn(),
}));

vi.mock('../../../00_kernel/telemetry', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  EVENTS: {
    IMAGE_PROCESSING_STARTED: 'IMAGE_PROCESSING_STARTED',
    IMAGE_PROCESSING_SKIPPED: 'IMAGE_PROCESSING_SKIPPED',
    IMAGE_COMPRESSED: 'IMAGE_COMPRESSED',
    IMAGE_DUPLICATE: 'IMAGE_DUPLICATE',
    IMAGE_SAVED: 'IMAGE_SAVED',
    IMAGE_COMPRESSION_FAILED: 'IMAGE_COMPRESSION_FAILED',
    IMAGE_CLEANUP: 'IMAGE_CLEANUP',
    QUEUE_RESTORED: 'QUEUE_RESTORED',
    STATE_TRANSITION: 'STATE_TRANSITION',
    APP_ERROR: 'APP_ERROR',
  },
}));

// Create mock functions that persist across getState() calls
const mockRestoreQueue = vi.fn();
const mockStartProcess = vi.fn();
const mockProcessSuccess = vi.fn();
const mockFailure = vi.fn();
const mockDuplicateDetected = vi.fn();
const mockRemoveImage = vi.fn();

const mockCaptureStore = {
  getState: vi.fn(() => ({
    restoreQueue: mockRestoreQueue,
    startProcess: mockStartProcess,
    processSuccess: mockProcessSuccess,
    failure: mockFailure,
    duplicateDetected: mockDuplicateDetected,
    removeImage: mockRemoveImage,
    queue: [],
  })),
};

vi.mock('../stores/captureStore', () => ({
  captureStore: mockCaptureStore,
}));

describe('fileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetInterruptedUploads.mockResolvedValue(undefined);
    mockUpdateImageStatus.mockResolvedValue(undefined);
    mockRestoreQueue.mockClear();
    mockStartProcess.mockClear();
    mockProcessSuccess.mockClear();
    mockFailure.mockClear();
    mockDuplicateDetected.mockClear();
    mockRemoveImage.mockClear();
  });

  // Issue #157: Test restoreQueue deduplication logic
  describe('restoreQueue', () => {
    const userId = UserId('user-1');

    it('TC-SVC.1: Load both unfinished and recent images', async () => {
      // Given: Unfinished images (pending/compressed/uploading)
      const unfinished: ImageRow[] = [
        {
          id: 'img-1',
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 2000000,
          compressed_size: 150000,
          width: 1920,
          height: 1080,
          md5: 'abc123',
          status: 'compressed',
          s3_key: null,
          uploaded_at: null,
          created_at: '2026-01-01T09:00:00Z',
        },
      ];

      // Recent uploaded images with transactions
      const recent = [
        {
          id: 'img-2',
          user_id: 'user-1',
          trace_id: 'trace-2',
          intent_id: null,
          original_path: '/path/to/original2.jpg',
          original_name: 'receipt2.jpg',
          compressed_path: '/path/to/compressed2.webp',
          original_size: 1500000,
          compressed_size: 120000,
          width: 1920,
          height: 1080,
          md5: 'def456',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-2.jpg',
          uploaded_at: '2026-01-02T10:00:00Z',
          created_at: '2026-01-02T09:00:00Z',
          transaction_id: 'tx-1',
          transaction_merchant: 'Test Store',
          transaction_amount: 1000,
          transaction_status: 'confirmed',
        },
      ];

      mockLoadUnfinishedImages.mockResolvedValue(unfinished);
      mockLoadRecentImagesWithTransactions.mockResolvedValue(recent);
      mockExists.mockResolvedValue(true); // Compressed file exists

      // When: restoreQueue called
      const { fileService } = await import('./fileService');
      await fileService.restoreQueue(userId);

      // Then: Both sets are loaded
      expect(mockLoadUnfinishedImages).toHaveBeenCalledWith(userId);
      expect(mockLoadRecentImagesWithTransactions).toHaveBeenCalledWith(userId, 20);

      // Store updated with both images
      expect(mockRestoreQueue).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'img-1' }), // Unfinished
          expect.objectContaining({ id: 'img-2' }), // Recent
        ]),
      );

      // Both images should be in the array
      const images = mockRestoreQueue.mock.calls[0][0] as ReceiptImage[];
      expect(images).toHaveLength(2);
    });

    it('TC-SVC.2: Include transaction info for recent images', async () => {
      // Given: Recent uploaded image with transaction
      const recent = [
        {
          id: 'img-1',
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 1500000,
          compressed_size: 120000,
          width: 1920,
          height: 1080,
          md5: 'abc123',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-1.jpg',
          uploaded_at: '2026-01-01T10:00:00Z',
          created_at: '2026-01-01T09:00:00Z',
          transaction_id: 'tx-1',
          transaction_merchant: 'Test Store',
          transaction_amount: 1500,
          transaction_status: 'confirmed',
        },
      ];

      mockLoadUnfinishedImages.mockResolvedValue([]);
      mockLoadRecentImagesWithTransactions.mockResolvedValue(recent);

      // When: restoreQueue called
      const { fileService } = await import('./fileService');
      await fileService.restoreQueue(userId);

      // Then: ReceiptImage includes transaction info
      const images = mockRestoreQueue.mock.calls[0][0] as ReceiptImage[];

      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        id: 'img-1',
        transactionId: 'tx-1',
        transactionMerchant: 'Test Store',
        transactionAmount: 1500,
        transactionStatus: 'confirmed',
      });
    });

    it('TC-SVC.3: Deduplicate images appearing in both unfinished and recent', async () => {
      // Given: Same image appears in both unfinished and recent
      const unfinished: ImageRow[] = [
        {
          id: 'img-1',
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 2000000,
          compressed_size: 150000,
          width: 1920,
          height: 1080,
          md5: 'abc123',
          status: 'compressed',
          s3_key: null,
          uploaded_at: null,
          created_at: '2026-01-01T09:00:00Z',
        },
      ];

      const recent = [
        {
          id: 'img-1', // Same image ID
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 2000000,
          compressed_size: 150000,
          width: 1920,
          height: 1080,
          md5: 'abc123',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-1.jpg',
          uploaded_at: '2026-01-01T10:00:00Z',
          created_at: '2026-01-01T09:00:00Z',
          transaction_id: 'tx-1',
          transaction_merchant: 'Test Store',
          transaction_amount: 1000,
          transaction_status: 'confirmed',
        },
        {
          id: 'img-2', // Different image
          user_id: 'user-1',
          trace_id: 'trace-2',
          intent_id: null,
          original_path: '/path/to/original2.jpg',
          original_name: 'receipt2.jpg',
          compressed_path: '/path/to/compressed2.webp',
          original_size: 1500000,
          compressed_size: 120000,
          width: 1920,
          height: 1080,
          md5: 'def456',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-2.jpg',
          uploaded_at: '2026-01-02T10:00:00Z',
          created_at: '2026-01-02T09:00:00Z',
          transaction_id: 'tx-2',
          transaction_merchant: 'Store B',
          transaction_amount: 500,
          transaction_status: 'unconfirmed',
        },
      ];

      mockLoadUnfinishedImages.mockResolvedValue(unfinished);
      mockLoadRecentImagesWithTransactions.mockResolvedValue(recent);
      mockExists.mockResolvedValue(true);

      // When: restoreQueue called
      const { fileService } = await import('./fileService');
      await fileService.restoreQueue(userId);

      // Then: img-1 appears only once (from unfinished), img-2 appears once
      const images = mockRestoreQueue.mock.calls[0][0] as ReceiptImage[];

      expect(images).toHaveLength(2); // Not 3
      const imageIds = images.map(img => img.id);
      expect(imageIds).toEqual(['img-1', 'img-2']);

      // img-1 should NOT have transaction info (from unfinished, not recent)
      const img1 = images.find(img => img.id === 'img-1');
      expect(img1?.transactionId).toBeUndefined();

      // img-2 should have transaction info (from recent)
      const img2 = images.find(img => img.id === 'img-2');
      expect(img2?.transactionId).toBe('tx-2');
    });

    it('TC-SVC.4: Handle NULL transaction fields for uploaded images without transactions', async () => {
      // Given: Recent uploaded image without transaction (processing in Lambda)
      const recent = [
        {
          id: 'img-1',
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 1500000,
          compressed_size: 120000,
          width: 1920,
          height: 1080,
          md5: 'abc123',
          status: 'uploaded',
          s3_key: 'uploads/user-1/img-1.jpg',
          uploaded_at: '2026-01-01T10:00:00Z',
          created_at: '2026-01-01T09:00:00Z',
          transaction_id: null, // No transaction yet
          transaction_merchant: null,
          transaction_amount: null,
          transaction_status: null,
        },
      ];

      mockLoadUnfinishedImages.mockResolvedValue([]);
      mockLoadRecentImagesWithTransactions.mockResolvedValue(recent);

      // When: restoreQueue called
      const { fileService } = await import('./fileService');
      await fileService.restoreQueue(userId);

      // Then: ReceiptImage has null transaction fields
      const images = mockRestoreQueue.mock.calls[0][0] as ReceiptImage[];

      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        id: 'img-1',
        status: 'uploaded',
        transactionId: null,
        transactionMerchant: null,
        transactionAmount: null,
        transactionStatus: null,
      });
    });

    it('TC-SVC.5: Verify compressed file exists and mark as failed if missing', async () => {
      // Given: Compressed image but file doesn't exist (temp dir cleared)
      const unfinished: ImageRow[] = [
        {
          id: 'img-1',
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 2000000,
          compressed_size: 150000,
          width: 1920,
          height: 1080,
          md5: 'abc123',
          status: 'compressed',
          s3_key: null,
          uploaded_at: null,
          created_at: '2026-01-01T09:00:00Z',
        },
      ];

      mockLoadUnfinishedImages.mockResolvedValue(unfinished);
      mockLoadRecentImagesWithTransactions.mockResolvedValue([]);
      mockExists.mockResolvedValue(false); // File doesn't exist

      // When: restoreQueue called
      const { fileService } = await import('./fileService');
      await fileService.restoreQueue(userId);

      // Then: File existence checked
      expect(mockExists).toHaveBeenCalledWith('/path/to/compressed1.webp');

      // Image marked as failed in DB
      expect(mockUpdateImageStatus).toHaveBeenCalledWith(
        'img-1',
        'failed',
        expect.any(String), // traceId
        { error: 'Compressed file missing after app restart' },
      );

      // Image NOT added to queue
      const images = mockRestoreQueue.mock.calls[0][0] as ReceiptImage[];
      expect(images).toHaveLength(0); // Empty queue
    });

    it('TC-SVC.6: Reset "uploading" status back to "compressed"', async () => {
      // Given: Image with status="uploading" (upload was interrupted)
      const unfinished: ImageRow[] = [
        {
          id: 'img-1',
          user_id: 'user-1',
          trace_id: 'trace-1',
          intent_id: null,
          original_path: '/path/to/original1.jpg',
          original_name: 'receipt1.jpg',
          compressed_path: '/path/to/compressed1.webp',
          original_size: 2000000,
          compressed_size: 150000,
          width: 1920,
          height: 1080,
          md5: 'abc123',
          status: 'uploading', // Interrupted upload
          s3_key: null,
          uploaded_at: null,
          created_at: '2026-01-01T09:00:00Z',
        },
      ];

      mockLoadUnfinishedImages.mockResolvedValue(unfinished);
      mockLoadRecentImagesWithTransactions.mockResolvedValue([]);
      mockExists.mockResolvedValue(true);

      // When: restoreQueue called
      const { fileService } = await import('./fileService');
      await fileService.restoreQueue(userId);

      // Then: Status converted to "compressed" in ReceiptImage
      const images = mockRestoreQueue.mock.calls[0][0] as ReceiptImage[];

      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        id: 'img-1',
        status: 'compressed', // Changed from "uploading"
      });
    });

    it('TC-SVC.7: Load exactly 20 recent images (limit parameter)', async () => {
      // Given: No unfinished images
      mockLoadUnfinishedImages.mockResolvedValue([]);
      mockLoadRecentImagesWithTransactions.mockResolvedValue([]);

      // When: restoreQueue called
      const { fileService } = await import('./fileService');
      await fileService.restoreQueue(userId);

      // Then: loadRecentImagesWithTransactions called with limit=20
      expect(mockLoadRecentImagesWithTransactions).toHaveBeenCalledWith(userId, 20);
    });

    it('TC-SVC.8: Handle empty result (no images to restore)', async () => {
      // Given: No images in DB
      mockLoadUnfinishedImages.mockResolvedValue([]);
      mockLoadRecentImagesWithTransactions.mockResolvedValue([]);

      // When: restoreQueue called
      const { fileService } = await import('./fileService');
      await fileService.restoreQueue(userId);

      // Then: Store updated with empty array
      expect(mockRestoreQueue).toHaveBeenCalledWith([]);
    });
  });
});
