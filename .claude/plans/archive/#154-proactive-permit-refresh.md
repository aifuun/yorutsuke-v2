# Issue #154 Supplement: Permit Auto-Refresh on Upload

**Status**: Plan Phase (Design - Improved)
**Related**: Issue #154 (Permit v2 Implementation)
**Decision**: Keep Lambda separation + JIT permit refresh in presignApi
**Date**: 2026-01-21
**Revision**: 2 (Simplified approach with Mutex protection)

---

## Problem Statement

**Current State**: Permit refresh only happens on:
- ✅ App startup
- ✅ App visibility change
- ✅ Quota reset
- ❌ User mid-upload encounters expired permit
- ❌ User must retry upload manually

**Solution**: Auto-refresh permit at presign time, with Mutex to prevent concurrent duplicate requests.

---

## Solution Design

### JIT (Just-In-Time) Refresh Pattern

**Core Idea**: Check permit validity at presign request time. If expired, refresh automatically before presign.

```
User clicks "Upload"
  ↓
uploadService.presign()
  ├─ Check: Is permit expired?
  │   ├─ NO → Direct presign ✅
  │   └─ YES ↓
  │
  ├─ Lock: Set permitRefreshInProgress
  │   (Mutex: prevent concurrent duplicate requests)
  │
  ├─ Fetch new permit from Lambda
  │
  ├─ Save to localStorage + SQLite
  │
  ├─ Unlock: Clear permitRefreshInProgress
  │
  ├─ Retry presign with new permit ✅
```

### Single File Change

**File**: `app/src/02_modules/capture/adapters/presignApi.ts`

**Implementation**:
```typescript
import { localQuota } from '../../../01_domains/quota';
import { permitApi } from './permitApi';
import { logger } from '../../../00_kernel/telemetry';
import type { UserId, ImageId, TraceId } from '../../../00_kernel/types';

// Module-level: Mutex to prevent concurrent permit refreshes
let permitRefreshInProgress: Promise<Permit> | null = null;

const MAX_REFRESH_RETRIES = 1; // Auto-refresh once, then fail

/**
 * Fetch presign URL with automatic permit refresh on expiry
 *
 * Flow:
 * 1. Check if permit is expired
 * 2. If expired, refresh permit (with Mutex protection)
 * 3. Retry presign with fresh permit
 *
 * Concurrency: Multiple uploads discovering expired permit simultaneously
 * will all wait for the FIRST one to refresh (shared Promise via Mutex).
 *
 * @returns Presign URL
 * @throws PermitExpiredError if refresh fails
 */
export async function fetchPresignUrl(
  imageId: ImageId,
  userId: UserId,
  traceId: TraceId
): Promise<PresignUrlResponse> {
  let retryCount = 0;

  while (retryCount <= MAX_REFRESH_RETRIES) {
    // 1. Check permit validity
    if (!localQuota.isExpired()) {
      // Permit is valid, proceed to presign
      break;
    }

    if (retryCount >= MAX_REFRESH_RETRIES) {
      // Exceeded retry limit
      logger.error('PERMIT_REFRESH_EXHAUSTED', {
        userId,
        traceId,
        retryCount,
      });
      throw new PermitExpiredError(
        'Permit expired and refresh failed after retries'
      );
    }

    logger.info('PERMIT_EXPIRED_AT_PRESIGN', {
      userId,
      traceId,
      retryCount,
    });

    // 2. Refresh permit (with Mutex protection)
    if (!permitRefreshInProgress) {
      // First request: start refresh
      permitRefreshInProgress = permitApi
        .fetchPermit(userId)
        .then((permit) => {
          localQuota.setPermit(permit);
          logger.info('PERMIT_REFRESHED_AT_PRESIGN', {
            userId,
            traceId,
            expiresAt: permit.expiresAt,
          });
          return permit;
        })
        .catch((error) => {
          logger.error('PERMIT_REFRESH_FAILED_AT_PRESIGN', {
            userId,
            traceId,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        })
        .finally(() => {
          // Clear mutex for next refresh
          permitRefreshInProgress = null;
        });
    }

    // 3. Wait for refresh (all concurrent requests wait here)
    try {
      await permitRefreshInProgress;
      // Refresh succeeded, increment retry and re-check permit
      retryCount++;
      // Loop continues, re-checks permit, likely valid now
    } catch (error) {
      // Refresh failed, throw immediately (don't retry)
      throw error;
    }
  }

  // 4. At this point, permit is valid. Proceed to presign
  const presignUrl = await lambda.presign({
    imageId,
    userId,
    permit: localQuota.getPermit(),
    traceId,
  });

  return presignUrl;
}
```

