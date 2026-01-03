// Pillar L: Headless - logic without UI
// Pillar D: FSM - no boolean flags, single source of truth
// Pillar G: @trigger upload:complete, upload:failed
// Pillar Q: Intent-ID for idempotency
import { useReducer, useCallback, useEffect, useRef } from 'react';
import type { ImageId, UserId, IntentId, TraceId } from '../../../00_kernel/types';
import type { UploadErrorType } from '../../../00_kernel/eventBus/types';
import { emit } from '../../../00_kernel/eventBus';
import { useNetworkStatus } from '../../../00_kernel/network';
import { logger } from '../../../00_kernel/telemetry';
import { canUpload } from '../../../01_domains/receipt';
import { getPresignedUrl, uploadToS3 } from '../adapters/uploadApi';
import { countTodayUploads } from '../adapters/imageDb';

// Constants
const MAX_RETRY_COUNT = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

// FSM Task State (Pillar D) - 'retrying' = waiting for retry delay
type TaskStatus = 'idle' | 'uploading' | 'success' | 'failed' | 'retrying';

export interface UploadTask {
  id: ImageId;
  intentId: IntentId;  // Pillar Q: Idempotency key
  traceId: TraceId;    // Pillar N: Lifecycle tracking
  filePath: string;
  status: TaskStatus;
  retryCount: number;
  error?: string;
  errorType?: UploadErrorType;
}

// FSM Queue State (Pillar D)
type QueueState =
  | { status: 'idle'; tasks: UploadTask[] }
  | { status: 'processing'; tasks: UploadTask[]; currentId: ImageId }
  | { status: 'paused'; tasks: UploadTask[]; reason: 'offline' | 'quota' };

type Action =
  | { type: 'ENQUEUE'; task: UploadTask }
  | { type: 'START_UPLOAD'; id: ImageId }
  | { type: 'UPLOAD_SUCCESS'; id: ImageId; s3Key: string }
  | { type: 'UPLOAD_FAILURE'; id: ImageId; error: string; errorType: UploadErrorType }
  | { type: 'SCHEDULE_RETRY'; id: ImageId }  // After retry delay, set task back to idle
  | { type: 'RETRY'; id: ImageId }
  | { type: 'PAUSE'; reason: 'offline' | 'quota' }
  | { type: 'RESUME' }
  | { type: 'REMOVE'; id: ImageId }
  | { type: 'RESET_FAILED' };

function reducer(state: QueueState, action: Action): QueueState {
  switch (action.type) {
    case 'ENQUEUE': {
      // Avoid duplicates
      if (state.tasks.some(t => t.id === action.task.id)) {
        return state;
      }
      return {
        ...state,
        tasks: [...state.tasks, action.task],
      };
    }

    case 'START_UPLOAD':
      return {
        status: 'processing',
        tasks: updateTask(state.tasks, action.id, { status: 'uploading' }),
        currentId: action.id,
      };

    case 'UPLOAD_SUCCESS':
      // Preserve 'paused' state if it was set during upload - fixes #47
      if (state.status === 'paused') {
        return {
          status: 'paused',
          tasks: updateTask(state.tasks, action.id, { status: 'success' }),
          reason: state.reason,
        };
      }
      return {
        status: 'idle',
        tasks: updateTask(state.tasks, action.id, { status: 'success' }),
      };

    case 'UPLOAD_FAILURE': {
      const task = state.tasks.find(t => t.id === action.id);
      const newRetryCount = (task?.retryCount ?? 0) + 1;
      const willRetry = shouldRetry(action.errorType, newRetryCount);

      const updatedTasks = updateTask(state.tasks, action.id, {
        status: willRetry ? 'retrying' : 'failed',
        retryCount: newRetryCount,
        error: action.error,
        errorType: action.errorType,
      });

      // Preserve 'paused' state if it was set during upload - fixes #47
      if (state.status === 'paused') {
        return {
          status: 'paused',
          tasks: updatedTasks,
          reason: state.reason,
        };
      }
      return {
        status: 'idle',
        tasks: updatedTasks,
      };
    }

    case 'SCHEDULE_RETRY':
      // After retry delay, set task back to idle for processing
      return {
        ...state,
        tasks: updateTask(state.tasks, action.id, { status: 'idle' }),
      };

    case 'RETRY':
      return {
        ...state,
        tasks: updateTask(state.tasks, action.id, {
          status: 'idle',
          retryCount: 0,
          error: undefined,
          errorType: undefined,
        }),
      };

    case 'PAUSE':
      return {
        status: 'paused',
        tasks: state.tasks,
        reason: action.reason,
      };

    case 'RESUME':
      return {
        status: 'idle',
        tasks: state.tasks,
      };

    case 'REMOVE':
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.id),
      };

    case 'RESET_FAILED': {
      const resetTasks = state.tasks.map(t =>
        t.status === 'failed'
          ? { ...t, status: 'idle' as TaskStatus, retryCount: 0, error: undefined, errorType: undefined }
          : t
      );
      return { status: 'idle', tasks: resetTasks };
    }

    default:
      return state;
  }
}

