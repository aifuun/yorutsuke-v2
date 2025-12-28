# Pillar O: Async Feedback Strategy Checklist

> Use this checklist when implementing long-running operations.

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Explicit > Abstract** | Clear job status states and transitions |
| **Copy > Generate** | Copy controller/worker patterns from template |
| **Clear > DRY** | Each endpoint has explicit async response |

## When to Apply

- [ ] Operation takes > 200ms
- [ ] Report generation, exports, imports
- [ ] External API calls with long latency
- [ ] Batch processing operations
- [ ] File processing / conversion

## When NOT to Apply

- [ ] Simple CRUD (< 200ms)
- [ ] Cached responses
- [ ] Pre-computed data

## Creating Async Endpoint

### 1. API Response Pattern

- [ ] Return 202 Accepted (not 200)
- [ ] Include jobId in response
- [ ] Include statusUrl for polling
- [ ] Optionally include estimatedDuration

```typescript
// ✅ Correct: 202 with job info
res.status(202).json({
  status: 'accepted',
  jobId: 'job_abc123',
  statusUrl: '/api/jobs/job_abc123',
  estimatedDuration: 30,
});

// ❌ Wrong: Blocking until complete
const result = await longOperation();  // 5 minutes!
res.json(result);
```

### 2. Job Queue Integration

- [ ] Enqueue job immediately
- [ ] Return before processing starts
- [ ] Store job with traceId for observability

```typescript
// ✅ Correct: Enqueue and return
const jobId = await jobQueue.enqueue({
  type: 'EXPORT',
  payload: cmd,
  traceId: ctx.traceId,
});
res.status(202).json({ jobId, statusUrl: `/api/jobs/${jobId}` });

// ❌ Wrong: Process inline
const result = await processExport(cmd);  // Blocks request
res.json(result);
```

### 3. Status Endpoint

- [ ] GET endpoint for job status
- [ ] Returns current status and progress
- [ ] Returns result when completed
- [ ] Returns error details when failed

```typescript
// GET /api/jobs/:jobId
res.json({
  jobId: job.id,
  status: job.status,      // pending|processing|completed|failed
  progress: job.progress,  // 0-100
  result: job.result,      // Only when completed
  error: job.error,        // Only when failed
});
```

### 4. Worker Implementation

- [ ] Update progress during execution
- [ ] Complete with result on success
- [ ] Fail with error message on failure
- [ ] Handle cancellation if supported

```typescript
// ✅ Correct: Progress updates
async function processJob(job: Job) {
  await jobQueue.updateProgress(job.id, 10);
  const data = await fetchData();

  await jobQueue.updateProgress(job.id, 50);
  const result = await transform(data);

  await jobQueue.updateProgress(job.id, 90);
  await jobQueue.complete(job.id, result);
}

// ❌ Wrong: No progress updates
async function processJob(job: Job) {
  const result = await doEverything();  // User sees 0% for 5 min
  await jobQueue.complete(job.id, result);
}
```

## Client Implementation

### 5. Polling Hook

- [ ] Poll interval 2-5 seconds
- [ ] Stop polling when completed/failed
- [ ] Handle network errors gracefully
- [ ] Clean up on unmount

```typescript
// ✅ Correct: Reasonable poll interval
const { progress, isComplete, result } = useAsyncJob(jobId, {
  pollInterval: 2000,  // 2 seconds
});

// ❌ Wrong: Hammering server
setInterval(poll, 100);  // 10 times per second!
```

### 6. UI Feedback

- [ ] Show progress indicator
- [ ] Show current percentage
- [ ] Handle completion state
- [ ] Handle error state

```tsx
function ExportButton() {
  const { isLoading, progress, isComplete, result, error } = useAsyncJob(jobId);

  if (isLoading) return <ProgressBar value={progress} />;
  if (isComplete) return <DownloadLink url={result.downloadUrl} />;
  if (error) return <ErrorMessage message={error} />;

  return <button onClick={startExport}>Export</button>;
}
```

## Code Review Checklist

### API Layer
- [ ] Long operations return 202, not 200
- [ ] Response includes jobId and statusUrl
- [ ] Status endpoint exists
- [ ] Cancel endpoint exists (optional)

### Job Queue
- [ ] Job persisted before returning
- [ ] Job includes traceId
- [ ] Progress updated during execution
- [ ] Result/error stored on completion

### Client
- [ ] Poll interval is 2-5 seconds
- [ ] Polling stops on terminal state
- [ ] Progress displayed to user
- [ ] Error handling implemented

### Timeout/Cleanup
- [ ] Job has maximum execution time
- [ ] Stale jobs are cleaned up
- [ ] Orphaned jobs are handled

## Common Patterns

### 1. File Export

```typescript
// Endpoint
app.post('/api/exports', async (req, res) => {
  const jobId = await jobQueue.enqueue({ type: 'EXPORT', payload: req.body });
  res.status(202).json({ jobId, statusUrl: `/api/jobs/${jobId}` });
});

// Worker
async function exportWorker(job: Job) {
  await jobQueue.updateProgress(job.id, 10);
  const data = await db.query(job.payload.query);

  await jobQueue.updateProgress(job.id, 50);
  const csv = await generateCsv(data);

  await jobQueue.updateProgress(job.id, 80);
  const url = await uploadToS3(csv);

  await jobQueue.complete(job.id, { downloadUrl: url });
}
```

### 2. Batch Processing

```typescript
async function batchWorker(job: Job<BatchPayload>) {
  const items = job.payload.items;
  const total = items.length;

  for (let i = 0; i < total; i++) {
    await processItem(items[i]);
    await jobQueue.updateProgress(job.id, Math.round((i + 1) / total * 100));
  }

  await jobQueue.complete(job.id, { processed: total });
}
```

### 3. With WebSocket (Real-time)

```typescript
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
function useJobWebSocket(jobId: JobId) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(`/ws/jobs/${jobId}`);
    ws.onmessage = (e) => setStatus(JSON.parse(e.data));
    return () => ws.close();
  }, [jobId]);

  return status;
}
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Return 200 with jobId | Implies sync success | Use 202 Accepted |
| Block until complete | Gateway timeout | Return immediately |
| Poll every 100ms | Server overload | Poll every 2-5s |
| No progress updates | Bad UX | Update during execution |
| No status endpoint | Can't track progress | Add GET /jobs/:id |
| No timeout | Jobs run forever | Set max execution time |

## Anti-Patterns

```typescript
// ❌ 1. Blocking request
const result = await longOperation();  // 5 min!
res.json(result);

// ❌ 2. No progress
async function worker(job) {
  await doEverything();  // 5 min of 0%
  await complete(job.id, result);
}

// ❌ 3. Polling too fast
setInterval(() => fetch('/status'), 100);

// ❌ 4. Missing statusUrl
res.status(202).json({ jobId });  // Where to poll?

// ❌ 5. No error details
await jobQueue.fail(jobId, 'Error');  // What error?
```

## Template Reference

Copy from: `.prot/pillar-o/async.ts`

Key exports:
- `JobId` - Branded type
- `Job` - Job interface
- `JobQueue` - Queue interface
- `AsyncJobResponse` - 202 response
- `JobStatusResponse` - Status response
- `InMemoryJobQueue` - Dev implementation
- `useAsyncJob()` - React polling hook
