# ADR-005: TraceId vs IntentId

**Status**: Accepted
**Date**: 2026-01

## Context

Two different identifiers are needed for different purposes:
1. **Observability**: Track a single receipt through its lifecycle
2. **Idempotency**: Prevent duplicate operations on retry

Conflating these leads to incorrect behavior.

## Decision

### TraceId (Pillar N: Observability)

**Purpose**: Correlate logs across a single receipt's lifecycle

```typescript
type TraceId = string & { __brand: 'TraceId' };

// Generated once at drop time
const traceId = `trace-${nanoid()}` as TraceId;
```

**Scope**: Single receipt from drop → upload → confirm

**Lifecycle**:
```
Drop → traceId assigned
  ↓
Compress → logs include traceId
  ↓
Duplicate Check → logs include traceId
  ↓
Upload → logs include traceId
  ↓
Confirm → logs include traceId
```

### IntentId (Pillar Q: Idempotency)

**Purpose**: Prevent duplicate operations when retrying

```typescript
type IntentId = string & { __brand: 'IntentId' };

// Generated once per user action
const intentId = `intent-${nanoid()}` as IntentId;
```

**Scope**: Single user action (may span multiple retries)

**Usage**:
```typescript
// Server-side idempotency check
const cached = await Cache.get(`intent:${intentId}`);
if (cached) return cached; // Duplicate request, return cached result
```

### Key Distinction

| Aspect | TraceId | IntentId |
|--------|---------|----------|
| Purpose | Log correlation | Duplicate prevention |
| Scope | Single request | Action + retries |
| Cardinality | 1 per receipt | 1 per user action |
| Sharing | Never shared | Same across retries |
| Pillar | N (Observability) | Q (Idempotency) |

### Example

```
User drops image → traceId=T1, intentId=I1
  ↓
Upload fails (network) → traceId=T1 in logs
  ↓
Auto-retry #1 → traceId=T1, intentId=I1 (same intent!)
  ↓
Auto-retry #2 → traceId=T1, intentId=I1 (same intent!)
  ↓
Success → Server checks intentId, prevents duplicate DB write
```

## Consequences

### Positive
- Clear separation of concerns
- Logs are traceable end-to-end
- Retries don't create duplicate data
- Both types are branded (type-safe)

### Negative
- Two IDs to manage per operation
- Must understand when to generate each
- IntentId requires server-side cache

### Implementation Files

- `00_kernel/types/branded.ts`: Type definitions
- `00_kernel/eventBus/types.ts`: Events include traceId
- `02_modules/capture/adapters/uploadApi.ts`: IntentId in requests

## Related

- [PATTERNS.md](../PATTERNS.md) - Branded types
- `.prot/CHEATSHEET.md` - traceId vs intentId reference