function updateTask(
  tasks: UploadTask[],
  id: ImageId,
  update: Partial<UploadTask>
): UploadTask[] {
  return tasks.map(t => (t.id === id ? { ...t, ...update } : t));
}

function shouldRetry(errorType: UploadErrorType, retryCount: number): boolean {
  // Don't retry quota or unknown errors
  if (errorType === 'quota' || errorType === 'unknown') return false;
  // Retry network and server errors up to MAX_RETRY_COUNT
  return retryCount < MAX_RETRY_COUNT;
}

/**
 * Classify error for retry logic and UI display
 */
function classifyError(error: string): UploadErrorType {
  const errorLower = error.toLowerCase();

  // Network errors - auto-retry
  if (errorLower.includes('fetch') ||
      errorLower.includes('network') ||
      errorLower.includes('timeout') ||
      errorLower.includes('econnrefused')) {
    return 'network';
  }

  // Quota/auth errors - no retry
  if (errorLower.includes('429') ||
      errorLower.includes('limit') ||
      errorLower.includes('quota') ||
      errorLower.includes('403')) {
    return 'quota';
  }

  // Server errors - auto-retry
  if (errorLower.includes('500') ||
      errorLower.includes('502') ||
      errorLower.includes('503') ||
      errorLower.includes('504')) {
    return 'server';
  }

  return 'unknown';
}

/**
 * Upload Queue Hook
 *
 * @listen network:changed (via useNetworkStatus)
 * @trigger upload:complete - When upload succeeds
 * @trigger upload:failed - When upload fails
 *
 * Pillar L: Returns data + actions only, no JSX
 * Pillar D: Uses FSM states instead of boolean flags
 *
 * @param userId - Current user ID
 * @param dailyLimit - Daily upload limit (from useQuota)
 */
