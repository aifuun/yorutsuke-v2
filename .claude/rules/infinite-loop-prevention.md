# Infinite Loop Prevention

> Checklist to prevent "Maximum update depth exceeded" errors in React + Zustand.

**Bug Reference**: Issue #86 - Caused app crash on startup

## Pre-Code Checklist

Before writing any Zustand selector or service initialization:

### Zustand Selectors

- [ ] **No object selectors** - Never `(s) => ({ a: s.a, b: s.b })`
- [ ] **Primitives only** - `(s) => s.status` returns `string`, not object
- [ ] **useShallow if needed** - Import from `zustand/react/shallow`
- [ ] **Vanilla store?** - Consider manual subscription pattern

### Service Initialization

- [ ] **Services init in main.tsx** - Not in React components (ADR-001)
- [ ] **No init in useEffect** - Especially with dependencies that change
- [ ] **Subscriptions separate from init** - Init once, subscribe per component

### useEffect Dependencies

- [ ] **Stable references** - Functions wrapped in `useCallback`
- [ ] **No object deps** - Objects change reference every render
- [ ] **Minimal deps** - Only what's actually needed

## Common Infinite Loop Causes

### 1. Object Selector (Most Common)

```typescript
// ❌ INFINITE LOOP
const data = useStore(store, (s) => ({
  isOnline: s.isOnline,
  count: s.count,
}));

// ✅ FIX: Individual selectors
const isOnline = useStore(store, (s) => s.isOnline);
const count = useStore(store, (s) => s.count);
```

### 2. Service Init in useEffect with Deps

```typescript
// ❌ INFINITE LOOP - Re-inits on every userId change
useEffect(() => {
  service.initialize();
  return () => service.cleanup();
}, [userId]);

// ✅ FIX: Init in main.tsx, subscribe in component
// main.tsx
service.initialize();

// Component
useEffect(() => {
  if (!userId) return;
  const unsub = service.subscribe(handler);
  return unsub;
}, [userId]);
```

### 3. Computed Values in Render

```typescript
// ❌ RISK - getQuotaStatus() may return new object
const quota = store.getState().getQuotaStatus();

// ✅ FIX: Memoize or use selector
const quota = useMemo(() => store.getState().getQuotaStatus(), [deps]);
```

### 4. Unstable Callback in useEffect

```typescript
// ❌ INFINITE LOOP - buildOptions changes every render
useEffect(() => {
  load(buildOptions());
}, [load, buildOptions]);

// ✅ FIX: Use ref or memoize
const buildOptionsRef = useRef(buildOptions);
buildOptionsRef.current = buildOptions;

useEffect(() => {
  load(buildOptionsRef.current());
}, [load]);
```

## Debug Steps

If you see "Maximum update depth exceeded":

1. **Check console** - Look for rapid repeated logs
2. **Find the component** - Error stack shows which component
3. **Check selectors** - Look for object/array returns
4. **Check useEffect deps** - Look for unstable references
5. **Check service init** - Is it in React lifecycle?

## Quick Fixes

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Crash on mount | Object selector | Use primitive selectors |
| Crash on state change | Selector creates new ref | Use `useShallow` |
| Crash on navigation | Service re-init | Move to main.tsx |
| Crash after action | useEffect loop | Check dependencies |

## Related

- **Rule**: `zustand-hooks.md` - Selector patterns
- **Rule**: `stores.md` - Vanilla store pattern
- **ADR-001**: Service Pattern
- **ADR-012**: Zustand Selector Safety
