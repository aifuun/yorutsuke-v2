import { describe, it, expect } from 'vitest';
import {
  uploadQueueReducer,
  shouldRetry,
  classifyError,
  type UploadQueueState,
  type UploadQueueAction,
  type UploadTask,
} from '../useUploadQueue';
import { ImageId, createTraceId, createIntentId } from '../../../../00_kernel/types';

// Helper to create test tasks
function createTestTask(id: string, status: UploadTask['status'] = 'idle'): UploadTask {
  return {
    id: ImageId(id),
    intentId: createIntentId(),
    traceId: createTraceId(),
    filePath: `/tmp/${id}.webp`,
    status,
    retryCount: 0,
  };
}

// Initial state helper
const initialState: UploadQueueState = { status: 'idle', tasks: [] };

describe('uploadQueueReducer', () => {
  describe('ENQUEUE', () => {
    it('adds task to empty queue', () => {
      const task = createTestTask('task-1');
      const action: UploadQueueAction = { type: 'ENQUEUE', task };

      const result = uploadQueueReducer(initialState, action);

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('task-1');
    });

    it('avoids duplicate tasks', () => {
      const state: UploadQueueState = {
        status: 'idle',
        tasks: [createTestTask('task-1')],
      };
      const action: UploadQueueAction = { type: 'ENQUEUE', task: createTestTask('task-1') };

      const result = uploadQueueReducer(state, action);

      expect(result.tasks).toHaveLength(1); // Still 1, not 2
    });

    it('preserves queue status when enqueueing', () => {
      const state: UploadQueueState = {
        status: 'processing',
        tasks: [createTestTask('task-1', 'uploading')],
        currentId: ImageId('task-1'),
      };
      const action: UploadQueueAction = { type: 'ENQUEUE', task: createTestTask('task-2') };

      const result = uploadQueueReducer(state, action);

      expect(result.status).toBe('processing');
      expect(result.tasks).toHaveLength(2);
    });
  });

  describe('START_UPLOAD', () => {
    it('transitions to processing status', () => {
      const state: UploadQueueState = {
        status: 'idle',
        tasks: [createTestTask('task-1')],
      };
      const action: UploadQueueAction = { type: 'START_UPLOAD', id: ImageId('task-1') };

      const result = uploadQueueReducer(state, action);

      expect(result.status).toBe('processing');
      expect((result as { currentId: string }).currentId).toBe('task-1');
      expect(result.tasks[0].status).toBe('uploading');
    });
  });

  describe('UPLOAD_SUCCESS', () => {
    it('transitions back to idle on success', () => {
      const state: UploadQueueState = {
        status: 'processing',
        tasks: [createTestTask('task-1', 'uploading')],
        currentId: ImageId('task-1'),
      };
      const action: UploadQueueAction = {
        type: 'UPLOAD_SUCCESS',
        id: ImageId('task-1'),
        s3Key: 'uploads/task-1.webp',
      };

      const result = uploadQueueReducer(state, action);

      expect(result.status).toBe('idle');
      expect(result.tasks[0].status).toBe('success');
    });

    it('preserves paused state on success - fixes #47', () => {
      const state: UploadQueueState = {
        status: 'paused',
        tasks: [createTestTask('task-1', 'uploading')],
        reason: 'offline',
      };
      const action: UploadQueueAction = {
        type: 'UPLOAD_SUCCESS',
        id: ImageId('task-1'),
        s3Key: 'uploads/task-1.webp',
      };

      const result = uploadQueueReducer(state, action);

      // Critical: status remains 'paused', not 'idle'
      expect(result.status).toBe('paused');
      expect((result as { reason: string }).reason).toBe('offline');
      expect(result.tasks[0].status).toBe('success');
    });
  });

  describe('UPLOAD_FAILURE', () => {
    it('sets task to retrying for network errors', () => {
      const state: UploadQueueState = {
        status: 'processing',
        tasks: [createTestTask('task-1', 'uploading')],
        currentId: ImageId('task-1'),
      };
      const action: UploadQueueAction = {
        type: 'UPLOAD_FAILURE',
        id: ImageId('task-1'),
        error: 'Network error',
        errorType: 'network',
      };

      const result = uploadQueueReducer(state, action);

      expect(result.status).toBe('idle');
      expect(result.tasks[0].status).toBe('retrying');
      expect(result.tasks[0].retryCount).toBe(1);
    });

    it('sets task to failed for quota errors (no retry)', () => {
      const state: UploadQueueState = {
        status: 'processing',
        tasks: [createTestTask('task-1', 'uploading')],
        currentId: ImageId('task-1'),
      };
      const action: UploadQueueAction = {
        type: 'UPLOAD_FAILURE',
        id: ImageId('task-1'),
        error: 'Quota exceeded',
        errorType: 'quota',
      };

      const result = uploadQueueReducer(state, action);

      expect(result.tasks[0].status).toBe('failed');
    });

    it('preserves paused state on failure - fixes #47', () => {
      const state: UploadQueueState = {
        status: 'paused',
        tasks: [createTestTask('task-1', 'uploading')],
        reason: 'offline',
      };
      const action: UploadQueueAction = {
        type: 'UPLOAD_FAILURE',
        id: ImageId('task-1'),
        error: 'Network error',
        errorType: 'network',
      };

      const result = uploadQueueReducer(state, action);

      // Critical: status remains 'paused', not 'idle'
      expect(result.status).toBe('paused');
      expect((result as { reason: string }).reason).toBe('offline');
    });

    it('sets task to failed after max retries', () => {
      const task = createTestTask('task-1', 'uploading');
      task.retryCount = 2; // Already retried twice
      const state: UploadQueueState = {
        status: 'processing',
        tasks: [task],
        currentId: ImageId('task-1'),
      };
      const action: UploadQueueAction = {
        type: 'UPLOAD_FAILURE',
        id: ImageId('task-1'),
        error: 'Server error',
        errorType: 'server',
      };

      const result = uploadQueueReducer(state, action);

      // retryCount becomes 3, exceeds MAX_RETRY_COUNT (3)
      expect(result.tasks[0].status).toBe('failed');
      expect(result.tasks[0].retryCount).toBe(3);
    });
  });

  describe('SCHEDULE_RETRY', () => {
    it('sets task back to idle for reprocessing', () => {
      const state: UploadQueueState = {
        status: 'idle',
        tasks: [{ ...createTestTask('task-1'), status: 'retrying' as const, retryCount: 1 }],
      };
      const action: UploadQueueAction = { type: 'SCHEDULE_RETRY', id: ImageId('task-1') };

      const result = uploadQueueReducer(state, action);

      expect(result.tasks[0].status).toBe('idle');
      expect(result.tasks[0].retryCount).toBe(1); // Preserved
    });
  });

  describe('RETRY', () => {
    it('resets task for manual retry', () => {
      const task = createTestTask('task-1', 'failed');
      task.retryCount = 3;
      task.error = 'Previous error';
      const state: UploadQueueState = {
        status: 'idle',
        tasks: [task],
      };
      const action: UploadQueueAction = { type: 'RETRY', id: ImageId('task-1') };

      const result = uploadQueueReducer(state, action);

      expect(result.tasks[0].status).toBe('idle');
      expect(result.tasks[0].retryCount).toBe(0);
      expect(result.tasks[0].error).toBeUndefined();
    });
  });

  describe('PAUSE', () => {
    it('transitions to paused with offline reason', () => {
      const state: UploadQueueState = {
        status: 'idle',
        tasks: [createTestTask('task-1')],
      };
      const action: UploadQueueAction = { type: 'PAUSE', reason: 'offline' };

      const result = uploadQueueReducer(state, action);

      expect(result.status).toBe('paused');
      expect((result as { reason: string }).reason).toBe('offline');
    });

    it('transitions to paused with quota reason', () => {
      const state: UploadQueueState = {
        status: 'processing',
        tasks: [createTestTask('task-1', 'uploading')],
        currentId: ImageId('task-1'),
      };
      const action: UploadQueueAction = { type: 'PAUSE', reason: 'quota' };

      const result = uploadQueueReducer(state, action);

      expect(result.status).toBe('paused');
      expect((result as { reason: string }).reason).toBe('quota');
    });
  });

  describe('RESUME', () => {
    it('transitions from paused to idle', () => {
      const state: UploadQueueState = {
        status: 'paused',
        tasks: [createTestTask('task-1')],
        reason: 'offline',
      };
      const action: UploadQueueAction = { type: 'RESUME' };

      const result = uploadQueueReducer(state, action);

      expect(result.status).toBe('idle');
    });
  });

  describe('REMOVE', () => {
    it('removes task from queue', () => {
      const state: UploadQueueState = {
        status: 'idle',
        tasks: [createTestTask('task-1'), createTestTask('task-2')],
      };
      const action: UploadQueueAction = { type: 'REMOVE', id: ImageId('task-1') };

      const result = uploadQueueReducer(state, action);

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('task-2');
    });
  });

  describe('RESET_FAILED', () => {
    it('resets all failed tasks to idle', () => {
      const state: UploadQueueState = {
        status: 'idle',
        tasks: [
          { ...createTestTask('task-1'), status: 'failed' as const, retryCount: 3 },
          { ...createTestTask('task-2'), status: 'success' as const },
          { ...createTestTask('task-3'), status: 'failed' as const, retryCount: 2 },
        ],
      };
      const action: UploadQueueAction = { type: 'RESET_FAILED' };

      const result = uploadQueueReducer(state, action);

      expect(result.tasks[0].status).toBe('idle');
      expect(result.tasks[0].retryCount).toBe(0);
      expect(result.tasks[1].status).toBe('success'); // Unchanged
      expect(result.tasks[2].status).toBe('idle');
    });
  });
});

