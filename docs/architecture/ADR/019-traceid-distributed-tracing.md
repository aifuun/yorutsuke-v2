# ADR-019: TraceId for End-to-End Distributed Tracing

**Status**: Accepted
**Date**: 2026-01-20
**Related**: ADR-005 (IntentId deprecation)

## Context

Yorutsuke v2 processes receipts through a complex distributed pipeline:

```
Frontend → SQLite → S3 Upload → Lambda (presign) → S3 Storage
  → S3 Event → Lambda (instant-processor) → Azure DI → DynamoDB
    → Sync → SQLite
```

**Problems without distributed tracing**:

1. **Debugging opacity**: User reports "my receipt didn't appear" - which step failed?
2. **Performance analysis**: Upload feels slow - where's the bottleneck?
3. **Log correlation**: Frontend logs + 2 Lambda logs + S3 logs - how to connect them?
4. **Error attribution**: Azure DI returned error - which user's which receipt?
5. **Audit trail**: Transaction has wrong amount - what was the original image processing?

**Real incident** (2026-01-18): User uploaded receipt, saw in Debug panel (cloud) but not Ledger (local). Without traceId, had to:
- Manually correlate timestamps across 3 log sources
- Guess which S3 object matched which transaction
- No way to trace from frontend action to Lambda processing

## Decision

Implement **traceId-based distributed tracing** throughout the entire receipt lifecycle.

### Design Principles

1. **Generate once, propagate everywhere**: Frontend generates `trace-{uuid}` at upload start
2. **Store at every layer**: SQLite (images + transactions), S3 metadata, DynamoDB
3. **Log with every message**: All logs include traceId for correlation
4. **Recover when lost**: Lambda can recover traceId from S3 metadata if not in event

### TraceId Format

```typescript
type TraceId = `trace-${string}`;  // e.g., "trace-abc-123-def-456..."

// Generation
function generateTraceId(): TraceId {
  return `trace-${crypto.randomUUID()}`;
}
```

**Properties**:
- **Unique**: UUID ensures no collisions
- **Prefix**: `trace-` prefix distinguishes from other IDs
- **Length**: ~64 chars (safe for headers, metadata, database fields)