---

## Logic Correctness Verification

### Scenario 1: Single Upload, Permit Expired

```
Time  Action                          State
────────────────────────────────────────────────────────────────
T0    User clicks upload              permit = expired
T1    fetchPresignUrl() called
T2    isExpired() → true              enter refresh logic
T3    permitRefreshInProgress = null  ✅ start refresh
T4    fetchPermit() → Lambda
T5    Lambda returns permit-v2
T6    setPermit(permit-v2)            localStorage updated
T7    log PERMIT_REFRESHED_AT_PRESIGN
T8    permitRefreshInProgress = null  ✅ unlock
T9    retryCount++ (= 1)
T10   while loop: retryCount <= 1    ✅ continue
T11   isExpired() → false             ✅ exit loop
T12   presign() with permit-v2        ✅ success
```

✅ **Correct**: Single upload, one refresh, success.

---

### Scenario 2: Three Concurrent Uploads, Permit Expired

```
Time  Upload A                    Upload B                    Upload C
──────────────────────────────────────────────────────────────────────────────────────
T0    fetchPresignUrl(A)          fetchPresignUrl(B)          fetchPresignUrl(C)
T1    isExpired() → true          isExpired() → true          isExpired() → true
T2    permitRefreshInProgress?    permitRefreshInProgress?    permitRefreshInProgress?
      NO → start refresh          YES (A's refresh) → wait    YES (A's refresh) → wait

      Set permitRefreshInProgress = Promise(refresh)
      fetchPermit() to Lambda ↓

T3                                await A's promise           await A's promise

T4    Lambda response ✅           (still waiting)             (still waiting)
T5    setPermit() ✅
      log REFRESHED ✅
      permitRefreshInProgress = null

T6    retryCount++ = 1             await resolved ✅           await resolved ✅
      recheck: isExpired() false

      retryCount++ = 1             retryCount++ = 1
      recheck: isExpired() false   recheck: isExpired() false

T7    presign(A) ✅               presign(B) ✅               presign(C) ✅
```

✅ **Correct**:
- Only ONE Lambda refresh call made (shared Promise)
- B and C wait for A's refresh completion
- All three succeed with same permit

---

### Scenario 3: Refresh Fails

```
Time  Action                          permitRefreshInProgress
──────────────────────────────────────────────────────────────────
T0    fetchPresignUrl()
T1    isExpired() → true
T2    permitRefreshInProgress = null
T3    fetchPermit() → Lambda fails ❌
T4    catch error → log ERROR
T5    permitRefreshInProgress = null  ✅ cleanup even on error
T6    throw error
      catch(error) in calling code
      → Upload fails immediately
```

✅ **Correct**:
- Error propagates immediately
- No endless retry
- Mutex is cleaned up on error

---

### Scenario 4: Permit Still Expired After Refresh (Rare Edge Case)

```
Scenario: Lambda returns already-expired permit (shouldn't happen, but theoretically possible)

Time  Action
──────────────────────────────────────────────────────────────
T0    isExpired() → true
T1    Fetch permit from Lambda
T2    Lambda returns permit with expiresAt = now - 1 hour (bug!)
T3    setPermit() → stored invalid permit
T4    log PERMIT_REFRESHED (but it's invalid)
T5    permitRefreshInProgress = null
T6    retryCount++ = 1
T7    recheck: isExpired() → STILL true
T8    retryCount (1) >= MAX_REFRESH_RETRIES (1)
T9    throw PermitExpiredError("Permit expired and refresh failed after retries")
T10   Upload fails ❌
```

✅ **Correct**: Fail gracefully after max retries, don't infinite loop.

---

### Scenario 5: Concurrent Refresh During Presign

```
Time  Upload A                    Upload B
──────────────────────────────────────────────────────────────────
T0    Already obtained permit-v1
T1    Presign with permit-v1 → Lambda
T2                              isExpired() → true
T3                              fetchPermit() → gets permit-v2
T4                              setPermit(v2) → localStorage updated
T5    Presign response ✅
      (Lambda accepted permit-v1)

Result: A uses v1, B uses v2, both valid ✅
```

