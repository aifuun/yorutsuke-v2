# INTERFACES.md

> Interface definitions - Service layer, IPC commands, and Cloud APIs

## Overview

**Service**: Pure TypeScript orchestration layer
**IPC**: Tauri commands (Rust ↔ TypeScript)
**Cloud API**: Lambda Function URLs
**Last Updated**: 2026-01-05

---

## Four-Layer Communication

```
┌─────────────────────────────────────────────────────────────┐
│  React                                                      │
│  └─ calls Service methods                                   │
│  └─ subscribes to Zustand stores                            │
│  └─ listens to EventBus                                     │
├─────────────────────────────────────────────────────────────┤
│  Service (this section)                                     │
│  └─ orchestrates business logic                             │
│  └─ calls Adapters                                          │
│  └─ updates Zustand stores                                  │
│  └─ emits EventBus events                                   │
├─────────────────────────────────────────────────────────────┤
│  Adapters                                                   │
│  └─ Tauri IPC (see IPC Commands section)                    │
│  └─ Cloud API (see Cloud APIs section)                      │
├─────────────────────────────────────────────────────────────┤
│  Backend                                                    │
│  └─ Tauri (Rust) / AWS Lambda                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Layer Interfaces

> Service layer is the orchestration layer between React and Adapters.
> See [ARCHITECTURE.md](./ARCHITECTURE.md) for the four-layer model.

### captureService

Entry point for image capture. Registers Tauri listeners at app startup.

```typescript
// app/src/02_modules/capture/services/captureService.ts

class CaptureService {
  // Initialize at app startup (registers Tauri drag-drop listener)
  // Called once in main.tsx, independent of React lifecycle
  init(): void;

  // Handle dropped files (called by Tauri listener)
  // Generates IDs, validates files, delegates to fileService
  handleDrop(paths: string[]): Promise<void>;

  // Manual file selection (future: file picker)
  selectFiles(): Promise<void>;
}

// Singleton instance
export const captureService: CaptureService;

// State access via Zustand store
export const captureStore: StoreApi<CaptureStore>;
```

**Store interface:**

```typescript
interface CaptureStore {
  // Processing state
  status: 'idle' | 'processing' | 'error';

  // Queue of images being processed
  queue: QueuedImage[];

  // Currently processing image
  currentId: ImageId | null;
}

interface QueuedImage {
  id: ImageId;
  traceId: TraceId;
  intentId: IntentId;
  localPath: string;
  status: 'pending' | 'compressed' | 'failed' | 'skipped';
}
```

### uploadService

Manages image upload queue.

```typescript
// app/src/02_modules/capture/services/uploadService.ts

class UploadService {
  // Initialize at app startup (registers Tauri listeners)
  init(): void;

  // Add file to upload queue
  enqueue(file: DroppedFile): void;

  // Pause/resume queue (offline, quota)
  pause(reason: 'offline' | 'quota'): void;
  resume(): void;

  // Manual retry for failed uploads
  retry(id: ImageId): void;

  // Cancel pending upload
  cancel(id: ImageId): void;
}

// Singleton instance
export const uploadService: UploadService;

// State access via Zustand store
export const uploadStore: StoreApi<UploadStore>;
```

### fileService

Manages local file operations.

```typescript
// app/src/02_modules/capture/services/fileService.ts

class FileService {
  // Process dropped file (compress, hash, save)
  processFile(file: DroppedFile): Promise<ProcessedFile>;

  // Check for duplicate by MD5
  checkDuplicate(md5: string): Promise<ImageId | null>;

  // Delete local file and DB record
  deleteFile(id: ImageId): Promise<void>;

  // Restore queue on app restart
  restoreQueue(): Promise<void>;
}

export const fileService: FileService;
export const fileStore: StoreApi<FileStore>;
```

### syncService

Manages cloud synchronization (MVP3.5+).

```typescript
// app/src/02_modules/sync/services/syncService.ts

class SyncService {
  // Sync confirmed transaction to cloud
  syncTransaction(tx: Transaction): Promise<void>;

  // Queue action for offline sync
  queueAction(action: SyncAction): void;

  // Process offline queue when online
  processQueue(): Promise<void>;

  // Fetch cloud data for recovery
  fetchCloudData(userId: UserId): Promise<Transaction[]>;
}

export const syncService: SyncService;
export const syncStore: StoreApi<SyncStore>;
```

### quotaService

Manages user quota.

```typescript
// app/src/02_modules/quota/services/quotaService.ts

class QuotaService {
  // Refresh quota from server
  refresh(): Promise<void>;

  // Check if can upload (soft check)
  canUpload(): boolean;

  // Increment local count (after successful upload)
  incrementUsed(): void;
}

