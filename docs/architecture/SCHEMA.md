# SCHEMA.md

> Data model - Local and Cloud storage

## Overview

**Architecture**: Local-First + Cloud-Sync
**Local**: SQLite (Tauri plugin-sql)
**Cloud**: DynamoDB + S3
**Last Updated**: 2026-01-05

## ER Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL (SQLite)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────────┐                       │
│  │     images      │────────▶│  transactions       │                       │
│  │                 │  1:1    │                     │                       │
│  │  id (PK)        │         │  id (PK)            │                       │
│  │  user_id        │         │  user_id            │                       │
│  │  status (FSM)   │         │  image_id (FK)      │                       │
│  │  s3_key         │         │  type               │                       │
│  │  local_path     │         │  category           │                       │
│  └─────────────────┘         │  amount             │                       │
│                              │  confirmed_at       │                       │
│  ┌─────────────────┐         └─────────────────────┘                       │
│  │    settings     │                                                        │
│  │                 │         ┌─────────────────────┐                       │
│  │  key (PK)       │         │  morning_reports    │                       │
│  │  value          │         │                     │                       │
│  └─────────────────┘         │  date (PK)          │                       │
│                              │  data (JSON)        │                       │
│                              │  synced_at          │                       │
│                              └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD (AWS)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────────┐                       │
│  │   S3 Bucket     │         │    DynamoDB         │                       │
│  │                 │────────▶│   transactions      │                       │
│  │  uploads/       │  s3_key │                     │                       │
│  │  {user}/{date}/ │         │  userId (PK)        │                       │
│  │  {uuid}.webp    │         │  transactionId (SK) │                       │
│  │                 │         │  s3_key             │                       │
│  │  30-day TTL     │         │  ai_result          │                       │
│  └─────────────────┘         └─────────────────────┘                       │
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────────┐                       │
│  │    Cognito      │         │    DynamoDB         │                       │
│  │   User Pool     │────────▶│      users          │                       │
│  │                 │  userId │                     │                       │
│  │  Email/Password │         │  userId (PK)        │                       │
│  └─────────────────┘         │  tier               │                       │
│                              │  quota_used         │                       │
│                              └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Local Tables (SQLite)

### images

Receipt images with status FSM. Schema version: v4.

```sql
CREATE TABLE images (
  -- Core fields
  id TEXT PRIMARY KEY,              -- ImageId (UUID)
  user_id TEXT,                     -- UserId (v3)
  status TEXT DEFAULT 'pending',    -- FSM state (see below)

  -- File paths
  original_path TEXT NOT NULL,      -- Source file path
  compressed_path TEXT,             -- WebP output path
  s3_key TEXT,                      -- uploads/{userId}/{uuid}.webp

  -- Image metadata
  original_size INTEGER,            -- bytes (before compression)
  compressed_size INTEGER,          -- bytes (after compression)
  width INTEGER,                    -- pixels
  height INTEGER,                   -- pixels
  md5 TEXT,                         -- MD5 hash for duplicate detection

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  uploaded_at TEXT,                 -- ISO 8601 (when uploaded to S3)

  -- Observability (Pillar N, Q)
  trace_id TEXT,                    -- Request correlation (v2)
  intent_id TEXT,                   -- Idempotency key (v2)

  -- Error handling
  error TEXT,                       -- Error message for failed status (v4)

  -- Reference counting (future use)
  ref_count INTEGER DEFAULT 1
);

-- Indexes
CREATE INDEX idx_images_status ON images(status);
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_md5 ON images(md5);
CREATE INDEX idx_images_trace_id ON images(trace_id);
CREATE INDEX idx_images_intent_id ON images(intent_id);
```

**Status FSM**:
```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
pending ──────► compressed ──────► uploading ──────► uploaded
    │               │                   │
    │               │                   │
    ▼               ▼                   ▼
  failed          skipped           (retry as compressed)
  (compression)   (duplicate)

States:
- pending:    Dropped, waiting for compression
- compressed: Ready for upload
- uploading:  Upload in progress (transient, reset to compressed on restart)
- uploaded:   Successfully uploaded to S3
- failed:     Compression failed (with error message)
- skipped:    Duplicate detected (record deleted from DB)
```

