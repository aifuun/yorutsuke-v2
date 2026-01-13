# ADR-012: Zustand Selector Safety

**Status**: Accepted
**Date**: 2026-01-12
**Context**: Issue #86 introduced infinite loop bug causing app crash

## Problem

After merging Issue #86 (Cloud Sync Service), the app crashed on startup with:

```
Error: Maximum update depth exceeded. This can happen when a component
repeatedly calls setState inside componentWillUpdate or componentDidUpdate.
```

**Root Cause**: `SyncStatusIndicator` component used an object selector:

```typescript
// ❌ This caused infinite loop
const { isOnline, pendingCount, lastSyncedAt, status } = useSyncStore((state) => ({
  isOnline: state.isOnline,
  pendingCount: state.pendingCount,
  lastSyncedAt: state.lastSyncedAt,
  status: state.status,
}));
```

**Why it loops**:
1. Store updates → selector runs → returns NEW object reference
2. Zustand uses `===` comparison → new object ≠ old object
3. React thinks props changed → component re-renders
4. Re-render triggers selector → new object → re-render → infinite loop

**Secondary Issue**: `networkMonitor.initialize()` was called in `useEffect` with `[userId]` dependency, causing re-initialization on every userId change.

## Decision

### 1. Mandate Primitive Selectors or Manual Subscription

For vanilla stores (created with `createStore` from `zustand/vanilla`):

```typescript
// ✅ APPROVED: Individual primitive selectors
const isOnline = useSyncStore((s) => s.isOnline);
const pendingCount = useSyncStore((s) => s.pendingCount);

// ✅ APPROVED: Manual subscription (safest)
const [data, setData] = useState(() => store.getState());
useEffect(() => store.subscribe(setData), []);

// ✅ APPROVED: useShallow for object selectors
import { useShallow } from 'zustand/react/shallow';
const data = useStore(store, useShallow((s) => ({ a: s.a, b: s.b })));
```

### 2. Service Initialization in main.tsx Only

Per ADR-001, services must initialize at app startup, not in React lifecycle:

```typescript
// main.tsx
import { networkMonitor } from './02_modules/sync';

// Initialize services once at startup
networkMonitor.initialize();
```

React components may subscribe to services but never initialize them:

```typescript
// Component - subscription only, no init
useEffect(() => {
  if (!userId) return;
  const unsubscribe = networkMonitor.subscribe(handler);
  return unsubscribe;
}, [userId]);
```

### 3. Code Review Checklist

All PRs touching Zustand selectors must verify:

- [ ] No object literal in selector `(s) => ({ ... })`
- [ ] No array spread in selector `(s) => [...s.items]`
- [ ] No computed method calls that return new objects
- [ ] Service init in main.tsx, not useEffect

## Implementation

**Files modified to fix Issue #86**:

| File | Change |
|------|--------|
| `SyncStatusIndicator.tsx` | Changed to manual subscription pattern |
| `App.tsx` | Removed `networkMonitor.initialize()` from useEffect |
| `main.tsx` | Added `networkMonitor.initialize()` at startup |
| `syncStore.ts` | Cleaned up debug logging |

**SyncStatusIndicator fix**:

```typescript
// Before (BROKEN)
const { isOnline, pendingCount } = useSyncStore((state) => ({
  isOnline: state.isOnline,
  pendingCount: state.pendingCount,
}));

// After (FIXED)
const [syncData, setSyncData] = useState(() => selectSyncData(syncStore.getState()));
useEffect(() => {
  const unsubscribe = syncStore.subscribe((state) => {
    setSyncData(selectSyncData(state));
  });
  return unsubscribe;
}, []);
```

## Consequences

### Positive

- ✅ Prevents infinite loop bugs at the pattern level
- ✅ Clear guidelines for Zustand usage
- ✅ Aligns with ADR-001 Service Pattern
- ✅ Manual subscription is most predictable for vanilla stores

### Negative

- ⚠️ More verbose code for multi-value subscriptions
- ⚠️ Developers must learn multiple patterns
- ⚠️ `useShallow` adds bundle size (small)

### Trade-offs

| Pattern | Pros | Cons |
|---------|------|------|
| Individual selectors | Simple, safe | Multiple hook calls |
| Manual subscription | Safest, full control | More boilerplate |
| useShallow | Concise | Extra import, less explicit |

## Alternatives Considered

### A. Always use `useShallow`

**Rejected**: Adds dependency, hides the underlying issue, may have edge cases.

### B. Create custom `useSafeStore` wrapper

**Rejected**: Over-engineering, Zustand already provides `useShallow`.

### C. Lint rule to catch object selectors

**Considered for future**: Would require custom ESLint rule.

## References

- **Issue**: #86 (Cloud Sync Service)
- **Related ADRs**: ADR-001 (Service Pattern)
- **Rules**: `.claude/rules/zustand-hooks.md`, `.claude/rules/infinite-loop-prevention.md`
- **Zustand docs**: https://docs.pmnd.rs/zustand/guides/prevent-rerenders-with-use-shallow

## Test Coverage

To prevent regression:

- **Unit test**: SyncStatusIndicator renders without loop
- **Integration test**: App starts without "Maximum update depth" error
- **Manual test**: Navigate to Ledger view, verify no console errors

---

**Approved by**: Bug fix for Issue #86
**Implementation**: 2026-01-12
**Next Review**: When upgrading Zustand or adding new stores
