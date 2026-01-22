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

Adopt a **Pure TypeScript Service Layer** pattern with **Hook Bridge Layer**:

```
React (View) → Hook Bridge → Service (Orchestrator) → Adapter (Bridge) → Tauri/AWS
```

Key characteristics:
- Services are plain TypeScript classes/modules (no React)
- Services own Zustand vanilla stores for state
- Services register global listeners once at app startup
- **Hook Bridge Layer** connects React to Services (ADR-020)
- React components use hooks to subscribe to stores (never direct store access)
- React components call service methods through hook-wrapped actions

```typescript
// ========== Service layer (Pure TS) ==========
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

// ========== Hook Bridge layer (React connector) ==========
import { useStore } from 'zustand';

export function useUploadProgress(): number {
  return useStore(uploadStore, s => s.progress);
}

export const uploadActions = {
  start: (file: string) => uploadService.start(file),
};

// ========== React layer (View) ==========
function ProgressBar() {
  const progress = useUploadProgress(); // ✅ Through Hook Bridge
  return <div style={{ width: `${progress}%` }} />;
}
```

## Consequences

### Positive

- **Stable listeners**: Registered once, independent of React lifecycle
- **Persistent state**: Survives component unmount/remount
- **StrictMode safe**: No double-registration issues
- **Easy testing**: Plain unit tests without React wrappers
- **Clear boundaries**: Logic separated from UI via Hook Bridge (ADR-020)
- **Service purity**: Services have zero React dependencies, fully reusable
- **Type safety**: Hook Bridge provides type-safe primitive selectors (ADR-012)

### Negative

- **Learning curve**: Team must understand Service + Hook Bridge pattern
- **Boilerplate**: More files (service, store, hook, adapter, view)
- **Indirection**: React → Hook → Service → Adapter → Tauri

### Neutral

- Zustand vanilla stores work with React via `useStore()` in Hook Bridge
- Pattern aligns with AI_DEV_PROT v15 Pillar L (Headless)
- Hook Bridge Layer formalized in ADR-020 (2026-01-22)

## Related

- [LAYERS.md](../LAYERS.md) - Layer responsibilities (Layer 1.5: Hook Bridge)
- [PATTERNS.md](../PATTERNS.md) - State management patterns (Hook Bridge Patterns)
- [ADR-020: Hook Bridge Layer](./020-hook-bridge-layer.md) - Formalization of React-Service bridge
- [ADR-012: Zustand Selector Safety](./012-zustand-selector-safety.md) - Primitive selector requirements
- Issue #82 - Original discussion (StrictMode fix)
- Issue #165 - Settings 4-layer architecture (first implementation)
- Issue #166 - Debug Hook Bridge (second implementation)

---

*Accepted as part of four-layer architecture design*
*Updated 2026-01-22: Added Hook Bridge Layer references (ADR-020)*
