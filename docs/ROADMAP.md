# Roadmap

> yorutsuke-v2 Development Roadmap - Migration from yorutsuke

## Overview

| Phase | Focus | Issues | Status |
|-------|-------|--------|--------|
| **Phase 0** | Core Kernel | #1-#3 | ✅ Complete |
| **Phase 1** | Capture Pipeline | #4-#7 | ✅ Complete |
| **Phase 2** | User Features | #8-#10 | ✅ Complete |
| **Phase 3** | Polish | #11-#12 | ✅ Complete |
| **Backlog** | Enhancements | #13-#14 | ✅ Complete |
| **Phase 4** | Backend APIs | #15-#19 | ⚪ Not Started |

## Current State vs Target

| Component | yorutsuke | v2 Status | Issue |
|-----------|-----------|-----------|-------|
| EventBus | ✅ useAppEvent | ✅ Complete | #1 |
| SQLite Migrations | ✅ db.ts | ✅ Complete | #2 |
| Network Status | ✅ useNetworkStatus | ✅ Complete | #3 |
| Drag & Drop | ✅ useTauriDragDrop | ✅ Complete | #4 |
| Image Compression | ✅ useImageProcessor | ✅ Complete | #5 |
| Upload Queue | ✅ useUploadQueue | ✅ Complete | #6 |
| Auth (Cognito) | ✅ useAuth | ✅ Complete | #7 |
| Morning Report | ✅ MorningReport | ✅ Complete | #8 |
| Transactions | ✅ Transactions | ✅ Complete | #9 |
| Settings | ✅ Settings.tsx | ✅ Complete | #10 |
| i18n | ✅ i18next | ✅ Complete | #11 |
| Error Recovery | - | ✅ Complete | #12 |
| Transaction Filters | - | ✅ Complete | #13 |
| Report History | - | ✅ Complete | #14 |
| batch-process Lambda | ⚪ Design only | ⚪ Not Started | #15 |
| report Lambda | ⚪ Design only | ⚪ Not Started | #16 |
| transactions Lambda | ⚪ Design only | ⚪ Not Started | #17 |
| config Lambda | ⚪ Design only | ⚪ Not Started | #18 |
| quota Lambda | ⚪ Design only | ⚪ Not Started | #19 |

Legend: ✅ Complete | 🟡 Skeleton | ⚪ Not Started | ❌ Missing

---

## Phase 0: Core Kernel

> Foundation for all modules. No dependencies.

### #1 EventBus (00_kernel/eventBus)

**Tier**: T1 (Direct)
**Source**: `yorutsuke/app/src/utils/events.ts`

**Scope**:
- [ ] `eventBus.ts` - Core emit/on API
- [ ] `useAppEvent.ts` - React hook with cleanup
- [ ] `types.ts` - Event type definitions

**Events to implement**:
```typescript
type AppEvents = {
  'image:pending': { id: ImageId; localPath: string };
  'image:compressed': { id: ImageId; compressedPath: string };
  'image:queued': { id: ImageId };
  'image:uploaded': { id: ImageId; s3Key: string };
  'image:failed': { id: ImageId; error: string };
  'upload:complete': { count: number };
  'data:refresh': { source: string };
};
```

**Acceptance Criteria**:
- [ ] Type-safe event emission and subscription
- [ ] Auto-cleanup on component unmount
- [ ] Console logging in dev mode

**Files**:
```
app/src/00_kernel/
├── eventBus/
│   ├── eventBus.ts      # emit(), on()
│   ├── useAppEvent.ts   # React hook
│   ├── types.ts         # AppEvents interface
│   └── index.ts
└── index.ts             # re-export
```

---

### #2 SQLite + Migrations (00_kernel/storage)

**Tier**: T1 (Direct)
**Source**: `yorutsuke/app/src/db/connection.ts`

**Scope**:
- [ ] `db.ts` - Connection management
- [ ] `migrations.ts` - Schema versioning
- [ ] `schema.sql` - Initial tables

**Tables**:
```sql
-- images table
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  original_path TEXT NOT NULL,
  compressed_path TEXT,
  md5 TEXT,
  status TEXT DEFAULT 'pending',
  s3_key TEXT,
  ref_count INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- transactions_cache table
CREATE TABLE IF NOT EXISTS transactions_cache (
  id TEXT PRIMARY KEY,
  image_id TEXT,
  amount REAL,
  merchant TEXT,
  category TEXT,
  ai_result TEXT,
  confirmed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

**Acceptance Criteria**:
- [ ] Idempotent migrations (ALTER TABLE with error catch)
- [ ] Version tracking in settings table
- [ ] Connection singleton pattern

**Files**:
```
app/src/00_kernel/
├── storage/
│   ├── db.ts           # getDb(), initDb()
│   ├── migrations.ts   # runMigrations()
│   ├── types.ts        # Row types
│   └── index.ts
└── index.ts
```

---

### #3 Network Status (00_kernel/network)

**Tier**: T1 (Direct)
**Source**: `yorutsuke/app/src/hooks/useNetworkStatus.ts`

**Scope**:
- [ ] `networkStatus.ts` - Online/offline detection
- [ ] `useNetworkStatus.ts` - React hook

**API**:
```typescript
type NetworkState = 'online' | 'offline' | 'unknown';