export const quotaService: QuotaService;
export const quotaStore: StoreApi<QuotaStore>;
```

### EventBus Events

Service layer emits these events for one-time notifications:

```typescript
// Event types (fire-and-forget)
type AppEvents = {
  // Toast notifications
  'toast:success': { message: string };
  'toast:error': { message: string };

  // Image lifecycle (from eventBus/types.ts)
  'image:pending': { id: ImageId; traceId: TraceId; name: string; source: 'drop' | 'paste' | 'select' };
  'image:compressing': { id: ImageId; traceId: TraceId };
  'image:compressed': { id: ImageId; traceId: TraceId; compressedPath: string; md5: string };
  'image:duplicate': { id: ImageId; traceId: TraceId; duplicateWith: string; reason: 'queue' | 'database' };
  'image:failed': { id: ImageId; traceId: TraceId; error: string; stage: 'compress' | 'save' | 'upload' };
  'image:deleted': { id: ImageId; traceId: TraceId; mode: 'local' | 'cloud' | 'permanent' | 'wipe' };

  // Upload lifecycle
  'upload:complete': { id: ImageId; traceId: TraceId; s3Key: string };
  'upload:failed': { id: ImageId; traceId: TraceId; error: string; errorType: 'network' | 'quota' | 'server' | 'unknown' };
  'upload:batch-complete': { count: number; successCount: number; failCount: number };

  // Network
  'network:changed': { online: boolean };

  // Auth
  'auth:dataClaimed': { count: number; oldUserId: string; newUserId: string };
};

// Usage in Service
eventBus.emit('toast:success', { message: '削除しました' });

// Usage in React
useAppEvent('toast:success', ({ message }) => showToast(message));
```

### React Integration

```typescript
// Reading state from Service layer
function UploadProgress() {
  // Subscribe to Zustand store
  const progress = useStore(uploadStore, (s) => s.progress);
  const status = useStore(uploadStore, (s) => s.status);

  return <ProgressBar value={progress} paused={status === 'paused'} />;
}

// Calling Service methods
function UploadButton() {
  const handleDrop = (files: DroppedFile[]) => {
    files.forEach((file) => uploadService.enqueue(file));
  };

  return <DropZone onDrop={handleDrop} />;
}

// Listening to one-time events
function ToastContainer() {
  useAppEvent('toast:success', ({ message }) => {
    toast.success(message);
  });

  useAppEvent('toast:error', ({ message }) => {
    toast.error(message);
  });

  return <ToastViewport />;
}
```

---

## IPC Commands (Tauri)

### Image Processing

#### compress_image

Compress image to WebP format.

```typescript
// Request
invoke('compress_image', {
  inputPath: string,   // Original image path
  outputPath: string,  // Target WebP path
})

// Response
interface CompressResult {
  success: boolean;
  outputPath: string;
  originalSize: number;   // bytes
  compressedSize: number; // bytes
  width: number;
  height: number;
}
```

#### get_image_hash

Calculate MD5 hash for deduplication.

```typescript
// Request
invoke('get_image_hash', {
  path: string,  // Image file path
})

// Response
string  // MD5 hash
```

#### delete_file

Delete local file.

```typescript
// Request
invoke('delete_file', {
  path: string,  // File path to delete
})

// Response
void
```

### Database

SQLite operations via `@tauri-apps/plugin-sql`.

```typescript
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:yorutsuke.db');

// Select
const rows = await db.select<T[]>(query, params);

// Execute
await db.execute(query, params);
```

### Logging

#### log_message

Write to log file.

```typescript
// Request
invoke('log_message', {
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context: object,
})