export function useUploadQueue(userId: UserId | null, dailyLimit: number = 30) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle', tasks: [] });
  const { isOnline, justReconnected } = useNetworkStatus();
  const lastUploadTimeRef = useRef<number | null>(null);
  // Note: processingRef removed - FSM state is single source of truth (Pillar D)

  // Resume uploads when back online
  useEffect(() => {
    if (justReconnected && state.status === 'paused') {
      logger.info('[UploadQueue] Back online - resuming');
      dispatch({ type: 'RESUME' });
    }
  }, [justReconnected, state.status]);

  // Pause when offline
  useEffect(() => {
    if (!isOnline && state.status !== 'paused') {
      logger.info('[UploadQueue] Offline - pausing');
      dispatch({ type: 'PAUSE', reason: 'offline' });
    }
  }, [isOnline, state.status]);

  // Process queue when idle and online (FSM is single source of truth)
  useEffect(() => {
    if (!isOnline || state.status !== 'idle' || !userId) return;

    // Only process tasks with 'idle' status (not 'retrying', 'uploading', etc.)
    const idleTasks = state.tasks.filter(t => t.status === 'idle');

    if (idleTasks.length === 0) return;

    // Process first idle task
    const task = idleTasks[0];
    processTask(task);
  }, [state, isOnline, userId]);

  const processTask = async (task: UploadTask) => {
    if (!userId) return;

    // FSM state guards against duplicate processing - no need for processingRef
    if (state.status === 'processing') return;

    // Check quota from database (persisted across restarts) - fixes #46
    const uploadedToday = await countTodayUploads(userId);
    const quotaCheck = canUpload(uploadedToday, dailyLimit, lastUploadTimeRef.current);

    if (!quotaCheck.allowed) {
      logger.warn('[UploadQueue] Quota check failed', { reason: quotaCheck.reason });
      dispatch({ type: 'PAUSE', reason: 'quota' });
      return;
    }

    dispatch({ type: 'START_UPLOAD', id: task.id });

    try {
      // Get presigned URL (Pillar Q: pass intentId for idempotency)
      const { url, key } = await getPresignedUrl(userId, `${task.id}.webp`, task.intentId);

      // Read file and upload
      const response = await fetch(`file://${task.filePath}`);
      if (!response.ok) {
        throw new Error(`Failed to read file: ${response.status}`);
      }
      const blob = await response.blob();

      await uploadToS3(url, blob);

      // Success
      lastUploadTimeRef.current = Date.now();
      dispatch({ type: 'UPLOAD_SUCCESS', id: task.id, s3Key: key });

      // @trigger upload:complete
      emit('upload:complete', { id: task.id, traceId: task.traceId, s3Key: key });

      logger.info('[UploadQueue] Upload success', { id: task.id, traceId: task.traceId, s3Key: key });
    } catch (e) {
      const error = String(e);
      const errorType = classifyError(error);
      const willRetry = shouldRetry(errorType, task.retryCount + 1);

      dispatch({ type: 'UPLOAD_FAILURE', id: task.id, error, errorType });

      // @trigger upload:failed
      emit('upload:failed', {
        id: task.id,
        traceId: task.traceId,
        error,
        errorType,
        willRetry,
        retryCount: task.retryCount + 1,
      });

      logger.warn('[UploadQueue] Upload failed', { id: task.id, traceId: task.traceId, error, errorType, willRetry });

      // Schedule retry with exponential backoff via FSM
      if (willRetry) {
        const delay = RETRY_DELAYS[task.retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        setTimeout(() => {
          dispatch({ type: 'SCHEDULE_RETRY', id: task.id });
        }, delay);
      }
    }
  };

  // Actions
  const enqueue = useCallback((id: ImageId, filePath: string, intentId: IntentId, traceId: TraceId) => {
    logger.debug('[UploadQueue] Enqueue', { id, intentId, traceId });
    dispatch({
      type: 'ENQUEUE',
      task: { id, intentId, traceId, filePath, status: 'idle', retryCount: 0 },
    });
  }, []);

  const retry = useCallback((id: ImageId) => {
    dispatch({ type: 'RETRY', id });
  }, []);

  const retryAllFailed = useCallback(() => {
    dispatch({ type: 'RESET_FAILED' });
  }, []);

  const remove = useCallback((id: ImageId) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  // Computed values (include 'retrying' in pending as it's waiting to retry)
  const pendingCount = state.tasks.filter(
    t => t.status === 'idle' || t.status === 'uploading' || t.status === 'retrying'
  ).length;
  const failedCount = state.tasks.filter(t => t.status === 'failed').length;
  const successCount = state.tasks.filter(t => t.status === 'success').length;

  return {
    state,
    // Actions
    enqueue,
    retry,
    retryAllFailed,
    remove,
    // Computed
    pendingCount,
    failedCount,
    successCount,
    isOnline,
    isPaused: state.status === 'paused',
    pauseReason: state.status === 'paused' ? state.reason : null,
  };
}
