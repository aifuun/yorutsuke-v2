# Runtime State (STORES)

> Service layer manages runtime state via Zustand vanilla stores.
> See [README.md](./README.md) for State Ownership principles.

## Store Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Runtime State Layer                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Capture Module:                                            │
│  ┌──────────────┐  ┌─────────────┐                         │
│  │ captureStore │─▶│ uploadStore │                         │
│  │ (Processing) │  │  (Upload)   │                         │
│  └──────────────┘  └─────────────┘                         │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────┐                                           │
│  │  fileStore  │  (Persistent metadata cache)              │
│  └─────────────┘                                           │
│                                                             │
│  Other Modules:                                             │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │  syncStore  │  │ quotaStore  │                          │
│  │  (Cloud)    │  │  (Limits)   │                          │
│  └─────────────┘  └─────────────┘                          │
│                                                             │
│  Writer: Service layer only                                 │
│  Reader: React via useStore()                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Capture Module Store Flow

```
Drop Event
    │
    ▼
┌──────────────┐     compress done     ┌─────────────┐
│ captureStore │ ───────────────────▶ │ uploadStore │
│              │                       │             │
│ status:      │                       │ status:     │
│  pending     │                       │  pending    │
│  compressing │                       │  uploading  │
│  compressed ─┼───────────────────────▶  success   │
│  failed      │                       │  failed     │
└──────────────┘                       └─────────────┘
       │                                      │
       └──────────────┬───────────────────────┘
                      ▼
               ┌─────────────┐
               │  fileStore  │  (SQLite cache)
               └─────────────┘
```

## captureStore

Processing queue state for capture module.

```typescript
// createStore from 'zustand/vanilla'
interface CaptureStore {
  // FSM status for queue processing
  // - 'idle': Ready for next image
  // - 'processing': Compressing an image
  // - 'uploading': Uploading an image (coordinates with uploadStore)
  status: 'idle' | 'processing' | 'uploading';

  // Queue of images (uses domain ReceiptImage type)
  queue: ReceiptImage[];

  // Currently processing image
  currentId: ImageId | null;

  // Count of skipped duplicates (for UI feedback)
  skippedCount: number;

  // NOTE: No error message field!
  // Per ARCHITECTURE principles:
  // - Errors stored per-image in ReceiptImage.error field
  // - One-time notifications via EventBus
}
```

## uploadStore

Upload queue state for capture module.

```typescript
// createStore from 'zustand/vanilla'
interface UploadStore {
  // State (persistent truth)
  status: 'idle' | 'processing' | 'paused' | 'error';
  tasks: UploadTask[];
  currentTaskId: ImageId | null;

  // NOTE: No error message here!
  // Error notifications go through EventBus
  // status: 'error' is enough to show error UI state

  // Derived (computed in selectors)
  // pendingCount: number
  // progress: number (0-100)
}

interface UploadTask {
  id: ImageId;
  intentId: IntentId;
  traceId: TraceId;
  filePath: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  retryCount: number;
}
```

## fileStore

Local file management state.

```typescript
interface FileStore {
  // State
  files: LocalFile[];
  processingId: ImageId | null;

  // Persisted to SQLite on change
}

interface LocalFile {
  id: ImageId;
  localPath: string;
  thumbnailPath: string | null;
  md5: string;
  status: ImageStatus;
  createdAt: string;
}
```

## syncStore

Cloud synchronization state (MVP3.5+).

```typescript
interface SyncStore {
  // State
  status: 'idle' | 'syncing' | 'error';
  pendingSync: SyncAction[];
  lastSyncAt: string | null;

  // Offline queue
}

interface SyncAction {
  type: 'confirm' | 'update' | 'delete';
  transactionId: TransactionId;
  data: Partial<Transaction>;
  queuedAt: string;
}
```

## quotaStore

User quota state.

```typescript
interface QuotaStore {
  // State
  used: number;
  limit: number;
  tier: 'guest' | 'free' | 'basic' | 'pro';
  resetsAt: string | null;

  // Derived
  // remaining: number
  // isLimitReached: boolean
}
```

## Store vs SQLite

| Data | Store (Memory) | SQLite (Disk) | Reason |
|------|----------------|---------------|--------|
| Capture queue | ✅ Primary | — | Transient, rebuild on restart |
| Upload queue | ✅ Primary | Backup on crash | Fast UI updates |
| File metadata | Cache | ✅ Primary | Persist across restart |
| Transactions | Cache | ✅ Primary | Large dataset |
| Quota | ✅ Primary | Backup | Frequently accessed |
| Settings | Cache | ✅ Primary | Persist user prefs |

---

## References

- [SCHEMA.md](./SCHEMA.md) - Database tables and cloud interfaces
- [MODELS.md](./MODELS.md) - Row vs Domain mappings