// Response
void
```

Log file: `/tmp/yorutsuke-frontend.log`

---

## Cloud APIs (Lambda)

### Base URLs

```typescript
const PRESIGN_URL = import.meta.env.VITE_LAMBDA_PRESIGN_URL;
const CONFIG_URL = import.meta.env.VITE_LAMBDA_CONFIG_URL;
const BATCH_URL = import.meta.env.VITE_LAMBDA_BATCH_SUBMIT_URL;
```

### Authentication

All authenticated endpoints require Cognito JWT token:

```typescript
headers: {
  'Authorization': `Bearer ${idToken}`,
  'Content-Type': 'application/json',
}
```

---

### POST /presign

Get S3 presigned URL for image upload.

**Request**:
```typescript
interface PresignRequest {
  userId: string;
  fileName: string;
  contentType: string;  // 'image/jpeg'
}
```

**Response**:
```typescript
interface PresignResponse {
  url: string;    // S3 presigned PUT URL
  key: string;    // S3 object key
  expiresIn: 300; // seconds
}
```

**Errors**:
| Code | Meaning |
|------|---------|
| 400 | Missing required fields |
| 403 | Quota exceeded |
| 500 | Internal error |

---

### POST /report

Get morning report for a date.

**Request**:
```typescript
interface ReportRequest {
  userId: string;
  date: string;  // 'YYYY-MM-DD'
}
```

**Response**:
```typescript
interface ReportResponse {
  date: string;
  summary: {
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    transactionCount: number;
    byCategory: Record<Category, number>;
  };
  transactions: Transaction[];
  generatedAt: string;  // ISO 8601
}
```

---

### POST /report/history

Get recent report history.

**Request**:
```typescript
interface HistoryRequest {
  userId: string;
  limit: number;  // default: 7
}
```

**Response**:
```typescript
interface HistoryResponse {
  reports: ReportResponse[];
}
```

---

### POST /transactions

Query transactions.

**Request**:
```typescript
interface TransactionsRequest {
  userId: string;
  startDate?: string;  // 'YYYY-MM-DD'
  endDate?: string;    // 'YYYY-MM-DD'
  status?: 'all' | 'confirmed' | 'unconfirmed';
  limit?: number;      // default: 100
  cursor?: string;     // pagination
}
```

**Response**:
```typescript
interface TransactionsResponse {
  transactions: Transaction[];
  nextCursor: string | null;
}
```

---

### PUT /transactions/{id}

Update transaction.

**Request**:
```typescript
interface UpdateRequest {
  amount?: number;
  category?: Category;
  description?: string;
  merchant?: string;
  date?: string;
  confirmedAt?: string;  // ISO 8601 to confirm
}
```

**Response**:
```typescript
interface UpdateResponse {
  transaction: Transaction;
}
```

---

### DELETE /transactions/{id}

Delete transaction.

**Response**:
```typescript
interface DeleteResponse {
  success: boolean;
}
```

---

### GET /config

Get app configuration.

**Response**:
```typescript
interface ConfigResponse {
  quotaLimit: number;        // 50
  uploadIntervalMs: number;  // 2000
  processingConfig: {
    mode: 'instant' | 'batch' | 'hybrid';  // default: 'instant'
    imageThreshold: number;  // default: 100 (range: 100-500, Batch/Hybrid only)
    timeoutMinutes: number;  // default: 120 (range: 30-480, Hybrid only)
    modelId: string;         // default: 'amazon.nova-lite-v1:0'
  };
  maintenanceMode: boolean;
  version: {
    minimum: string;
    latest: string;
  };
}
```

**Processing Mode Details**:
| Mode | imageThreshold | timeoutMinutes | Description |
|------|----------------|----------------|-------------|
| `instant` | ignored | ignored | On-Demand, process immediately |
| `batch` | used (min 100) | ignored | Batch Inference, 50% discount |
| `hybrid` | used (min 100) | used | Batch when >= threshold, On-Demand on timeout |

---

### GET /batch/config (Admin API)

Get processing configuration.

**Response**:
```typescript
interface ProcessingConfigResponse {
  mode: 'instant' | 'batch' | 'hybrid';
  imageThreshold: number;   // 100-500 (only used in batch/hybrid mode)
  timeoutMinutes: number;   // 30-480 (only used in hybrid mode)
  modelId: string;
  updatedAt: string;        // ISO 8601
  updatedBy: string;        // admin email
}
```

---

### PUT /batch/config (Admin API)

Update processing configuration.

**Request**:
```typescript
interface ProcessingConfigRequest {
  mode?: 'instant' | 'batch' | 'hybrid';
  imageThreshold?: number;  // 100-500 (required if mode is batch/hybrid)
  timeoutMinutes?: number;  // 30-480 (required if mode is hybrid)
  modelId?: string;         // valid model ID
}
```

**Validation Rules**:
- If `mode` is `batch` or `hybrid`, `imageThreshold` must be >= 100
- If `mode` is `hybrid`, `timeoutMinutes` is required
- Returns 400 if `imageThreshold` < 100 for batch/hybrid mode

**Response**:
```typescript
interface ProcessingConfigResponse {
  mode: 'instant' | 'batch' | 'hybrid';
  imageThreshold: number;
  timeoutMinutes: number;
  modelId: string;
  updatedAt: string;
  updatedBy: string;
}
```

---

### POST /quota

Check user quota.

**Request**:
```typescript
interface QuotaRequest {
  userId: string;
}
```

**Response**:
```typescript
interface QuotaResponse {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;  // ISO 8601
}
```

---

## S3 Operations

### Upload Image

```typescript
// 1. Get presigned URL
const { url, key } = await getPresignedUrl(userId, fileName);

// 2. Upload directly to S3
await fetch(url, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: blob,
});

// 3. Store key in local DB
await saveImageS3Key(imageId, key);
```

### Download Image (if needed)

```typescript
// Get presigned GET URL
const { url } = await getPresignedDownloadUrl(s3Key);

// Fetch image
const response = await fetch(url);
const blob = await response.blob();
```

---

## Error Handling

### Standard Error Response

```typescript
interface ErrorResponse {
  error: string;       // Error code
  message: string;     // Human-readable message
  details?: object;    // Additional info
}
```

### Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Invalid/expired token |
| `FORBIDDEN` | 403 | No permission |
| `QUOTA_EXCEEDED` | 403 | Daily limit reached |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `MAINTENANCE` | 503 | System under maintenance |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Validation (Pillar B)

All API responses must be validated at boundary:

```typescript
// Good: Validate response
const data = await response.json();
if (!data.url || !data.key) {
  throw new Error('Invalid presign response');
}

// Bad: Trust raw response
const { url, key } = await response.json();
```

---

## References

- Schema: `./SCHEMA.md`
- Architecture: `./ARCHITECTURE.md`
- Adapters: `app/src/02_modules/*/adapters/`
