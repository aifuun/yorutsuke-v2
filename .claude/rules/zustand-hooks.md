---
paths: "**/hooks/use*.ts"
---
# Zustand Hook Rules

> React bridges to Zustand vanilla stores. Selectors must be stable.

## Critical: Selector Stability

Zustand uses `===` for equality. Selectors that return new objects cause infinite re-renders.

### Anti-Pattern (Infinite Loop)

```typescript
// ❌ WRONG - getQuotaStatus() returns new object every render
export function useQuotaStatus() {
  return useStore(store, (state) => state.getComputed()); // Creates new object!
}

// ❌ WRONG - Object literal in selector
export function useDerivedState() {
  return useStore(store, (state) => ({
    isLoading: state.status === 'loading',
    error: state.error,
  })); // New object every time!
}
```

### Correct Patterns

```typescript
// ✅ Pattern 1: Subscribe to full state, compute inline
export function useQuota() {
  const state = useStore(store);
  return {
    quota: state.getQuotaStatus(),
    isLoading: state.status === 'loading',
  };
}

// ✅ Pattern 2: Multiple simple selectors (primitives/existing refs)
export function useUploadStats() {
  const tasks = useStore(store, (s) => s.tasks);     // Existing array ref
  const status = useStore(store, (s) => s.status);   // Primitive string

  // Compute in component, not in selector
  const pending = tasks.filter(t => t.status === 'pending').length;
  return { pending, isProcessing: status === 'processing' };
}

// ✅ Pattern 3: useShallow for object selectors
import { useShallow } from 'zustand/react/shallow';

export function useQuotaStatus() {
  return useStore(store, useShallow((s) => s.getQuotaStatus()));
}
```

## Quick Check

- [ ] Selector returns primitive or existing reference? → Safe
- [ ] Selector returns new object/array? → Use `useShallow` or Pattern 1/2
- [ ] Store has `getComputed()` method? → Call it outside selector

## File Naming

- `use{Feature}State.ts` - Bridge to `{feature}Store`
- Export: `use{Feature}State()`, `use{Feature}Status()`, `use{Feature}Stats()`
