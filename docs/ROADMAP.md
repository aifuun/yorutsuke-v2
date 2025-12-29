# Roadmap

> yorutsuke-v2 Development Roadmap - Migration from yorutsuke

## Overview

| Phase | Focus | Issues | Status |
|-------|-------|--------|--------|
| **Phase 0** | Core Kernel | #1-#3 | 🔵 Not Started |
| **Phase 1** | Capture Pipeline | #4-#7 | ⚪ Blocked |
| **Phase 2** | User Features | #8-#10 | ⚪ Blocked |
| **Phase 3** | Polish | #11-#12 | ⚪ Blocked |

## Current State vs Target

| Component | yorutsuke | v2 Status | Priority | Phase |
|-----------|-----------|-----------|----------|-------|
| EventBus | ✅ useAppEvent | ❌ Missing | P0 | 0 |
| SQLite Migrations | ✅ db.ts | ❌ Missing | P0 | 0 |
| Network Status | ✅ useNetworkStatus | ❌ Missing | P0 | 0 |
| Drag & Drop | ✅ useTauriDragDrop | ❌ Missing | P0 | 1 |
| Image Compression | ✅ useImageProcessor | 🟡 Skeleton | P0 | 1 |
| Upload Queue | ✅ useUploadQueue | 🟡 Skeleton | P0 | 1 |
| Auth (Cognito) | ✅ useAuth | ❌ Missing | P1 | 1 |
| Morning Report | ✅ MorningReport | 🟡 Skeleton | P1 | 2 |
| Transactions | ✅ Transactions | 🟡 Skeleton | P1 | 2 |
| Settings | ✅ Settings.tsx | ❌ Missing | P2 | 2 |

Legend: ✅ Complete | 🟡 Skeleton | ❌ Missing

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

## Backlog (Post v1.0)

> Features deferred until core functionality is stable.

### Cloud Sync

**Tier**: T3 (Saga)
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

### Transaction Filters

**Tier**: T1 (Direct)

**Scope**:
- [ ] Filter UI (date range, category, type)
- [ ] Filter state in useTransactionLogic
- [ ] Persist filter preferences

**Why deferred**:
- Core CRUD works without filters
- Can be added incrementally

---

### Report History

**Tier**: T1 (Direct)

**Scope**:
- [ ] `views/ReportHistoryView.tsx` - Calendar/list of past reports
- [ ] Date picker navigation
- [ ] Monthly/weekly summary aggregation

**Why deferred**:
- Single day report works for MVP
- Requires more UI design decisions

---

## Version Milestones

| Version | Content | Target |
|---------|---------|--------|
| v0.1.0 | Phase 0 (Kernel) | - |
| v0.2.0 | Phase 1 (Capture) | - |
| v0.3.0 | Phase 2 (Features) | - |
| v1.0.0 | Production Ready | - |
| v1.1.0 | Cloud Sync + Filters | - |

---

## References

- Source: `../yorutsuke/`
- Template: `../long-term-dev/templates/tauri/`
- Protocol: `.prot/CHEATSHEET.md`