describe('shouldRetry', () => {
  it('retries network errors', () => {
    expect(shouldRetry('network', 1)).toBe(true);
    expect(shouldRetry('network', 2)).toBe(true);
    expect(shouldRetry('network', 3)).toBe(false); // Max reached
  });

  it('retries server errors', () => {
    expect(shouldRetry('server', 1)).toBe(true);
    expect(shouldRetry('server', 2)).toBe(true);
    expect(shouldRetry('server', 3)).toBe(false);
  });

  it('does not retry quota errors', () => {
    expect(shouldRetry('quota', 1)).toBe(false);
    expect(shouldRetry('quota', 0)).toBe(false);
  });

  it('does not retry unknown errors', () => {
    expect(shouldRetry('unknown', 1)).toBe(false);
    expect(shouldRetry('unknown', 0)).toBe(false);
  });
});

describe('classifyError', () => {
  it('classifies network errors', () => {
    expect(classifyError('fetch failed')).toBe('network');
    expect(classifyError('Network error')).toBe('network');
    expect(classifyError('Request timeout')).toBe('network');
    expect(classifyError('ECONNREFUSED')).toBe('network');
  });

  it('classifies quota errors', () => {
    expect(classifyError('Error 429: Too many requests')).toBe('quota');
    expect(classifyError('Rate limit exceeded')).toBe('quota');
    expect(classifyError('Quota exceeded')).toBe('quota');
    expect(classifyError('Error 403: Forbidden')).toBe('quota');
  });

  it('classifies server errors', () => {
    expect(classifyError('Error 500: Internal server error')).toBe('server');
    expect(classifyError('502 Bad Gateway')).toBe('server');
    expect(classifyError('503 Service Unavailable')).toBe('server');
    // Note: '504 Gateway Timeout' contains 'timeout' which matches network first
    // This is intentional - timeouts are treated as network issues for retry purposes
    expect(classifyError('504 Gateway')).toBe('server');
  });

  it('classifies unknown errors', () => {
    expect(classifyError('Something went wrong')).toBe('unknown');
    expect(classifyError('Unexpected error')).toBe('unknown');
  });
});