**State Persistence Rules**:
| Operation | DB Action | Notes |
|-----------|-----------|-------|
| Drop image | INSERT pending | Immediate persistence for crash recovery |
| Compress success | UPDATE compressed | With md5, size, path |
| Compress fail | UPDATE failed | With error message |
| Duplicate found | DELETE | No need to keep duplicate record |
| Upload success | UPDATE uploaded | With s3_key, uploaded_at |
| User remove | DELETE | Sync memory and DB |
| User retry | UPDATE pending | Reset error, allow reprocessing |

### transactions

Transaction records (cached from cloud).

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,              -- TransactionId (UUID)
  user_id TEXT NOT NULL,            -- UserId
  image_id TEXT,                    -- ImageId (nullable)
  type TEXT NOT NULL,               -- 'income'|'expense'
  category TEXT NOT NULL,           -- 'purchase'|'sale'|'shipping'|'fee'|'other'
  amount INTEGER NOT NULL,          -- JPY (always positive)
  description TEXT NOT NULL,
  merchant TEXT,
  date TEXT NOT NULL,               -- 'YYYY-MM-DD'
  created_at TEXT NOT NULL,         -- ISO 8601
  updated_at TEXT NOT NULL,         -- ISO 8601
  confirmed_at TEXT,                -- ISO 8601 (null = unconfirmed)
  confidence REAL,                  -- 0.0-1.0 (AI confidence)
  raw_text TEXT,                    -- OCR result
  FOREIGN KEY (image_id) REFERENCES images(id)
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_confirmed ON transactions(confirmed_at);
```

### morning_reports

Cached daily summaries.

```sql
CREATE TABLE morning_reports (
  date TEXT PRIMARY KEY,            -- 'YYYY-MM-DD'
  user_id TEXT NOT NULL,            -- UserId
  data TEXT NOT NULL,               -- JSON (DailySummary)
  synced_at TEXT NOT NULL           -- ISO 8601
);
```

### settings

User preferences (local only).

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Default values
INSERT INTO settings (key, value) VALUES
  ('language', 'ja'),
  ('theme', 'system'),
  ('auto_upload', 'true');
```

## Cloud Tables (DynamoDB)

### transactions

AI-processed transaction results.

```typescript
interface CloudTransaction {
  userId: string;           // PK - from Cognito
  transactionId: string;    // SK - UUID
  s3Key: string;            // S3 image path
  amount: number | null;
  merchant: string | null;
  category: string | null;
  receiptDate: string | null;
  aiConfidence: number | null;
  aiResult: object | null;  // Full AI response
  status: 'uploaded' | 'processing' | 'processed' | 'failed' | 'skipped';
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}
```

**GSI**: `byDate` (PK: userId, SK: date)

### users

User profiles and quotas.

```typescript
interface CloudUser {
  userId: string;           // PK - from Cognito sub
  email: string;
  tier: 'free' | 'basic' | 'pro';
  quotaUsedToday: number;   // Images uploaded today
  quotaResetAt: string;     // ISO 8601 (JST midnight)
  createdAt: string;
  updatedAt: string;
}
```

## Local File Storage

### Strategy: Permanent Local Retention

Compressed receipt images are **permanently stored locally** for:
1. **Offline viewing**: Verify AI results against original receipt
2. **Transaction confirmation**: Compare extracted data with image
3. **Local-first access**: No network required for image viewing

### Directory Structure

```
~/.yorutsuke/
├── images/           # Compressed receipt images (permanent)
│   └── {uuid}.webp   # ~50-100KB each
├── logs/             # Daily log files (7-day retention)
│   └── {date}.jsonl
└── yorutsuke.db      # SQLite database
```

**Platform paths**:
| OS | Base Path |
|----|-----------|
| macOS | `~/Library/Application Support/yorutsuke-v2/` |
| Linux | `~/.local/share/yorutsuke-v2/` |
| Windows | `C:\Users\<user>\AppData\Local\yorutsuke-v2\` |

### Storage Estimation

| Period | Images (50/day) | Size |
|--------|-----------------|------|
| Daily | 50 | 5 MB |
| Monthly | 1,500 | 150 MB |
| Yearly | 18,000 | 1.8 GB |

### Lifecycle

```
拖入 → 压缩 → 保存本地 → 上传S3 → 本地永久保留
              │                         │
              └── ~/.yorutsuke/images/  │
                                        │
                           S3: 30天后自动删除