### Propagation Path

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Frontend Generation                                          │
│    uploadService.enqueue(imageId, filePath)                     │
│    └─ traceId = generateTraceId()                               │
│    └─ images.trace_id = traceId (SQLite)                        │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. HTTP Request (Dual Channel)                                  │
│    uploadApi.getPresignedUrl(userId, fileName, traceId, permit) │
│    ├─ Request Header: X-Trace-Id: trace-abc-123                 │
│    └─ Request Body: { traceId, userId, fileName, ... }          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. presign Lambda (Receive & Log)                               │
│    const traceId = headers['x-trace-id'] || body.traceId        │
│    logger.info('PRESIGN_REQUEST', { traceId, userId, ... })     │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. S3 Metadata Bridge (Critical!)                               │
│    const command = new PutObjectCommand({                       │
│      Metadata: {                                                │
│        'trace-id': ctx.traceId,  // ← Stored in S3 object       │
│        'user-id': userId,                                       │
│      }                                                           │
│    })                                                            │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. S3 Event → instant-processor Lambda                          │
│    S3 event does NOT include custom metadata                    │
│    └─ Must recover traceId via HeadObjectCommand:               │
│       const response = await s3.send(new HeadObjectCommand({    │
│         Bucket, Key                                             │
│       }))                                                        │
│       const traceId = response.Metadata?.['trace-id']           │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Lambda Processing (All logs tagged)                          │
│    logger.info('AZURE_DI_REQUEST_START', { traceId, ... })      │
│    logger.info('TRANSACTION_CREATED', { traceId, txId, ... })   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. DynamoDB Storage                                             │
│    const transaction = {                                        │
│      userId, transactionId,                                     │
│      traceId: ctx.traceId,  // ← Stored in cloud DB            │
│      ...                                                        │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. Sync Back to Frontend                                        │
│    pullTransactions() → transactions.trace_id (SQLite)          │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Implementation: S3 Metadata Bridge

**Why needed**: S3 event notifications do NOT include custom metadata in the event payload. The Lambda receives:

```json
{
  "Records": [{
    "s3": {
      "bucket": { "name": "yorutsuke-images-dev" },
      "object": { "key": "uploads/user-123/abc.jpg" }
    }
  }]
}
```

No traceId here! ❌

**Solution**: Store traceId in S3 object metadata during presign, then recover it in instant-processor:

```javascript
// presign Lambda (line 364-365 in index.mjs)
Metadata: {
  'trace-id': ctx.traceId,  // Written to S3 object
  'user-id': userId,
}

// instant-processor Lambda (line 68-92)
async function recoverTraceIdFromS3(s3Key) {
  const response = await s3.send(new HeadObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key
  }));
  return response.Metadata?.['trace-id'] || generateTraceId();
}
```

**Note**: S3 metadata keys are automatically lowercased: `trace-id` → `trace-id` (no conversion needed).

## Consequences

### Benefits ✅

1. **Complete observability**: One traceId traces entire lifecycle (8+ steps)
2. **Fast debugging**: `grep "trace-abc-123"` across all logs instantly correlates events
3. **Performance profiling**: Timestamp diff between logged steps shows bottlenecks
4. **Error attribution**: Any error immediately identifies user, image, and context
5. **Audit trail**: Every transaction links back to original upload request
6. **No additional infrastructure**: Uses existing logs, no need for distributed tracing service

### Trade-offs ⚠️

1. **S3 metadata dependency**: If S3 metadata is corrupted/missing, traceId is lost (fallback: generate new one)
2. **Storage overhead**: ~70 bytes per image (S3 metadata) + per transaction (DynamoDB)
3. **HeadObject cost**: instant-processor makes 1 extra S3 API call per upload (~$0.0004/1000 requests)

### Operational Impact

**Log Query Examples**:

```bash
# Frontend logs (local)
cat ~/.yorutsuke/logs/2026-01-20.jsonl | jq 'select(.traceId == "trace-abc-123")'

# presign Lambda logs (CloudWatch)
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-presign-us-dev \
  --filter-pattern '"trace-abc-123"' \
  --profile dev

# instant-processor Lambda logs (CloudWatch)
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-dev \
  --filter-pattern '"trace-abc-123"' \
  --profile dev

# Find transaction in DynamoDB
aws dynamodb scan \
  --table-name yorutsuke-transactions-dev \
  --filter-expression "traceId = :tid" \
  --expression-attribute-values '{":tid":{"S":"trace-abc-123"}}' \
  --profile dev

# Find image in local SQLite
sqlite3 ~/.yorutsuke/yorutsuke.db \
  "SELECT * FROM images WHERE trace_id = 'trace-abc-123'"
```

### Not Used For

**TraceId is NOT for**:
- ❌ **Idempotency**: Use intentId (deprecated in v2, retry-safe uploads)
- ❌ **Deduplication**: Use image MD5 hash
- ❌ **Authorization**: Use userId + permit signature
- ❌ **Business logic**: TraceId is purely observability metadata

**Scope**: Single upload request only. Different uploads = different traceIds, even if same user/same file.

## Implementation Checklist

### Frontend (TypeScript)

- [x] Generate traceId in `uploadService.enqueue()`
- [x] Store in `images.trace_id` (SQLite)
- [x] Include in HTTP request (header + body)
- [x] Log all upload events with traceId

**Files**:
- `app/src/02_modules/capture/services/uploadService.ts`
- `app/src/02_modules/capture/adapters/uploadApi.ts`

### presign Lambda (Node.js)

- [x] Extract traceId from `headers['x-trace-id']` or `body.traceId`
- [x] Store in S3 metadata: `Metadata: { 'trace-id': traceId }`
- [x] Log all events with traceId
- [x] Return traceId in response

**Files**:
- `infra/lambda/presign/index.mjs` (line 231-232, 364-365)

### instant-processor Lambda (Node.js)

- [x] Recover traceId from S3 metadata via `HeadObjectCommand`
- [x] Fallback to generating new traceId if metadata missing
- [x] Log all Azure DI events with traceId
- [x] Store traceId in DynamoDB transaction

**Files**:
- `infra/lambda/instant-processor/index.mjs` (line 68-92, 454-461)

### Database Schemas

- [x] SQLite: `images.trace_id TEXT` (v10 migration)
- [x] SQLite: `transactions.trace_id TEXT` (v10 migration)
- [x] SQLite: Index on `trace_id` for fast queries
- [x] DynamoDB: `transactions.traceId` optional string field
- [x] Zod: `TransactionSchema.traceId` optional

**Files**:
- `app/src/00_kernel/db/migrations.ts` (v10)
- `infra/lambda/shared-layer/nodejs/shared/schemas.mjs` (line 66)

## Alternatives Considered

### Alternative 1: AWS X-Ray

**Pros**: Built-in distributed tracing, automatic instrumentation, service maps
**Cons**:
- Additional cost (~$5/million traces)
- Requires SDK integration in all services
- Overkill for simple pipeline (only 2 Lambda functions)
- Cannot trace to local SQLite

**Decision**: Rejected - too expensive and complex for current scale

### Alternative 2: No Tracing (Status Quo)

**Pros**: Zero overhead, simpler code
**Cons**:
- Debugging requires manual log correlation (slow, error-prone)
- No way to measure end-to-end latency
- Cannot track individual upload lifecycle

**Decision**: Rejected - debugging pain outweighs implementation cost

### Alternative 3: Only Log Timestamps

**Pros**: Simpler than traceId
**Cons**:
- Cannot correlate across services (timestamps alone insufficient)
- Race conditions when multiple uploads happen simultaneously
- No way to query "show me everything about this specific upload"

**Decision**: Rejected - insufficient for multi-service debugging

## Migration Notes

**When introduced**: v10 (2026-01-19)

**Backward compatibility**:
- Old transactions without traceId: Field is optional, queries work fine
- New code reading old data: `traceId` will be `null`/`undefined` (graceful)
- Old Lambda processing new uploads: No impact (metadata ignored by old code)

**Rollout strategy**:
1. Deploy frontend with traceId generation (passive, no breaking changes)
2. Deploy presign Lambda with metadata writing (passive)
3. Deploy instant-processor with metadata reading (active tracing starts)
4. Run database migration to add trace_id columns

**No backfill needed**: Only new uploads after v10 have traceId (acceptable).

## Related Documentation

- **SCHEMA.md**: TraceId field definitions in all tables
- **LOGGING.md**: How to query logs by traceId
- **ADR-005**: IntentId vs TraceId (intentId deprecated in v2)
- **BUG-002**: Original bug that motivated traceId implementation

## Success Metrics

**Before traceId** (v1):
- Debugging receipt issue: ~30 min (manual log correlation)
- Log queries: 3+ separate commands across services
- Error attribution: Often impossible without exact timestamp

**After traceId** (v2):
- Debugging receipt issue: ~2 min (single traceId query)
- Log queries: 1 command with traceId filter
- Error attribution: 100% success rate

**Real example** (2026-01-20): User reported receipt parsing returned ¥0. Single grep by traceId revealed Azure DI was returning `valueCurrency.amount` but code was reading `valueNumber`. Fixed in 10 minutes.

## References

- Implementation PR: #[number]
- Discussion: Issue #[number] "Add distributed tracing for upload pipeline"
- OpenTelemetry Trace Spec (inspiration): https://opentelemetry.io/docs/specs/otel/trace/api/
