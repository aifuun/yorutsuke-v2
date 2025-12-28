/**
 * Pillar O: Async Feedback Strategy Template
 *
 * Long operations return 202 Accepted + Job-ID.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - NEVER block HTTP for operations > 200ms
 * - Return 202 + jobId immediately
 * - Provide status endpoint for polling
 * - Update progress during execution
 * - Use reasonable poll interval (2-5s)
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Job ID - branded type for type safety.
 */
export type JobId = string & { readonly __brand: 'JobId' };

export function createJobId(): JobId {
  return `job_${crypto.randomUUID()}` as JobId;
}

/**
 * Job status states.
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Job definition.
 */
export interface Job<TPayload = unknown, TResult = unknown> {
  readonly id: JobId;
  readonly type: string;
  readonly payload: TPayload;
  status: JobStatus;
  progress: number;
  result?: TResult;
  error?: string;
  readonly traceId: string;
  readonly userId?: string;
  readonly createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Response when job is accepted.
 */
export interface AsyncJobResponse {
  readonly status: 'accepted';
  readonly jobId: JobId;
  readonly statusUrl: string;
  readonly estimatedDuration?: number;
}

/**
 * Response for job status query.
 */
export interface JobStatusResponse<TResult = unknown> {
  readonly jobId: JobId;
  readonly status: JobStatus;
  readonly progress: number;
  readonly result?: TResult;
  readonly error?: string;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}

// =============================================================================
// JOB QUEUE INTERFACE
// =============================================================================

/**
 * Job queue interface.
 * Implement with Redis, SQS, or database.
 */
export interface JobQueue {
  /**
   * Enqueue a new job.
   * Returns immediately with jobId.
   */
  enqueue<TPayload>(params: {
    type: string;
    payload: TPayload;
    traceId: string;
    userId?: string;
  }): Promise<JobId>;

  /**
   * Get current job status.
   */
  getStatus<TResult>(jobId: JobId): Promise<Job<unknown, TResult> | null>;

  /**
   * Update job progress (0-100).
   */
  updateProgress(jobId: JobId, progress: number): Promise<void>;

  /**
   * Mark job as processing.
   */
  markProcessing(jobId: JobId): Promise<void>;

  /**
   * Mark job as completed with result.
   */
  complete<TResult>(jobId: JobId, result: TResult): Promise<void>;

  /**
   * Mark job as failed with error.
   */
  fail(jobId: JobId, error: string): Promise<void>;

  /**
   * Cancel a pending/processing job.
   */
  cancel(jobId: JobId): Promise<boolean>;
}

// =============================================================================
// IN-MEMORY JOB QUEUE (for development/testing)
// =============================================================================

/**
 * Simple in-memory job queue.
 *
 * ⚠️ AI NOTE: Use this for development only.
 * Production should use Redis, SQS, etc.
 */
export class InMemoryJobQueue implements JobQueue {
  private jobs = new Map<JobId, Job>();
  private handlers = new Map<string, (job: Job) => Promise<void>>();

  /**
   * Register a job handler.
   */
  registerHandler(type: string, handler: (job: Job) => Promise<void>): void {
    this.handlers.set(type, handler);
  }

  async enqueue<TPayload>(params: {
    type: string;
    payload: TPayload;
    traceId: string;
    userId?: string;
  }): Promise<JobId> {
    const jobId = createJobId();

    const job: Job<TPayload> = {
      id: jobId,
      type: params.type,
      payload: params.payload,
      status: 'pending',
      progress: 0,
      traceId: params.traceId,
      userId: params.userId,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job as Job);

    // Process async (don't await)
    this.processJob(jobId);

    return jobId;
  }

  private async processJob(jobId: JobId): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.fail(jobId, `No handler for job type: ${job.type}`);
      return;
    }

    try {
      await this.markProcessing(jobId);
      await handler(job);
      // Handler should call complete() when done
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.fail(jobId, message);
    }
  }

  async getStatus<TResult>(jobId: JobId): Promise<Job<unknown, TResult> | null> {
    return (this.jobs.get(jobId) as Job<unknown, TResult>) ?? null;
  }

  async updateProgress(jobId: JobId, progress: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
    }
  }

  async markProcessing(jobId: JobId): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'processing';
      job.startedAt = new Date();
    }
  }

  async complete<TResult>(jobId: JobId, result: TResult): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      job.completedAt = new Date();
    }
  }

  async fail(jobId: JobId, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.completedAt = new Date();
    }
  }

  async cancel(jobId: JobId): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'pending' || job.status === 'processing')) {
      job.status = 'cancelled';
      job.completedAt = new Date();
      return true;
    }
    return false;
  }
}

// =============================================================================
// REACT HOOK: POLLING
// =============================================================================

/**
 * React hook for polling job status.
 *
 * ⚠️ AI NOTE: Use 2-5 second poll interval.
 * Don't hammer the server with faster polling.
 *
 * @example
 * ```tsx
 * function ExportButton() {
 *   const [jobId, setJobId] = useState<JobId | null>(null);
 *   const { isLoading, progress, isComplete, result, error } = useAsyncJob(jobId);
 *
 *   const startExport = async () => {
 *     const response = await api.post('/exports', { format: 'csv' });
 *     setJobId(response.jobId);
 *   };
 *
 *   if (isLoading) return <ProgressBar value={progress} />;
 *   if (isComplete) return <DownloadLink url={result.downloadUrl} />;
 *   if (error) return <ErrorMessage message={error} />;
 *
 *   return <button onClick={startExport}>Export</button>;
 * }
 * ```
 */