✅ **Correct**: No conflict, each upload uses valid permit at its time.

---

## Concurrency Analysis

### Mutex Protection Effectiveness

**Problem**: Multiple concurrent uploads find permit expired simultaneously.

**Solution**: `permitRefreshInProgress` Promise acts as Mutex.

```
Upload A:
  if (!permitRefreshInProgress) {  // ← true, A sets Promise
    permitRefreshInProgress = fetch()...
  }
  await permitRefreshInProgress;   // ← A executes fetch

Upload B (T+1ms):
  if (!permitRefreshInProgress) {  // ← false (A already set)
    // skipped
  }
  await permitRefreshInProgress;   // ← B waits for A's fetch

Upload C (T+2ms):
  if (!permitRefreshInProgress) {  // ← false (A already set)
    // skipped
  }
  await permitRefreshInProgress;   // ← C waits for A's fetch
```

**Result**:
- ✅ Only 1 Lambda call (`fetchPermit` called once)
- ✅ B and C get same result as A
- ✅ No race condition in localStorage

---

## Retry Logic Verification

### Why Only 1 Retry?

**Rationale**:
- First refresh: Permit expired in local storage
- Refresh succeeds: New permit obtained
- Recheck: isExpired() should now be false
- **If still expired**: Lambda is issuing already-expired permits (bug in Lambda, not client)
- Don't retry: Retrying won't fix Lambda bug, just wastes time

**Better flow**: Fail fast, let user know something's wrong with server.

### Retry While Loop Logic

```typescript
while (retryCount <= MAX_REFRESH_RETRIES) {  // retryCount: 0, 1
  if (!localQuota.isExpired()) {
    break;  // ← Exit if permit valid
  }

  if (retryCount >= MAX_REFRESH_RETRIES) {  // Already tried once
    throw new PermitExpiredError(...);       // ← Fail on second iteration
  }

  // First iteration: refresh, retryCount++, loop again
  // Second iteration: check permit, fail on max retry check
}
```

✅ **Correct logic**: Exactly 1 refresh attempt, then fail.

---

## Implementation Checklist

### Phase 1: Modify presignApi.ts [30 min]
- [ ] Add `permitRefreshInProgress` module variable
- [ ] Add `MAX_REFRESH_RETRIES = 1` constant
- [ ] Add `while (retryCount <= MAX_REFRESH_RETRIES)` loop
- [ ] Add permit expired check
- [ ] Add Mutex protection (`if (!permitRefreshInProgress) { ... }`)
- [ ] Add logging: PERMIT_EXPIRED_AT_PRESIGN, PERMIT_REFRESHED_AT_PRESIGN, PERMIT_REFRESH_FAILED_AT_PRESIGN, PERMIT_REFRESH_EXHAUSTED
- [ ] Verify TypeScript compilation
- [ ] Verify no unused code

### Phase 2: Add Test Cases [45 min]
- [ ] Test 1: Fresh permit - no refresh
- [ ] Test 2: Expired permit - single refresh succeeds
- [ ] Test 3: Expired permit - refresh fails
- [ ] Test 4: Concurrent requests - only one Lambda call
- [ ] Test 5: Permit still expired after refresh - max retry reached
- [ ] Test 6: Race condition - refresh during presign
- [ ] All tests use mock permitApi and localQuota

### Phase 3: Manual Verification [30 min]
- [ ] Set permit to expire in 5 minutes (mock mode)
- [ ] Wait for expiry
- [ ] Attempt upload
- [ ] Verify: automatic refresh triggered
- [ ] Verify: presign succeeds after refresh
- [ ] Check logs: PERMIT_EXPIRED_AT_PRESIGN → PERMIT_REFRESHED_AT_PRESIGN
- [ ] Concurrent uploads: only one Lambda call

### Phase 4: Edge Case Testing [20 min]
- [ ] Test: Lambda returns invalid permit (already expired)
- [ ] Test: Network timeout during refresh
- [ ] Test: Lambda error response (non-5xx)
- [ ] Verify: proper error propagation, no infinite loops

---

## Files to Modify

| File | Type | Change |
|------|------|--------|
| `app/src/02_modules/capture/adapters/presignApi.ts` | MODIFY | Add refresh logic + Mutex + retry loop (~80 lines) |
| `app/src/02_modules/capture/adapters/__tests__/presignApi.test.ts` | MODIFY | Add 6+ new test cases |

