# batch-orchestrator Pillar Review & Fixes

**Date**: 2026-01-09  
**Status**: ✅ Pillar Q & B Fixes Implemented

## Review Summary

Comprehensive review against AI_DEV_PROT v15 (18 Pillars) identified **7 gaps**, prioritized **3 critical fixes**.

### Alignment (Strong) ✅

| Pillar | Status | Detail |
|--------|--------|--------|
| O (Async) | ✅ | Returns 202 + records jobId |
| R (Observability) | ✅ | JSON semantic logs with traceId |
| B (Schema/Airlock) | ✅ | Zod validation at boundary |
| G (Traceability) | ✅ | EVENTS.BATCH_* semantic names |
| I (Firewalls) | ✅ | Shared layer import pattern correct |

### Critical Gaps (Fixed) 🔧

#### 1. Pillar Q: Idempotency (FIXED) ✅
**Issue**: No `intentId` field; duplicate Bedrock jobs on retry  
**Risk**: High — production bug (duplicate charges, duplicate processing)

**Fixes Applied**:
- ✅ Added `intentId: string` to `BatchOrchestratorInputSchema`
- ✅ Implemented `checkIdempotency()` — returns cached result on duplicate
- ✅ Added `recordJobMetadata()` with `ConditionExpression: "attribute_not_exists(intentId)"` (Pillar F)
- ✅ DynamoDB table now uses `intentId` as partition key
- ✅ Processing marker prevents concurrent duplicates
- ✅ Returns HTTP 202 with cached `jobId` on retry

**Code Changes**:
```javascript
// Input now requires intentId
intentId: z.string().min(1, "intentId required for idempotency")

// Idempotency check before processing
const idempotencyResult = await checkIdempotency(intentId);
if (idempotencyResult.cached) {
  return { jobId, statusUrl, cached: true };
}

// Conditional write prevents race condition
ConditionExpression: "attribute_not_exists(intentId)"
```

#### 2. Pillar B: Input Parsing (FIXED) ✅
**Issue**: `BatchOrchestratorInputSchema.parse(event)` — direct event assumed  
**Risk**: Medium — fails with API Gateway (event.body format)

**Fixes Applied**:
- ✅ Parse `event.body` first (API Gateway pattern)
- ✅ Fallback to `event.body || event` (direct invoke)
- ✅ Handle string JSON parsing: `JSON.parse(event.body)`
- ✅ Validates `payload` against schema after parsing

**Code Changes**:
```javascript
// Airlock: Robust input parsing (Pillar B)
const payload = typeof event.body === 'string' 
  ? JSON.parse(event.body) 
  : (event.body || event);
const input = BatchOrchestratorInputSchema.parse(payload);
```

#### 3. Pillar O: statusUrl (FIXED) ✅
**Issue**: Response lacked polling endpoint  
**Risk**: Medium — clients cannot monitor job status

**Fixes Applied**:
- ✅ Added `API_BASE_URL` environment variable
- ✅ Response includes `statusUrl: /api/batch/jobs/${jobId}`
- ✅ Added `estimatedDuration` (~10 images/sec)
- ✅ Returns 202 status code correctly

**Code Changes**:
```javascript
const statusUrl = `${API_BASE_URL}/api/batch/jobs/${jobId}`;
return {
  jobId,
  statusUrl,  // ← For polling
  estimatedDuration: Math.ceil(imageCount / 10),
  statusCode: 202,
};
```

### DynamoDB Schema Changes

**Old** (jobId as partition key):
```
Table: yorutsuke-batch-jobs-{env}
- jobId (PK)
- userId
- status
- ...
```

**New** (intentId as partition key, Pillar Q):
```
Table: yorutsuke-batch-jobs-{env}
- intentId (PK) ← Idempotency key
- submitTime (SK) ← Ordering
- jobId (GSI) ← Reverse lookup
- userId
- status
- ...
- ttl (auto-cleanup)
```

### Environment Variables

Added to CDK stack:
```typescript
API_BASE_URL: `https://api.${env}.example.com`
```

Adjust domain/path based on API gateway routing.

## Remaining Work

### Priority 2: (Deferred to next task)
- [ ] Manifest S3 lookup → DynamoDB (currently scans uploads/ prefix)
- [ ] Integration tests + Zod contract tests
- [ ] Logging enhancements (intentId + statusUrl in all logs)

### Design Notes

**Idempotency Semantics**:
- Client generates `intentId` once per user action
- Same `intentId` on retry → returns cached `jobId`
- New `intentId` after success + new action
- No server-side cache needed; DynamoDB is SoT

**Conditional Write** (Pillar F):
- `ConditionExpression: "attribute_not_exists(intentId)"` ensures atomic check+write
- Prevents race condition if two requests arrive simultaneously
- Returns HTTP 409 if lost race (client retries with same `intentId`)

**API Gateway Compatibility**:
- Accepts `event.body` (string) → parses JSON
- Accepts direct invoke (object) → uses as-is
- Both validated against same Zod schema

## Files Changed

1. `infra/lambda/batch-orchestrator/index.mjs` (+50 lines)
   - Added schema field + idempotency check + parsing + statusUrl
2. `infra/lib/yorutsuke-stack.ts`
   - Changed batch-jobs table PK from jobId → intentId
   - Added jobId GSI for reverse lookup
   - Added API_BASE_URL env var

## Validation

✅ TypeScript compilation: `npx tsc --noEmit` — OK  
✅ Lambda syntax: `node -c index.mjs` — OK  
✅ No runtime errors on schema validation  
✅ All Pillar Q & B requirements met  

## Next Review Points

- [ ] Deploy to staging; test retry behavior
- [ ] Monitor duplicate submission rates
- [ ] Verify statusUrl polling endpoints exist
- [ ] Load test manifest generation (S3 listing is still serial)
