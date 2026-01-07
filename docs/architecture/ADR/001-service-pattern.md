# ADR-001: Service Layer Pattern

**Status**: Accepted
**Date**: 2025-01

## Context

In a Tauri + React application, we need to:
1. Listen to native events (file drops, window focus, network changes)
2. Manage global business state (upload queue, user session)
3. Orchestrate multi-step operations (compress → dedupe → upload)

The traditional React approach uses hooks (`useEffect`) for event listeners and Context/Redux for state. However, this creates problems:

| Issue | Impact |
|-------|--------|
| Listener lifecycle tied to component | Events missed when component unmounts |
| State lost on unmount | Queue progress lost on navigation |
| StrictMode double-registration | Duplicate event handlers in development |
| Testing requires React context | Complex test setup |

## Decision

Adopt a **Pure TypeScript Service Layer** pattern:

```
React (View) → Service (Orchestrator) → Adapter (Bridge) → Tauri/AWS
```

Key characteristics:
- Services are plain TypeScript classes/modules (no React)
- Services own Zustand vanilla stores for state
- Services register global listeners once at app startup
- React components only subscribe to stores and call service methods

```typescript
// Service layer (Pure TS)
import { createStore } from 'zustand/vanilla';

export const uploadStore = createStore(() => ({
  tasks: [],
  progress: 0,
}));

class UploadService {
  init() {
    // Register once at app startup
    listen('tauri://file-drop', this.handleDrop);
  }

  handleDrop = (event) => {
    uploadStore.setState({ ... });
  }
}

export const uploadService = new UploadService();
```

## Consequences

### Positive

- **Stable listeners**: Registered once, independent of React lifecycle
- **Persistent state**: Survives component unmount/remount
- **StrictMode safe**: No double-registration issues
- **Easy testing**: Plain unit tests without React wrappers
- **Clear boundaries**: Logic separated from UI

### Negative

- **Learning curve**: Team must understand the pattern
- **Boilerplate**: More files (service, store, adapter)
- **Indirection**: React → Service → Adapter → Tauri

### Neutral

- Zustand vanilla stores work with React via `useStore()`
- Pattern aligns with AI_DEV_PROT v15 Pillar L (Headless)

## Related

- [LAYERS.md](../LAYERS.md) - Layer responsibilities
- [PATTERNS.md](../PATTERNS.md) - State management patterns
- Issue #82 - Original discussion

---

*Accepted as part of four-layer architecture design*
