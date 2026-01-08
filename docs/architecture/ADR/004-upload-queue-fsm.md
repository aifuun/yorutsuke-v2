# ADR-004: Upload Queue FSM

**Status**: Accepted
**Date**: 2025-12

## Context

The upload queue processes multiple images sequentially. Need to handle:
- Network failures with retry
- Quota limits
- App pause/resume
- Concurrent processing prevention

Boolean flags (`isLoading`, `hasError`) led to inconsistent states.

## Decision

### State Machine

```typescript
type QueueStatus = 'idle' | 'processing' | 'paused';
```

```
        ┌──────────────────────────────────────┐
        │                                      │
        ▼                                      │
     ┌──────┐    START     ┌────────────┐      │
     │ idle │ ───────────► │ processing │ ─────┘
     └──────┘              └────────────┘   SUCCESS/
        ▲                        │          FAILURE
        │                        │ PAUSE      (to idle)
        │                        ▼
        │                  ┌────────┐
        └───── RESUME ──── │ paused │
                           └────────┘
```

### Error Classification

| Error Type | Action | Retry |
|------------|--------|-------|
| `network` | Auto-retry with backoff | Yes (1s, 2s, 4s) |
| `server` | Auto-retry with backoff | Yes (1s, 2s, 4s) |
| `quota` | Pause queue | No |
| `unknown` | Pause queue | No |

### Retry Logic

```typescript
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
const MAX_RETRIES = 3;
```

### Race Condition Prevention

Problem: `useEffect` can trigger multiple times before state updates.

Solution: Track in-flight tasks in a `Set`, not in state:

```typescript
const processingRef = useRef<Set<string>>(new Set());

// Before processing
if (processingRef.current.has(imageId)) return;
processingRef.current.add(imageId);

// After complete (including retry delay)
processingRef.current.delete(imageId);
```

## Consequences

### Positive
- Clear state transitions, no invalid states
- Automatic retry for transient failures
- Graceful degradation on quota/unknown errors

### Negative
- More complex than boolean flags
- Need to handle PAUSED state in reducers
- Retry cleanup timing is critical

### Key Insight

Only remove from `processingRef` AFTER backoff delay completes, not immediately on failure. Otherwise, rapid retries can still cause duplicates.

## Related

- [PATTERNS.md](../PATTERNS.md) - FSM patterns
- [STORES.md](../STORES.md) - uploadStore definition
- Issue #6 - Original implementation
