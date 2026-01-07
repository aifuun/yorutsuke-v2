# ADR-002: React StrictMode Fix

**Status**: Accepted
**Date**: 2025-01

## Context

React 18's StrictMode intentionally double-invokes certain functions during development to help detect side effects:

```typescript
// In StrictMode, this runs TWICE
useEffect(() => {
  const unlisten = listen('tauri://file-drop', handler);
  return () => unlisten();
}, []);
```

This causes problems with Tauri event listeners:
1. Two handlers registered for same event
2. Cleanup only removes one handler
3. Orphan handler persists, causing duplicate processing

### Symptoms

- File drop triggers handler twice
- Upload queue shows duplicate entries
- Event processing doubles

## Decision

Move all global event listeners out of React lifecycle into the Service layer.

### Before (Problematic)

```typescript
// In React component
function CaptureView() {
  useEffect(() => {
    // ❌ Runs twice in StrictMode
    const unlisten = listen('tauri://file-drop', handleDrop);
    return () => unlisten();
  }, []);
}
```

### After (Fixed)

```typescript
// In Service (app startup)
class CaptureService {
  private initialized = false;

  init() {
    if (this.initialized) return; // Guard against double-init
    this.initialized = true;

    // ✅ Runs once at app startup
    listen('tauri://file-drop', this.handleDrop);
  }
}

// In main.tsx
captureService.init();

// In React component
function CaptureView() {
  // ✅ Just subscribes to state, no listeners
  const queue = useStore(captureStore, s => s.queue);
}
```

## Consequences

### Positive

- **No double-registration**: Service init runs once
- **Predictable behavior**: Same in dev and prod
- **Cleaner components**: React focuses on rendering

### Negative

- **Requires refactoring**: Existing useEffect listeners must move
- **Initialization order**: Services must init before React renders

### Implementation Notes

1. Services export singleton instances
2. `main.tsx` calls `service.init()` before `ReactDOM.render()`
3. Services use initialization guard (`if (this.initialized) return`)
4. React components use `useStore()` to subscribe to service state

## Related

- [ADR-001](./001-service-pattern.md) - Service Layer Pattern
- [PATTERNS.md](../PATTERNS.md) - Writer/Observer principle
- React StrictMode docs: https://react.dev/reference/react/StrictMode

---

*This fix is part of the Service Layer Pattern adoption*
