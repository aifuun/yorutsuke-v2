// Upload Store - Zustand vanilla store for upload queue
// Pillar D: FSM - no boolean flags
// Pillar Q: Intent-ID for idempotency
import { createStore } from 'zustand/vanilla';
import type { ImageId, IntentId, TraceId } from '../../../00_kernel/types';
import type { UploadErrorType } from '../../../00_kernel/eventBus/types';

// Constants
export const MAX_RETRY_COUNT = 3;
export const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

// FSM Task Status
export type TaskStatus = 'idle' | 'uploading' | 'success' | 'failed' | 'retrying';

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

// FSM Queue Status
export type QueueStatus = 'idle' | 'processing' | 'paused';
export type PauseReason = 'offline' | 'quota';

export interface UploadState {
  status: QueueStatus;
  tasks: UploadTask[];
  currentId: ImageId | null;
  pauseReason: PauseReason | null;
}

export interface UploadActions {
  // Task management
  enqueue: (task: Omit<UploadTask, 'status' | 'retryCount'>) => void;
  remove: (id: ImageId) => void;

  // Upload lifecycle
  startUpload: (id: ImageId) => void;
  uploadSuccess: (id: ImageId, s3Key: string) => void;
  uploadFailure: (id: ImageId, error: string, errorType: UploadErrorType) => void;

  // Retry management
  scheduleRetry: (id: ImageId) => void;
  retry: (id: ImageId) => void;
  resetAllFailed: () => void;

  // Queue control
  pause: (reason: PauseReason) => void;
  resume: () => void;

  // Direct state access
  getTasks: () => UploadTask[];
  getStatus: () => QueueStatus;
  getIdleTasks: () => UploadTask[];
}

export type UploadStore = UploadState & UploadActions;

// Helper: update task in list
function updateTask(tasks: UploadTask[], id: ImageId, update: Partial<UploadTask>): UploadTask[] {
  return tasks.map(t => (t.id === id ? { ...t, ...update } : t));
}

// Helper: check if should retry based on error type and count
export function shouldRetry(errorType: UploadErrorType, retryCount: number): boolean {
  // Don't retry quota or unknown errors
  if (errorType === 'quota' || errorType === 'unknown') return false;
  // Retry network and server errors up to MAX_RETRY_COUNT
  return retryCount < MAX_RETRY_COUNT;
}

// Helper: classify error for retry logic
export function classifyError(error: string): UploadErrorType {
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

// Create vanilla store (not React-bound)
export const uploadStore = createStore<UploadStore>((set, get) => ({
  // Initial state
  status: 'idle',
  tasks: [],
  currentId: null,
  pauseReason: null,

  // Task management
  enqueue: (task) => set((state) => {
    // Avoid duplicates
    if (state.tasks.some(t => t.id === task.id)) {
      return state;
    }
    return {
      tasks: [...state.tasks, { ...task, status: 'idle', retryCount: 0 }],
    };
  }),

  remove: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id),
  })),

  // Upload lifecycle
  startUpload: (id) => set((state) => ({
    status: 'processing',
    tasks: updateTask(state.tasks, id, { status: 'uploading' }),
    currentId: id,
  })),

  uploadSuccess: (id, _s3Key) => set((state) => {
    const newTasks = updateTask(state.tasks, id, { status: 'success' });
    // Preserve 'paused' state if it was set during upload - fixes #47
    if (state.status === 'paused') {
      return { tasks: newTasks };
    }
    return {
      status: 'idle',
      tasks: newTasks,
      currentId: null,
    };
  }),

  uploadFailure: (id, error, errorType) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    const newRetryCount = (task?.retryCount ?? 0) + 1;
    const willRetry = shouldRetry(errorType, newRetryCount);

    const newTasks = updateTask(state.tasks, id, {
      status: willRetry ? 'retrying' : 'failed',
      retryCount: newRetryCount,
      error,
      errorType,
    });

    // Preserve 'paused' state if it was set during upload - fixes #47
    if (state.status === 'paused') {
      return { tasks: newTasks };
    }
    return {
      status: 'idle',
      tasks: newTasks,
      currentId: null,
    };
  }),

  // Retry management
  scheduleRetry: (id) => set((state) => ({
    tasks: updateTask(state.tasks, id, { status: 'idle' }),
  })),

  retry: (id) => set((state) => ({
    tasks: updateTask(state.tasks, id, {
      status: 'idle',
      retryCount: 0,
      error: undefined,
      errorType: undefined,
    }),
  })),

  resetAllFailed: () => set((state) => ({
    status: 'idle',
    tasks: state.tasks.map(t =>
      t.status === 'failed'
        ? { ...t, status: 'idle' as TaskStatus, retryCount: 0, error: undefined, errorType: undefined }
        : t
    ),
  })),

  // Queue control
  pause: (reason) => set({
    status: 'paused',
    pauseReason: reason,
  }),

  resume: () => set({
    status: 'idle',
    pauseReason: null,
  }),

  // Direct state access
  getTasks: () => get().tasks,
  getStatus: () => get().status,
  getIdleTasks: () => get().tasks.filter(t => t.status === 'idle'),
}));
