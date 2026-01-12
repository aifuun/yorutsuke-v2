---
paths: "**/hooks/use*.ts"
---
# Zustand Hook Rules

> React bridges to Zustand vanilla stores. Selectors must be stable.

## CRITICAL: Object Selectors Cause Infinite Loops

**Bug Reference**: Issue #86 - SyncStatusIndicator caused "Maximum update depth exceeded"

Zustand uses `===` for equality. Selectors that return new objects cause infinite re-renders.

### Anti-Pattern (INFINITE LOOP)

```typescript
// ❌ FATAL - Object literal in selector → INFINITE LOOP
const { isOnline, pendingCount } = useSyncStore((state) => ({
  isOnline: state.isOnline,
  pendingCount: state.pendingCount,
}));
// Every render creates NEW object → Zustand thinks state changed → re-render → loop

// ❌ FATAL - getComputed() returns new object
export function useQuotaStatus() {
  return useStore(store, (state) => state.getComputed());
}
```

### Correct Patterns (Choose One)

```typescript
// ✅ Pattern 1: Individual Primitive Selectors (RECOMMENDED)
const isOnline = useSyncStore((s) => s.isOnline);      // boolean
const pendingCount = useSyncStore((s) => s.pendingCount); // number
const status = useSyncStore((s) => s.status);          // string

// ✅ Pattern 2: Manual Subscription (SAFEST for vanilla stores)
const [syncData, setSyncData] = useState(() => syncStore.getState());
useEffect(() => {
  const unsubscribe = syncStore.subscribe((state) => {
    setSyncData(state);
  });
  return unsubscribe;
}, []);

// ✅ Pattern 3: useShallow (if you must use object selector)
import { useShallow } from 'zustand/react/shallow';
const data = useStore(store, useShallow((s) => ({
  isOnline: s.isOnline,
  count: s.pendingCount,
})));

// ✅ Pattern 4: Subscribe to full state, compute inline
export function useQuota() {
  const state = useStore(store);
  return {
    quota: state.getQuotaStatus(),
    isLoading: state.status === 'loading',
  };
}
```

## Selector Safety Checklist

| Returns | Safe? | Action |
|---------|-------|--------|
| Primitive (`string`, `number`, `boolean`) | ✅ | Direct use |
| Existing reference (`state.items`) | ✅ | Direct use |
| New object `{ a: s.a, b: s.b }` | ❌ | Use Pattern 1, 2, or 3 |
| New array `[...s.items]` | ❌ | Use `useShallow` |
| Computed `state.getX()` | ⚠️ | Check if returns new object |

## Quick Decision Tree

```
Is your selector returning a new object/array?
├── NO (primitive or existing ref) → ✅ Safe to use
└── YES (new object/array)
    ├── Vanilla store? → Use Pattern 2 (Manual Subscription)
    ├── Multiple values? → Use Pattern 1 (Individual Selectors)
    └── Must be object? → Use Pattern 3 (useShallow)
```

## Vanilla Store Bridge Pattern

For stores created with `createStore` from `zustand/vanilla`:

```typescript
// Store file
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export const myStore = createStore<MyStore>((set, get) => ({...}));

// React bridge - simple, no equality function
export const useMyStore = <T,>(selector: (state: MyStore) => T): T => {
  return useStore(myStore, selector);
};
```

**Component usage**:
```typescript
// ✅ Individual primitive selectors
const status = useMyStore((s) => s.status);
const count = useMyStore((s) => s.count);

// ❌ NEVER object selector without useShallow
const data = useMyStore((s) => ({ status: s.status, count: s.count }));
```

## File Naming

- `use{Feature}State.ts` - Bridge to `{feature}Store`
- Export: `use{Feature}State()`, `use{Feature}Status()`, `use{Feature}Stats()`

## Related

- **ADR-012**: Zustand Selector Safety
- **Rule**: `infinite-loop-prevention.md`
- **Bug**: Issue #86 (Cloud Sync Service)
