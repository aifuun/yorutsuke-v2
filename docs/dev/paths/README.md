# Program Paths Trace Index

> Logic traces and FSM diagrams for core functionalities.

## Index

| Flow | Document | Description |
|------|----------|-------------|
| **Capture Pipeline** | [CAPTURE.md](./CAPTURE.md) | Drop -> Compress -> Dedupe -> Upload -> Sync |
| **Session & Auth** | [SESSIONS.md](./SESSIONS.md) | App startup, recovery, and login migration |

---

## Architecture Note: Service Pattern (MVP0)

The capture module has been migrated from React headless hooks to the **Service pattern**.

| Old (headless/) | New (services/) | New (stores/) |
|-----------------|-----------------|---------------|
| `useDragDrop.ts` | `captureService.ts` | `captureStore.ts` |
| `useCaptureLogic.ts` | `fileService.ts` | (uses captureStore) |
| `useUploadQueue.ts` | `uploadService.ts` | `uploadStore.ts` |

**Key Principles**:
1. **Singleton Services**: Tauri listeners registered once in `main.tsx`.
2. **Vanilla Stores**: State managed in Zustand outside React.
3. **Thin Hooks**: React components use `useStore()` via bridge hooks.
