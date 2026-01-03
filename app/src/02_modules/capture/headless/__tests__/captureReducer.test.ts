import { describe, it, expect } from 'vitest';
import { captureReducer, type CaptureState, type CaptureAction } from '../useCaptureLogic';
import { ImageId, UserId, createTraceId, createIntentId } from '../../../../00_kernel/types';
import type { ReceiptImage } from '../../../../01_domains/receipt';

// Helper to create test images
function createTestImage(id: string, status: ReceiptImage['status'] = 'pending'): ReceiptImage {
  return {
    id: ImageId(id),
    userId: UserId('test-user'),
    intentId: createIntentId(),
    traceId: createTraceId(),
    status,
    localPath: `/tmp/${id}.jpg`,
    s3Key: null,
    thumbnailPath: null,
    originalSize: 1000,
    compressedSize: null,
    createdAt: new Date().toISOString(),
    uploadedAt: null,
    processedAt: null,
  };
}

// Initial state helper
const initialState: CaptureState = { status: 'idle', queue: [] };

describe('captureReducer', () => {
  describe('ADD_IMAGE', () => {
    it('adds image to empty queue', () => {
      const image = createTestImage('img-1');
      const action: CaptureAction = { type: 'ADD_IMAGE', image };

      const result = captureReducer(initialState, action);

      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].id).toBe('img-1');
      expect(result.status).toBe('idle');
    });

    it('appends image to existing queue', () => {
      const state: CaptureState = {
        status: 'idle',
        queue: [createTestImage('img-1')],
      };
      const action: CaptureAction = { type: 'ADD_IMAGE', image: createTestImage('img-2') };

      const result = captureReducer(state, action);

      expect(result.queue).toHaveLength(2);
      expect(result.queue[1].id).toBe('img-2');
    });

    it('preserves status when adding image', () => {
      const state: CaptureState = {
        status: 'processing',
        queue: [createTestImage('img-1')],
        currentId: ImageId('img-1'),
      };
      const action: CaptureAction = { type: 'ADD_IMAGE', image: createTestImage('img-2') };

      const result = captureReducer(state, action);

      expect(result.status).toBe('processing');
    });
  });

  describe('RESTORE_QUEUE', () => {
    it('restores images to empty queue', () => {
      const images = [createTestImage('img-1'), createTestImage('img-2')];
      const action: CaptureAction = { type: 'RESTORE_QUEUE', images };

      const result = captureReducer(initialState, action);

      expect(result.queue).toHaveLength(2);
    });

    it('avoids duplicate images when restoring', () => {
      const state: CaptureState = {
        status: 'idle',
        queue: [createTestImage('img-1')],
      };
      const images = [createTestImage('img-1'), createTestImage('img-2')];
      const action: CaptureAction = { type: 'RESTORE_QUEUE', images };

      const result = captureReducer(state, action);

      expect(result.queue).toHaveLength(2); // Not 3, because img-1 is duplicate
      expect(result.queue.map(img => img.id)).toEqual(['img-1', 'img-2']);
    });
  });

  describe('START_PROCESS', () => {
    it('transitions to processing status', () => {
      const state: CaptureState = {
        status: 'idle',
        queue: [createTestImage('img-1')],
      };
      const action: CaptureAction = { type: 'START_PROCESS', id: ImageId('img-1') };

      const result = captureReducer(state, action);

      expect(result.status).toBe('processing');
      expect((result as { currentId: string }).currentId).toBe('img-1');
    });
  });

  describe('PROCESS_SUCCESS', () => {
    it('transitions back to idle and updates image status', () => {
      const state: CaptureState = {
        status: 'processing',
        queue: [createTestImage('img-1')],
        currentId: ImageId('img-1'),
      };
      const action: CaptureAction = {
        type: 'PROCESS_SUCCESS',
        id: ImageId('img-1'),
        compressedPath: '/tmp/img-1.webp',
        compressedSize: 500,
        md5: 'abc123',
      };

      const result = captureReducer(state, action);

      expect(result.status).toBe('idle');
      expect(result.queue[0].status).toBe('compressed');
      expect(result.queue[0].compressedSize).toBe(500);
    });

    it('only updates the specified image', () => {
      const state: CaptureState = {
        status: 'processing',
        queue: [createTestImage('img-1'), createTestImage('img-2')],
        currentId: ImageId('img-1'),
      };
      const action: CaptureAction = {
        type: 'PROCESS_SUCCESS',
        id: ImageId('img-1'),
        compressedPath: '/tmp/img-1.webp',
        compressedSize: 500,
        md5: 'abc123',
      };

      const result = captureReducer(state, action);

      expect(result.queue[0].status).toBe('compressed');
      expect(result.queue[1].status).toBe('pending'); // Unchanged
    });
  });

  describe('DUPLICATE_DETECTED', () => {
    it('removes duplicate image from queue', () => {
      const state: CaptureState = {
        status: 'processing',
        queue: [createTestImage('img-1'), createTestImage('img-2')],
        currentId: ImageId('img-1'),
      };
      const action: CaptureAction = {
        type: 'DUPLICATE_DETECTED',
        id: ImageId('img-1'),
        duplicateWith: ImageId('existing-img'),
      };

      const result = captureReducer(state, action);

      expect(result.status).toBe('idle');
      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].id).toBe('img-2');
    });
  });

  describe('START_UPLOAD', () => {
    it('transitions to uploading status', () => {
      const state: CaptureState = {
        status: 'idle',
        queue: [createTestImage('img-1', 'compressed')],
      };
      const action: CaptureAction = { type: 'START_UPLOAD', id: ImageId('img-1') };

      const result = captureReducer(state, action);

      expect(result.status).toBe('uploading');
      expect((result as { currentId: string }).currentId).toBe('img-1');
      expect(result.queue[0].status).toBe('uploading');
    });
  });

  describe('UPLOAD_SUCCESS', () => {
    it('transitions back to idle and updates image', () => {
      const state: CaptureState = {
        status: 'uploading',
        queue: [createTestImage('img-1', 'uploading')],
        currentId: ImageId('img-1'),
      };
      const action: CaptureAction = {
        type: 'UPLOAD_SUCCESS',
        id: ImageId('img-1'),
        s3Key: 'uploads/img-1.webp',
      };

      const result = captureReducer(state, action);

      expect(result.status).toBe('idle');
      expect(result.queue[0].status).toBe('uploaded');
      expect(result.queue[0].s3Key).toBe('uploads/img-1.webp');
      expect(result.queue[0].uploadedAt).toBeTruthy();
    });
  });

  describe('FAILURE', () => {
    it('returns to idle status (not error) - fixes #45', () => {
      const state: CaptureState = {
        status: 'processing',
        queue: [createTestImage('img-1')],
        currentId: ImageId('img-1'),
      };
      const action: CaptureAction = {
        type: 'FAILURE',
        id: ImageId('img-1'),
        error: 'Compression failed',
      };

      const result = captureReducer(state, action);

      // Critical: status is 'idle', not 'error'
      expect(result.status).toBe('idle');
      expect(result.queue[0].status).toBe('failed');
      expect(result.queue[0].error).toBe('Compression failed');
    });

    it('allows other images to continue processing after failure', () => {
      const state: CaptureState = {
        status: 'processing',
        queue: [createTestImage('img-1'), createTestImage('img-2')],
        currentId: ImageId('img-1'),
      };
      const action: CaptureAction = {
        type: 'FAILURE',
        id: ImageId('img-1'),
        error: 'Network error',
      };

      const result = captureReducer(state, action);

      expect(result.status).toBe('idle'); // Ready for next image
      expect(result.queue[0].status).toBe('failed');
      expect(result.queue[1].status).toBe('pending'); // Can still be processed
    });
  });

  describe('REMOVE', () => {
    it('removes image from queue', () => {
      const state: CaptureState = {
        status: 'idle',
        queue: [createTestImage('img-1'), createTestImage('img-2')],
      };
      const action: CaptureAction = { type: 'REMOVE', id: ImageId('img-1') };

      const result = captureReducer(state, action);

      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].id).toBe('img-2');
    });

    it('preserves status when removing', () => {
      const state: CaptureState = {
        status: 'processing',
        queue: [createTestImage('img-1'), createTestImage('img-2')],
        currentId: ImageId('img-1'),
      };
      const action: CaptureAction = { type: 'REMOVE', id: ImageId('img-2') };

      const result = captureReducer(state, action);

      expect(result.status).toBe('processing');
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged for unknown action', () => {
      const state: CaptureState = {
        status: 'idle',
        queue: [createTestImage('img-1')],
      };
      // @ts-expect-error - testing unknown action
      const action: CaptureAction = { type: 'UNKNOWN_ACTION' };

      const result = captureReducer(state, action);

      expect(result).toBe(state);
    });
  });
});