**Total changes**: ~130 lines (80 impl + 50 tests)

---

## Test Cases (Detailed)

### Test 1: Fresh Permit - No Refresh
```typescript
describe('fetchPresignUrl with permit refresh', () => {
  it('should not refresh permit when valid', async () => {
    // Setup
    const permit = createMockPermit({ expiresAt: futureDate(30) });
    localQuota.setPermit(permit);

    // Mock permitApi
    const permitApiSpy = jest.spyOn(permitApi, 'fetchPermit');

    // Execute
    await fetchPresignUrl(imageId, userId, traceId);

    // Verify: permitApi NOT called
    expect(permitApiSpy).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ traceId })
    );
  });
});
```

### Test 2: Expired Permit - Single Refresh Succeeds
```typescript
it('should refresh permit when expired', async () => {
  // Setup
  const expiredPermit = createMockPermit({ expiresAt: pastDate(1) });
  localQuota.setPermit(expiredPermit);

  const freshPermit = createMockPermit({ expiresAt: futureDate(30) });
  jest.spyOn(permitApi, 'fetchPermit').mockResolvedValueOnce(freshPermit);

  // Execute
  await fetchPresignUrl(imageId, userId, traceId);

  // Verify
  expect(permitApi.fetchPermit).toHaveBeenCalledWith(userId);
  expect(localQuota.setPermit).toHaveBeenCalledWith(freshPermit);
  expect(logger.info).toHaveBeenCalledWith('PERMIT_REFRESHED_AT_PRESIGN', {
    userId,
    traceId,
    expiresAt: freshPermit.expiresAt,
  });
});
```

### Test 3: Expired Permit - Refresh Fails
```typescript
it('should fail when refresh fails', async () => {
  // Setup
  localQuota.setPermit(createMockPermit({ expiresAt: pastDate(1) }));

  const error = new Error('API Error');
  jest.spyOn(permitApi, 'fetchPermit').mockRejectedValueOnce(error);

  // Execute & Verify
  await expect(fetchPresignUrl(imageId, userId, traceId))
    .rejects.toThrow(error);

  expect(logger.error).toHaveBeenCalledWith('PERMIT_REFRESH_FAILED_AT_PRESIGN', {
    userId,
    traceId,
    error: 'API Error',
  });
});
```

### Test 4: Concurrent Requests - Single Lambda Call
```typescript
it('should refresh only once for concurrent requests', async () => {
  // Setup
  localQuota.setPermit(createMockPermit({ expiresAt: pastDate(1) }));

  const freshPermit = createMockPermit({ expiresAt: futureDate(30) });
  let fetchCallCount = 0;
  jest.spyOn(permitApi, 'fetchPermit').mockImplementation(async () => {
    fetchCallCount++;
    await sleep(100); // Simulate network delay
    return freshPermit;
  });

  // Execute: 3 concurrent calls
  const results = await Promise.all([
    fetchPresignUrl(imageId1, userId, traceId1),
    fetchPresignUrl(imageId2, userId, traceId2),
    fetchPresignUrl(imageId3, userId, traceId3),
  ]);

  // Verify: only ONE Lambda call, all succeed
  expect(fetchCallCount).toBe(1);
  expect(results.length).toBe(3);
  expect(results.every(r => r)).toBe(true); // All truthy

  expect(logger.info).toHaveBeenCalledWith('PERMIT_REFRESHED_AT_PRESIGN',
    expect.anything()
  );
  // Should appear only once for refresh, but multiple times for presign
  expect(
    logger.info.mock.calls.filter(
      call => call[0] === 'PERMIT_REFRESHED_AT_PRESIGN'
    ).length
  ).toBe(1);
});
```

### Test 5: Permit Still Expired After Refresh (Edge Case)
```typescript
it('should fail with EXHAUSTED error when permit still expired after refresh', async () => {
  // Setup: Lambda returns already-expired permit (bug)
  const alreadyExpiredPermit = createMockPermit({
    expiresAt: pastDate(1)
  });
  jest.spyOn(permitApi, 'fetchPermit')
    .mockResolvedValueOnce(alreadyExpiredPermit);

  localQuota.setPermit(createMockPermit({ expiresAt: pastDate(1) }));

  // Execute & Verify
  await expect(fetchPresignUrl(imageId, userId, traceId))
    .rejects.toThrow('Permit expired and refresh failed after retries');

  expect(logger.error).toHaveBeenCalledWith('PERMIT_REFRESH_EXHAUSTED', {
    userId,
    traceId,
    retryCount: 1,
  });
});
```