function useNetworkStatus(): {
  state: NetworkState;
  isOnline: boolean;
};
```

**Acceptance Criteria**:
- [ ] Listen to browser online/offline events
- [ ] Initial state detection
- [ ] Emit `network:changed` event via EventBus

**Files**:
```
app/src/00_kernel/
├── network/
│   ├── networkStatus.ts
│   ├── useNetworkStatus.ts
│   └── index.ts
└── index.ts
```

---

## Phase 1: Capture Pipeline

> Core image capture and upload flow. Depends on Phase 0.

### #4 Tauri Drag & Drop (02_modules/capture)

**Tier**: T2 (Logic)
**Source**: `yorutsuke/app/src/hooks/useTauriDragDrop.ts`

**Scope**:
- [ ] `adapters/tauriDragDrop.ts` - Tauri event listener
- [ ] `headless/useDragDrop.ts` - Drop logic (Pillar L)
- [ ] Update `views/CaptureView.tsx` - Drop zone UI

**Key Features**:
- File path extraction from Tauri event
- Extension filtering (jpg, jpeg, png, webp)
- Preview URL via `convertFileSrc()`

**Acceptance Criteria**:
- [ ] Drop files onto app triggers `image:pending` event
- [ ] Visual feedback during drag-over
- [ ] Invalid file types rejected with message

---

### #5 Image Compression (02_modules/capture)

**Tier**: T2 (Logic)
**Source**: `yorutsuke/app/src/hooks/useImageProcessor.ts`

**Scope**:
- [ ] `adapters/imageIpc.ts` - Invoke Rust compress command
- [ ] `headless/useImageProcessor.ts` - Processing logic
- [ ] Update `01_domains/receipt/` - MD5 deduplication

**Processing Flow**:
```
image:pending
    │
    ▼
Check Duplicate (MD5)
    │
    ├── Duplicate → image:duplicate
    │
    └── New → Compress (Rust IPC)
              │
              ▼
          Save to SQLite
              │
              ▼
          image:queued
```

**Acceptance Criteria**:
- [ ] WebP compression via Rust IPC
- [ ] MD5 hash for deduplication
- [ ] Timeout protection (15s)
- [ ] Error emits `image:failed`

---

### #6 Upload Queue (02_modules/capture)

**Tier**: T3 (Saga)
**Source**: `yorutsuke/app/src/hooks/useUploadQueue.ts`

**Scope**:
- [ ] `workflows/uploadSaga.ts` - Upload orchestration (Pillar M)
- [ ] `adapters/uploadApi.ts` - Presigned URL + S3 upload
- [ ] `headless/useUploadQueue.ts` - Queue management

**Features**:
- Startup scan of pending images
- Pause when offline (depends on #3)
- Exponential backoff retry (1s, 2s, 4s)
- Error classification (network/quota/server)

**State Machine**:
```
idle ──────► uploading ──────► success
                │                  │
                ▼                  │
            failed ◄───────────────┘
                │
                ▼
         (retry 3x or abandon)