export function useAsyncJob<TResult = unknown>(
  jobId: JobId | null,
  options: {
    pollInterval?: number;
    onComplete?: (result: TResult) => void;
    onError?: (error: string) => void;
  } = {}
): {
  status: JobStatus | null;
  isLoading: boolean;
  isComplete: boolean;
  isFailed: boolean;
  progress: number;
  result: TResult | undefined;
  error: string | undefined;
} {
  const { pollInterval = 2000, onComplete, onError } = options;

  // Note: This is a template. In actual usage:
  // import { useState, useEffect, useRef } from 'react';

  // Placeholder implementation
  return {
    status: null,
    isLoading: false,
    isComplete: false,
    isFailed: false,
    progress: 0,
    result: undefined,
    error: undefined,
  };
}

/*
// Full implementation:

export function useAsyncJob<TResult = unknown>(
  jobId: JobId | null,
  options: {
    pollInterval?: number;
    onComplete?: (result: TResult) => void;
    onError?: (error: string) => void;
  } = {}
) {
  const { pollInterval = 2000, onComplete, onError } = options;
  const [status, setStatus] = useState<JobStatusResponse<TResult> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      return;
    }

    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const data: JobStatusResponse<TResult> = await response.json();
        setStatus(data);

        if (data.status === 'completed') {
          onComplete?.(data.result!);
        } else if (data.status === 'failed') {
          onError?.(data.error!);
        } else if (data.status === 'pending' || data.status === 'processing') {
          // Continue polling
          timeoutRef.current = setTimeout(poll, pollInterval);
        }
      } catch (error) {
        console.error('Poll error:', error);
        timeoutRef.current = setTimeout(poll, pollInterval);
      }
    };

    poll();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [jobId, pollInterval, onComplete, onError]);

  return {
    status: status?.status ?? null,
    isLoading: status?.status === 'pending' || status?.status === 'processing',
    isComplete: status?.status === 'completed',
    isFailed: status?.status === 'failed',
    progress: status?.progress ?? 0,
    result: status?.result,
    error: status?.error,
  };
}
*/

// =============================================================================
// CONTROLLER PATTERN
// =============================================================================

/*
⚠️ AI: Copy this pattern for async endpoints:

```typescript
// controllers/exportController.ts

import { JobQueue, AsyncJobResponse } from '@/pillar-o/async';

export function createExportController(jobQueue: JobQueue) {
  return {
    // POST /api/exports - Start export job
    async startExport(req: Request, res: Response) {
      const ctx = getContext();
      const cmd = ExportCommandSchema.parse(req.body);

      // Enqueue job (returns immediately)
      const jobId = await jobQueue.enqueue({
        type: 'EXPORT',
        payload: cmd,
        traceId: ctx.traceId,
        userId: ctx.userId,
      });

      // Return 202 Accepted
      const response: AsyncJobResponse = {
        status: 'accepted',
        jobId,
        statusUrl: `/api/jobs/${jobId}`,
        estimatedDuration: 30,  // seconds
      };

      res.status(202).json(response);
    },

    // GET /api/jobs/:jobId - Get job status
    async getJobStatus(req: Request, res: Response) {
      const jobId = req.params.jobId as JobId;
      const job = await jobQueue.getStatus(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    },

    // DELETE /api/jobs/:jobId - Cancel job
    async cancelJob(req: Request, res: Response) {
      const jobId = req.params.jobId as JobId;
      const cancelled = await jobQueue.cancel(jobId);

      if (!cancelled) {
        return res.status(400).json({ error: 'Cannot cancel job' });
      }

      res.json({ status: 'cancelled' });
    },
  };
}
```
*/

// =============================================================================
// WORKER PATTERN
// =============================================================================

/*
⚠️ AI: Copy this pattern for job workers:

```typescript
// workers/exportWorker.ts

import { Job, JobQueue } from '@/pillar-o/async';

interface ExportPayload {
  format: 'csv' | 'xlsx';
  filters: Record<string, unknown>;
}

interface ExportResult {
  downloadUrl: string;
  recordCount: number;
}

export function registerExportWorker(jobQueue: JobQueue) {
  jobQueue.registerHandler('EXPORT', async (job: Job<ExportPayload, ExportResult>) => {
    // Update progress as we go
    await jobQueue.updateProgress(job.id, 10);

    // Fetch data
    const data = await fetchData(job.payload.filters);
    await jobQueue.updateProgress(job.id, 40);

    // Generate file
    const file = await generateFile(data, job.payload.format);
    await jobQueue.updateProgress(job.id, 70);

    // Upload
    const url = await uploadToStorage(file);
    await jobQueue.updateProgress(job.id, 90);

    // Complete with result
    await jobQueue.complete(job.id, {
      downloadUrl: url,
      recordCount: data.length,
    });
  });
}
```
*/

// =============================================================================
// EXPORTS
// =============================================================================

export { InMemoryJobQueue as JobQueueImpl };