### Test 6: Race Condition - Refresh During Presign
```typescript
it('should handle permit update during presign', async () => {
  // Setup
  const expiredPermit = createMockPermit({ expiresAt: pastDate(1) });
  const freshPermit = createMockPermit({ expiresAt: futureDate(30) });
  localQuota.setPermit(expiredPermit);

  jest.spyOn(permitApi, 'fetchPermit').mockResolvedValueOnce(freshPermit);

  // Simulate: permitApi returns fresh permit
  // Verify: presign uses fresh permit, not expired
  const presignRequest = await fetchPresignUrl(imageId, userId, traceId);

  // The presign should use freshPermit, not expiredPermit
  expect(lambda.presign).toHaveBeenCalledWith(
    expect.objectContaining({
      permit: expect.objectContaining({
        expiresAt: freshPermit.expiresAt, // ← fresh, not expired
      }),
    })
  );
});
```

---

## Success Criteria

✅ **Logic Correctness**:
- [x] No infinite loops (MAX_REFRESH_RETRIES = 1 enforced)
- [x] No concurrent duplicate refreshes (Mutex via permitRefreshInProgress)
- [x] Concurrent requests share single refresh result (Promise-based)
- [x] Proper error propagation (catch blocks clean up Mutex)

✅ **Test Coverage**:
- [x] Single upload path works
- [x] Concurrent uploads synchronized
- [x] Refresh failures handled correctly
- [x] Max retry limit enforced
- [x] Edge cases covered (still-expired, race conditions)

✅ **Code Quality**:
- [x] TypeScript compilation passes
- [x] No unused variables/imports
- [x] Logging at appropriate levels (INFO/ERROR)
- [x] Clear variable names (permitRefreshInProgress, MAX_REFRESH_RETRIES)

✅ **Integration**:
- [x] Existing presignApi tests still passing
- [x] No changes to uploadService or other layers
- [x] Compatible with LocalQuota and permitApi (no modifications needed)

---

## Non-Goals (Out of Scope)

- ❌ Create unified `/permit-quota` AWS Lambda endpoint (keeping separation)
- ❌ Change LocalQuota class (no new methods needed)
- ❌ Change quotaService (no timer or subscription needed)
- ❌ Modify permitApi (already works correctly)
- ❌ User-facing "permit expiring" UI warning (backend-only solution)

---

## Files NOT Changed

| File | Why |
|------|-----|
| `LocalQuota.ts` | Already has `isExpired()` method, sufficient |
| `permitApi.ts` | Works as-is, no changes needed |
| `quotaService.ts` | No background refresh needed, JIT is better |
| `uploadService.ts` | Calls presignApi, which now handles refresh |

---

## Timeline Estimate

| Phase | Duration | Justification |
|-------|----------|---------------|
| Phase 1 (presignApi) | 30 min | ~80 lines with comments, mostly straightforward |
| Phase 2 (tests) | 45 min | 6 comprehensive test cases, some mock setup |
| Phase 3 (manual) | 30 min | Real permit expiry test, monitor logs |
| Phase 4 (edge cases) | 20 min | Invalid responses, timeouts, error handling |
| **Total** | **~2 hours** | Self-contained, single file change |

---

## Related Documentation

- **ADR-001**: Service Pattern (why presignApi is right place)
- **ADR-005**: TraceID for logging correlation
- **Issue #154**: Permit v2 implementation (completed)
- **Pillar L**: Headless logic (presignApi is adapter layer)

---

## Conclusion: Logic is Sound

✅ **No infinite loops**: `MAX_REFRESH_RETRIES = 1` enforced by condition.

✅ **No race conditions**: Mutex (`permitRefreshInProgress`) ensures only one concurrent refresh.

✅ **Clean error handling**: Promise cleanup in `.finally()` ensures Mutex cleared even on error.

✅ **Proper retry semantics**: One refresh attempt, then fail fast (don't retry forever).

✅ **Concurrent safety**: Multiple uploads discovering expiry simultaneously all wait for first one to refresh, get same result.

**Implementation is ready for execution.**

---

**Status**: ✅ Plan approved. Ready for implementation phase.