```

### Cleanup (Optional)

- **Manual**: Settings → "清除数据" button
- **Selective**: Delete images older than N days (future feature)

---

## Cloud Storage (S3)

### Bucket Structure

```
yorutsuke-images-{env}-{account}/
└── uploads/
    └── {userId}/
        └── {date}/
            └── {uuid}.webp
```

**Example**: `uploads/abc123/2025-12-28/550e8400-e29b-41d4.webp`

### Lifecycle Rules

| Tier | S3 Retention | Rule |
|------|--------------|------|
| Guest/Free | 30 days | Lifecycle expiration |
| Basic/Pro | Permanent | No expiration (paying users) |

| Rule | Action | Condition |
|------|--------|-----------|
| Expiration | Delete | 30 days (Guest/Free only) |
| Transition | Intelligent-Tiering | 7 days |

**Implementation**: S3 objects tagged with `tier=free` get lifecycle rule; `tier=paid` objects are exempt.

## Schema Layers

> **Important**: This project uses a two-layer schema approach for type safety and separation of concerns.

### Layer Overview

| Layer | Location | Purpose | Naming |
|-------|----------|---------|--------|
| **Storage** | `00_kernel/storage/types.ts` | SQLite row types | snake_case |
| **Domain** | `01_domains/*/types.ts` | Business model types | camelCase |

### ImageRow vs ReceiptImage

These are **intentionally different** types serving different purposes:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Storage Layer: ImageRow                                                       │
│ File: 00_kernel/storage/types.ts                                             │
│                                                                              │
│ Purpose: SQLite row representation                                           │
│ Scope: LOCAL processing lifecycle only                                       │
│                                                                              │
│ ImageStatus (6 states):                                                      │
│   'pending' → 'compressing' → 'compressed' → 'uploading' → 'uploaded'        │
│        └─────────────────────────────────────────────────────→ 'failed'      │
│                                                                              │
│ Fields: snake_case (matches SQLite columns)                                  │
│   - id, user_id, trace_id, intent_id                                         │
│   - original_path, compressed_path, original_size, compressed_size           │
│   - md5, status, s3_key, ref_count, created_at, uploaded_at                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Adapter transforms at boundary
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Domain Layer: ReceiptImage                                                   │
│ File: 01_domains/receipt/types.ts                                            │
│                                                                              │
│ Purpose: Business domain model                                               │
│ Scope: FULL lifecycle including cloud processing                             │
│                                                                              │
│ ImageStatus (8 states):                                                      │
│   'pending' → 'compressed' → 'uploading' → 'uploaded'                        │
│        │                                       │                             │
│        │                                       ▼                             │
│        │                              'processing' → 'processed' → 'confirmed'│
│        └────────────────────────────────────────────────────→ 'failed'       │
│                                                                              │
│ Fields: camelCase (TypeScript domain model)                                  │
│   - id (ImageId), userId (UserId), intentId, traceId                         │
│   - status (ImageStatus), localPath, s3Key, thumbnailPath                    │
│   - originalSize, compressedSize, createdAt, uploadedAt, processedAt         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Why Two Types?

1. **Storage isolation**: `ImageRow` matches SQLite schema exactly (snake_case)
2. **Domain purity**: `ReceiptImage` uses TypeScript conventions (camelCase)
3. **Lifecycle scope**: Local processing doesn't need cloud states (`processing`, `processed`, `confirmed`)
4. **Boundary validation**: Adapter transforms ensure type safety (Pillar B)

### Where Each Is Used

| Type | Used In | Purpose |
|------|---------|---------|
| `ImageRow` | `imageDb.ts` adapter | SQLite queries, raw row handling |
| `ReceiptImage` | Services, Stores, Views | Business logic, UI rendering |

### Conversion Example

```typescript
// In adapter layer (imageDb.ts)
function rowToReceiptImage(row: ImageRow): ReceiptImage {
  return {
    id: ImageId(row.id),
    userId: UserId(row.user_id!),
    status: row.status,  // May need mapping for cloud states
    localPath: row.compressed_path ?? row.original_path,
    // ... transform snake_case → camelCase
  };
}
```

---

## Type Definitions

### Branded Types (Pillar A)

```typescript
type UserId = string & { __brand: 'UserId' };
type ImageId = string & { __brand: 'ImageId' };
type TransactionId = string & { __brand: 'TransactionId' };
type ReportId = string & { __brand: 'ReportId' };
```

### Storage Layer Enums

```typescript
// 00_kernel/storage/types.ts
// Used in SQLite operations (local lifecycle only)
// Note: 'compressing' was removed - compression is synchronous
type ImageStatus =
  | 'pending'      // Awaiting compression
  | 'compressed'   // Compressed, awaiting upload
  | 'uploading'    // Being uploaded
  | 'uploaded'     // Successfully uploaded to S3
  | 'failed'       // Processing failed
  | 'skipped';     // Duplicate detected, skipped
```

### Domain Layer Enums

```typescript
// 01_domains/receipt/types.ts
// Full lifecycle including cloud processing
type ImageStatus =
  | 'pending'      // Just dropped, waiting for compression
  | 'compressed'   // WebP compressed, ready for upload
  | 'uploading'    // Currently uploading to S3
  | 'uploaded'     // In S3, waiting for batch processing
  | 'processing'   // Being processed by Nova Lite (cloud, MVP2)
  | 'processed'    // OCR complete, transaction extracted (cloud, MVP2)
  | 'confirmed'    // User confirmed transaction (cloud, MVP2)
  | 'failed'       // Processing failed
  | 'skipped';     // Duplicate detected, skipped

type TransactionType = 'income' | 'expense';

type TransactionCategory =
  | 'purchase'   // 仕入れ
  | 'sale'       // 売上
  | 'shipping'   // 送料
  | 'packaging'  // 梱包材
  | 'fee'        // 手数料
  | 'other';     // その他
```

## Runtime State (Zustand Stores)

> Service layer manages runtime state via Zustand vanilla stores.
> See [ARCHITECTURE.md](./ARCHITECTURE.md) for State Ownership principles.

### Store Architecture

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

### Capture Module Store Flow

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

### captureStore

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
  // Per ARCHITECTURE.md anti-pattern rules:
  // - Errors stored per-image in ReceiptImage.error field
  // - One-time notifications via EventBus
}
```

### uploadStore

Upload queue state for capture module.

```typescript
// createStore from 'zustand/vanilla'
interface UploadStore {
  // State (persistent truth)
  status: 'idle' | 'processing' | 'paused' | 'error';
  tasks: UploadTask[];
  currentTaskId: ImageId | null;

  // NOTE: No error message here!
  // Error notifications go through EventBus (see Anti-Pattern in ARCHITECTURE.md)
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
  // NOTE: No error message - use EventBus 'upload:failed' for notifications
}
```

### fileStore

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

### syncStore

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

### quotaStore

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

### Store vs SQLite

| Data | Store (Memory) | SQLite (Disk) | Reason |
|------|----------------|---------------|--------|
| Capture queue | ✅ Primary | — | Transient, rebuild on restart |
| Upload queue | ✅ Primary | Backup on crash | Fast UI updates |
| File metadata | Cache | ✅ Primary | Persist across restart |
| Transactions | Cache | ✅ Primary | Large dataset |
| Quota | ✅ Primary | Backup | Frequently accessed |
| Settings | Cache | ✅ Primary | Persist user prefs |

## Sync Strategy

### Local → Cloud

```
1. Image compressed locally
2. Call presign Lambda → get S3 URL
3. Upload to S3
4. Update local status = 'uploaded'
```

### Cloud → Local

```
1. App launch / manual refresh
2. Fetch transactions from API
3. Upsert to local transactions table
4. Update morning_reports cache
```

### Conflict Resolution

- **Last-write-wins** for transactions
- Cloud is source of truth after processing
- Local edits create new `updatedAt`

## References

- Architecture: `./ARCHITECTURE.md`
- Interfaces: `./INTERFACES.md`
- Original schema: `../yorutsuke/docs/schema.md`
