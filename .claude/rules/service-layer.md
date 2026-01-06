---
paths: "**/services/*.ts"
---
# Service Layer Rules

> Services orchestrate IO and state. Order matters.

## Critical: IO-First Pattern

Store updates trigger synchronous subscriptions. Always complete IO before updating stores.

### Anti-Pattern (Race Condition)

```typescript
// ❌ WRONG - Store update triggers subscriptions before DB write completes
store.setState({ status: 'success' });  // Subscriptions run NOW
await db.write(...);  // May conflict with subscription-triggered writes
```

### Correct Pattern

```typescript
// ✅ CORRECT - IO first, then notify
await db.write(...);  // Complete DB operation
store.setState({ status: 'success' });  // Then update UI state
emit('operation:complete', { ... });  // Finally emit events
```

## Execution Order

```
1. Validate inputs
2. Check preconditions (quota, permissions)
3. Execute IO operations (DB write, API call)
4. Update stores (triggers UI refresh)
5. Emit events (triggers other modules)
6. Log completion
```

## Zustand Subscription Warning

Zustand `subscribe()` callbacks run **synchronously** when state changes:

```typescript
store.subscribe((state) => {
  // This runs IMMEDIATELY when setState() is called
  // NOT on the next tick, NOT after the calling function completes
  this.processQueue();  // May start new DB operations!
});
```

## Quick Checklist

- [ ] All `await db.*()` calls happen BEFORE `store.setState()`?
- [ ] All `await api.*()` calls happen BEFORE `store.setState()`?
- [ ] Subscription callbacks don't assume previous IO is complete?
- [ ] Error handling updates store with failure state?