```

**Acceptance Criteria**:
- [ ] Auto-pause when offline
- [ ] Retry with exponential backoff
- [ ] Quota check before upload (daily limit)
- [ ] `upload:complete` event after batch

---

### #7 Auth (Cognito) (02_modules/auth)

**Tier**: T2 (Logic)
**Source**: `yorutsuke/app/src/hooks/useAuth.tsx`

**Scope**:
- [ ] `adapters/authApi.ts` - Cognito API calls
- [ ] `adapters/tokenStorage.ts` - SQLite token storage
- [ ] `headless/useAuth.ts` - Auth state management
- [ ] `views/LoginForm.tsx` - Login UI
- [ ] `views/RegisterForm.tsx` - Registration UI

**Auth Flow**:
```
Register → Verify Email → Login → Store Tokens → Auto-Refresh
```

**Storage Keys**:
```
auth_access_token
auth_refresh_token
auth_id_token
auth_user (JSON)
```

**Acceptance Criteria**:
- [ ] Register with email/password
- [ ] Email verification code
- [ ] Login with device binding
- [ ] Token auto-refresh
- [ ] Logout clears tokens

---

## Phase 2: User Features

> Display and management features. Depends on Phase 1.

### #8 Report Views (02_modules/report)

**Tier**: T1 (Direct)
**Source**: `yorutsuke/app/src/components/MorningReport.tsx`

**Scope**:
- [ ] `headless/useReport.ts` - Report data fetching
- [ ] `views/ReportView.tsx` - Daily summary
- [ ] `views/ReportHistoryView.tsx` - History list

**Acceptance Criteria**:
- [ ] Display today's summary
- [ ] Category breakdown chart
- [ ] Transaction list with confirm/edit
- [ ] Cache reports in SQLite

---

### #9 Transaction Management (02_modules/transaction)

**Tier**: T2 (Logic)
**Source**: `yorutsuke/app/src/components/Transactions.tsx`

**Scope**:
- [ ] `headless/useTransactions.ts` - CRUD logic
- [ ] `views/TransactionList.tsx` - List view
- [ ] `views/TransactionEdit.tsx` - Edit form

**Acceptance Criteria**:
- [ ] List transactions with filters
- [ ] Edit transaction details
- [ ] Confirm AI suggestions
- [ ] Delete with confirmation

---

### #10 Settings Module (02_modules/settings)

**Tier**: T1 (Direct)
**Source**: `yorutsuke/app/src/components/Settings.tsx`

**Scope**:
- [ ] `adapters/settingsDb.ts` - SQLite settings
- [ ] `headless/useSettings.ts` - Settings logic
- [ ] `views/SettingsView.tsx` - Settings UI

**Settings Keys**:
```
user_name
notification_enabled
theme (light/dark)
language (ja/en)
```

**Acceptance Criteria**:
- [ ] Persist settings to SQLite
- [ ] Logout button
- [ ] Version display
- [ ] Debug info toggle

---

## Phase 3: Polish

### #11 i18n

**Tier**: T1 (Direct)

**Scope**:
- [ ] Setup i18next
- [ ] Japanese translations
- [ ] English translations

---

### #12 Error Recovery

**Tier**: T2 (Logic)

**Scope**:
- [ ] Circuit breaker (Pillar P)
- [ ] Graceful degradation
- [ ] Error boundaries

---

## Phase 4: Backend APIs

> Lambda functions for cloud functionality. Local-first works without these.

### #15 batch-process Lambda

**Tier**: T3 (Saga)
**Status**: ⚪ Not Started

**Scope**:
- [ ] EventBridge trigger (02:00 JST)
- [ ] S3 image → Bedrock Nova Lite OCR
- [ ] Parse OCR result → Transaction
- [ ] DynamoDB write with idempotency (Pillar Q)
- [ ] Error handling and retry

---

### #16 report Lambda

**Tier**: T1 (Direct)
**Status**: ⚪ Not Started

**Scope**:
- [ ] POST /report - Get daily report
- [ ] POST /report/history - Get recent reports
- [ ] Cognito JWT authentication

---

### #17 transactions Lambda

**Tier**: T2 (Logic)
**Status**: ⚪ Not Started

**Scope**:
- [ ] POST /transactions - Query with filters
- [ ] PUT /transactions/{id} - Update transaction
- [ ] DELETE /transactions/{id} - Delete transaction
- [ ] Pagination (cursor-based)
- [ ] Optimistic locking (Pillar F)

---

### #18 config Lambda

**Tier**: T1 (Direct)
**Status**: ⚪ Not Started

**Scope**:
- [ ] GET /config - App configuration
- [ ] SSM Parameter Store integration
- [ ] Maintenance mode support

---

### #19 quota Lambda

**Tier**: T1 (Direct)
**Status**: ⚪ Not Started

**Scope**:
- [ ] POST /quota - Check user quota
- [ ] DynamoDB query for daily count
- [ ] JST timezone handling

---

## Backlog (Post v1.0)

> Features deferred until core functionality is stable.

### Cloud Sync

**Tier**: T3 (Saga)
**Status**: ⚪ Not Started
**Depends on**: Batch processing returns AI results to client

**Scope**:
- [ ] Report Sync API (Lambda endpoint for fetching AI-processed reports)
- [ ] `headless/useReport.ts` - Report fetching with local cache
- [ ] Offline/Online sync logic (queue local changes, sync when online)
- [ ] Conflict resolution (local vs cloud)

**Why deferred**:
- Current local-first SQLite approach works for MVP
- Backend sync API not yet implemented
- Requires careful offline-first architecture design

---

### ~~Transaction Filters~~ ✅ Complete (#13)

**Tier**: T1 (Direct)

**Completed**:
- [x] Filter UI (date range, category, type) - `FilterBar.tsx`
- [x] Filter state in useTransactionLogic
- [x] Pure `filterTransactions()` function in domain layer
- [x] i18n translations (ja/en)

---

### ~~Report History~~ ✅ Complete (#14)

**Tier**: T1 (Direct)

**Completed**:
- [x] `views/ReportHistoryView.tsx` - Calendar + summaries
- [x] `views/CalendarView.tsx` - Date picker navigation
- [x] Monthly summary aggregation
- [x] i18n translations (ja/en)

---

## Version Milestones

| Version | Content | Status |
|---------|---------|--------|
| v0.1.0 | Phase 0 (Kernel) | ✅ Tagged |
| v0.2.0 | Phase 1 (Capture) | ✅ Tagged |
| v0.3.0 | Phase 2 (Features) | ✅ Tagged |
| v1.0.0 | Production Ready | ✅ Tagged |
| v1.1.0 | Backlog (#13-#14) | ✅ Tagged |
| v2.0.0 | Backend APIs (#15-#19) | ⚪ Pending |
| v2.1.0 | Cloud Sync | ⚪ Pending |

---

## References

- Source: `../yorutsuke/`
- Template: `../long-term-dev/templates/tauri/`
- Protocol: `.prot/CHEATSHEET.md`
