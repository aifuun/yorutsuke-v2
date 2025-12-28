# Pillar O: Async Feedback Strategy

> Long operations return 202 Accepted + Job-ID

## Rule

Long-running Tier 3 operations must **NEVER** block the HTTP connection waiting for completion. Return immediately with a Job-ID for status polling.

## Purpose

- Prevent gateway timeouts
- Improve user experience
- Enable progress tracking
- Support operation cancellation

## Implementation

### Response Pattern

```typescript
// Immediate response
interface AsyncJobResponse {
  status: 'accepted';
  jobId: JobId;
  statusUrl: string;
  estimatedDuration?: number;  // seconds
}

// Status response
interface JobStatusResponse {
  jobId: JobId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;  // 0-100
  result?: unknown;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}
```

### Controller Implementation

```typescript
// controllers/exportController.ts

app.post('/api/exports', async (req, res) => {
  const ctx = ContextStore.get();
  const cmd = ExportCommandSchema.parse(req.body);

  // Create job immediately
  const jobId = await jobQueue.enqueue({
    type: 'EXPORT',
    payload: cmd,
    traceId: ctx.traceId,
    userId: ctx.userId,
  });

  // Return 202 Accepted
  res.status(202).json({
    status: 'accepted',
    jobId,
    statusUrl: `/api/jobs/${jobId}`,
    estimatedDuration: 30,
  });
});

app.get('/api/jobs/:jobId', async (req, res) => {
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
});
```

### Job Queue

```typescript
// infrastructure/jobQueue.ts

interface Job {
  id: JobId;
  type: string;
  payload: unknown;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
  traceId: string;
  userId?: UserId;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

class JobQueue {
  async enqueue(job: Omit<Job, 'id' | 'status' | 'progress' | 'createdAt'>): Promise<JobId> {
    const jobId = `job_${crypto.randomUUID()}` as JobId;

    await this.store.set(jobId, {
      ...job,
      id: jobId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    });

    // Dispatch to worker
    await this.dispatcher.dispatch(jobId);

    return jobId;
  }

  async updateProgress(jobId: JobId, progress: number): Promise<void> {
    await this.store.update(jobId, { progress });
  }

  async complete(jobId: JobId, result: unknown): Promise<void> {
    await this.store.update(jobId, {
      status: 'completed',
      progress: 100,
      result,
      completedAt: new Date(),
    });
  }

  async fail(jobId: JobId, error: string): Promise<void> {
    await this.store.update(jobId, {
      status: 'failed',
      error,
      completedAt: new Date(),
    });
  }
}
```

### Frontend Polling

```typescript
// headless/useAsyncJob.ts

function useAsyncJob<T>(jobId: JobId | null) {
  const [status, setStatus] = useState<JobStatusResponse | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      const response = await fetch(`/api/jobs/${jobId}`);
      const data = await response.json();
      setStatus(data);

      if (data.status === 'pending' || data.status === 'processing') {
        // Continue polling
        setTimeout(poll, 2000);
      }
    };

    poll();
  }, [jobId]);

  return {
    isLoading: status?.status === 'pending' || status?.status === 'processing',
    isComplete: status?.status === 'completed',
    isFailed: status?.status === 'failed',
    progress: status?.progress ?? 0,
    result: status?.result as T | undefined,
    error: status?.error,
  };
}

// Usage
function ExportButton() {
  const [jobId, setJobId] = useState<JobId | null>(null);
  const { isLoading, progress, isComplete, result } = useAsyncJob(jobId);

  const startExport = async () => {
    const response = await api.post('/exports', { format: 'csv' });
    setJobId(response.jobId);
  };

  if (isLoading) {
    return <ProgressBar value={progress} />;
  }

  if (isComplete) {
    return <DownloadLink url={result.downloadUrl} />;
  }

  return <button onClick={startExport}>Export</button>;
}
```

### WebSocket Alternative

```typescript
// For real-time updates instead of polling

// Server
wss.on('connection', (ws, req) => {
  const jobId = extractJobId(req);

  jobQueue.subscribe(jobId, (update) => {
    ws.send(JSON.stringify(update));

    if (update.status === 'completed' || update.status === 'failed') {
      ws.close();
    }
  });
});

// Client
function useAsyncJobWs<T>(jobId: JobId | null) {
  const [status, setStatus] = useState<JobStatusResponse | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const ws = new WebSocket(`/ws/jobs/${jobId}`);

    ws.onmessage = (event) => {
      setStatus(JSON.parse(event.data));
    };

    return () => ws.close();
  }, [jobId]);

  return status;
}
```

## Good Example

```typescript
// ✅ Proper async pattern

// Controller
app.post('/api/reports/generate', async (req, res) => {
  const jobId = await jobQueue.enqueue({
    type: 'GENERATE_REPORT',
    payload: req.body,
  });

  res.status(202).json({
    status: 'accepted',
    jobId,
    statusUrl: `/api/jobs/${jobId}`,
  });
});

// Worker
async function processGenerateReport(job: Job) {
  await jobQueue.updateProgress(job.id, 10);

  const data = await fetchData();
  await jobQueue.updateProgress(job.id, 50);

  const report = await generateReport(data);
  await jobQueue.updateProgress(job.id, 90);

  const url = await uploadReport(report);

  await jobQueue.complete(job.id, { downloadUrl: url });
}
```

## Bad Example

```typescript
// ❌ Blocking request for long operation
app.post('/api/reports/generate', async (req, res) => {
  // This could take 5+ minutes!
  const data = await fetchAllData();
  const report = await generateReport(data);
  const url = await uploadToS3(report);

  // Gateway timeout, user sees error
  res.json({ downloadUrl: url });
});

// ❌ No progress feedback
app.post('/api/exports', async (req, res) => {
  const jobId = await startJob(req.body);
  res.json({ jobId });
  // No statusUrl, no estimated time
});
```

## Anti-Patterns

1. **Synchronous long operations**
   ```typescript
   // ❌ Blocks for minutes
   const result = await longOperation();
   res.json(result);
   ```

2. **No progress updates**
   ```typescript
   // ❌ User has no idea what's happening
   await doEverything();  // 5 minutes of silence
   ```

3. **Polling too fast**
   ```typescript
   // ❌ Hammering the server
   setInterval(poll, 100);  // 10 times per second!
   ```

4. **No timeout handling**
   ```typescript
   // ❌ Jobs can run forever
   while (status !== 'complete') {
     await sleep(1000);
   }
   ```

## Exceptions

- Operations guaranteed to complete under 200ms
- Cached/pre-computed responses
- Simple CRUD operations

## Checklist

- [ ] Long operations return 202 + Job-ID
- [ ] Status endpoint available for polling
- [ ] Progress updates during execution
- [ ] Client polls with reasonable interval (2-5s)
- [ ] Timeout/deadline for job completion
- [ ] Failed jobs include error details

## References

- Related: Pillar Q (Idempotency) - job deduplication
- Related: Pillar R (Observability) - job logging
- Pattern: Job Queue, Background Workers, SSE
- Template: `.prot/pillar-o/async.ts`
- Checklist: `.prot/pillar-o/checklist.md`
