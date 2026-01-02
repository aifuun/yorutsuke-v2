# ARCHITECTURE.md

> System architecture - How to organize

## Overview

**Architecture**: Local-First + Cloud-Sync
**Pattern**: AI_DEV_PROT v15 (Tauri + React + AWS CDK)
**Last Updated**: 2026-01-02

## System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Device                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Yorutsuke Desktop App                              │  │
│  │  ┌─────────────────┐           ┌─────────────────┐                    │  │
│  │  │  React Frontend │◄─────────►│  Tauri (Rust)   │                    │  │
│  │  │                 │    IPC    │  - Compression  │                    │  │
│  │  │  - UI/Views     │           │  - File I/O     │                    │  │
│  │  │  - Headless     │           │  - SQLite       │                    │  │
│  │  │  - Adapters     │           │                 │                    │  │
│  │  └─────────────────┘           └─────────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Cognito   │  │   Lambda    │  │     S3      │  │     DynamoDB        │ │
│  │   (Auth)    │  │  (Presign)  │  │  (Images)   │  │   (Transactions)    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                          │                                    ▲              │
│                          │ 02:00 JST                          │              │
│                          ▼                                    │              │
│                   ┌─────────────┐                             │              │
│                   │   Lambda    │─────────────────────────────┘              │
│                   │   (Batch)   │                                            │
│                   │  + Bedrock  │                                            │
│                   │  Nova Lite  │                                            │
│                   └─────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer Structure

### Frontend Layers (app/src/)

```
app/src/
├── 00_kernel/          # Infrastructure (no business logic)
│   ├── types/          # Branded types (UserId, ImageId, etc.)
│   ├── context/        # React Context (Auth, App state)
│   └── telemetry/      # Logging, error tracking
│
├── 01_domains/         # Pure business logic (no I/O, no UI)
│   ├── receipt/        # Receipt entity, status FSM, rules
│   └── transaction/    # Transaction entity, calculations
│
├── 02_modules/         # Feature modules
│   ├── capture/        # T2: Image capture & upload queue
│   │   ├── adapters/   # IPC + S3 API
│   │   ├── headless/   # useCaptureLogic
│   │   └── views/      # DropZone, Queue UI
│   ├── report/         # T1: Morning report display
│   │   ├── adapters/   # Report API
│   │   └── views/      # ReportView
│   └── transaction/    # T2: Transaction management
│       ├── adapters/   # SQLite DB
│       ├── headless/   # useTransactionLogic
│       └── views/      # TransactionView
│
└── 03_migrations/      # Data version upcasters
```

### Infrastructure Layer (infra/)

```
infra/
├── lib/
│   └── yorutsuke-stack.ts    # Main CDK stack
├── lambda/
│   ├── presign/              # S3 presigned URL generation
│   ├── batch/                # Nightly batch trigger
│   └── batch-process/        # Nova Lite OCR processing
└── bin/
    └── infra.ts              # CDK entry point
```

## Data Flow

### 1. Receipt Capture Flow

```
User drops image
      │
      ▼
┌─────────────────┐
│ Tauri: Compress │  WebP, < 100KB
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ SQLite: Save    │  status = 'pending'
│ images table    │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Lambda: Presign │  Get S3 upload URL
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ S3: Upload      │  status = 'uploaded'
└─────────────────┘
```

### 2. Nightly Batch Flow (02:00 JST)

```
EventBridge trigger
      │
      ▼
┌─────────────────┐
│ Check limits    │  ¥1,000/day, 50/user
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Scan S3 bucket  │  Today's uploads
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Bedrock: OCR    │  Nova Lite Vision
│ ~¥0.015/image   │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ DynamoDB: Write │  transactions table
└─────────────────┘
```

### 3. Morning Report Flow

```
App launch
      │
      ▼
┌─────────────────┐
│ Check local     │  transactions_cache
└─────────────────┘
      │ miss
      ▼
┌─────────────────┐
│ Fetch from API  │  Lambda → DynamoDB
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Cache locally   │  SQLite
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Render report   │  ReportView
└─────────────────┘
```

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop Framework | Tauri 2 | < 5MB app size, Rust performance |
| Frontend | React 19 | Familiar, good ecosystem |
| Local DB | SQLite | Offline-first, simple |
| Cloud Storage | S3 | Cost-effective, lifecycle rules |
| Cloud DB | DynamoDB | Serverless, pay-per-request |
| Auth | Cognito | Managed, secure |
| AI | Bedrock Nova Lite | Cheap (~¥0.015/image), good OCR |
| IaC | AWS CDK | TypeScript, type-safe |

## Module Tiers

| Module | Tier | Pattern | Complexity |
|--------|------|---------|------------|
| capture | T2 | View → Headless → Adapter | Queue management, FSM |
| report | T1 | View → Adapter | Simple fetch/render |
| transaction | T2 | View → Headless → Adapter | CRUD, confirmation flow |
| batch | T3 | Saga | Compensation, idempotency |

## Security

- **Auth**: Cognito JWT tokens
- **Data at rest**: S3 + DynamoDB encryption
- **Data in transit**: HTTPS only
- **CSP**: Strict content security policy
- **IAM**: Least privilege Lambda roles

## Cost Control

| Control | Limit | Enforcement |
|---------|-------|-------------|
| Global daily | ¥1,000 | Lambda hard stop |
| Per-user daily | 50 images | Quota check in presign |
| Rate limit | 1 image/10s | Frontend throttle |
| S3 lifecycle | 30 days | Auto-delete old images |

## Control Strategy

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Control Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Action                                                │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │  Reducer    │  ← Single source of truth (FSM State)      │
│  │  (FSM)      │     - status: idle|processing|paused       │
│  │             │     - currentId: active task               │
│  └─────────────┘     - tasks: task list                     │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │  Adapter    │  ← Boundary validation (Pillar B)          │
│  └─────────────┘                                            │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │  Storage    │  ← SQLite (local) / S3+DynamoDB (cloud)    │
│  └─────────────┘                                            │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │  EventBus   │  ← Cross-component notification            │
│  └─────────────┘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State Management Pattern

**Principle**: Single source of truth via FSM reducer

```typescript
// FSM State - no boolean flag pairs
type QueueState =
  | { status: 'idle'; tasks: Task[] }
  | { status: 'processing'; tasks: Task[]; currentId: ImageId }
  | { status: 'paused'; tasks: Task[]; reason: 'offline' | 'quota' };

// Reducer handles all state transitions atomically
function reducer(state: QueueState, action: Action): QueueState {
  switch (action.type) {
    case 'START_UPLOAD':
      return { status: 'processing', tasks: [...], currentId: action.id };
    // ...
  }
}
```

**Rules**:
- Use `useReducer` for complex state (not multiple `useState`)
- State transitions only via `dispatch`
- No external refs for tracking (avoid dual source of truth)
- Impossible states should be unrepresentable

### Concurrency Control

#### 1. Database Transactions

SQLite operations should use explicit transactions for atomicity:

```typescript
// Recommended pattern
export async function withTransaction<T>(
  fn: (db: Database) => Promise<T>
): Promise<T> {
  const database = await getDb();
  await database.execute('BEGIN TRANSACTION');
  try {
    const result = await fn(database);
    await database.execute('COMMIT');
    return result;
  } catch (e) {
    await database.execute('ROLLBACK');
    throw e;
  }
}
```

#### 2. Upload Queue Processing

Sequential processing with FSM guards:

```typescript
// Only process when idle
if (state.status !== 'idle') return;

// Mark as processing before async work
dispatch({ type: 'START_UPLOAD', id: task.id });

try {
  await uploadToS3(...);
  dispatch({ type: 'UPLOAD_SUCCESS', id: task.id });
} catch (e) {
  dispatch({ type: 'UPLOAD_FAILURE', id: task.id, error: e });
}
```

#### 3. Quota Enforcement

Multi-layer defense with single authoritative checkpoint:

| Layer | Location | Type | Data Source | Purpose |
|-------|----------|------|-------------|---------|
| Frontend | `useCaptureLogic.ts` | Soft/UX | Local queue | Fast feedback |
| Frontend | `useUploadQueue.ts` | Soft/UX | Local queue | Prevent wasted API calls |
| **Lambda** | `presign/index.mjs` | **HARD** | DynamoDB | Authoritative enforcement |
| Lambda | `quota/index.mjs` | Info | DynamoDB | Query API for frontend sync |

**Design Rationale**:
- Frontend checks may be stale (wrong day, cached count) - acceptable for UX hints
- Lambda presign is the single authoritative checkpoint (increments quota atomically)
- Quota Lambda allows frontend to refresh local understanding on demand

**Stale Closure Note**: Frontend quota check in `useUploadQueue` reads `state.tasks` which
may be stale in async context. This is acceptable because Lambda is authoritative.

### Event Bus

Type-safe cross-component communication:

```typescript
// Emit event (fire-and-forget)
emit('upload:complete', { id, s3Key });

// Subscribe to event
const unsubscribe = on('upload:complete', (data) => {
  // Handle event
});
```

**Event Types**:

| Event | Trigger | Listeners |
|-------|---------|-----------|
| `upload:complete` | S3 upload success | Transaction sync |
| `upload:failed` | S3 upload failure | Error UI |
| `network:changed` | Connectivity change | Queue pause/resume |

### Known Issues & Improvements

#### Resolved Issues

| Issue | Location | Resolution | Date |
|-------|----------|------------|------|
| processingRef + state dual tracking | `useUploadQueue.ts` | Added 'retrying' FSM state, removed processingRef | 2026-01-02 |
| No explicit DB transactions | `db.ts` | Added `withTransaction()` wrapper | 2026-01-02 |
| Stale closure in quota check | `useUploadQueue.ts` | Documented as acceptable (Lambda is authoritative) | 2026-01-02 |
| emitSync misleading name | `eventBus.ts` | Renamed to `broadcast` | 2026-01-02 |

#### Improvement Roadmap

**P1 - Data Integrity**: ✅ Complete
- [x] Add `withTransaction()` wrapper to db.ts (#24)
- [x] Remove `processingRef`, use FSM `currentId` instead (#25)

**P2 - Reliability**: ✅ Complete
- [x] Document quota checkpoint strategy (#27)
- [x] Rename `emitSync` to `broadcast` (#26)

**P3 - Robustness**: In Progress
- [x] Add Intent-ID for idempotency (Pillar Q) (#28) - 2026-01-02
- [ ] Add request-response pattern to EventBus (#29)

## References

- Schema: `./SCHEMA.md`
- Interfaces: `./INTERFACES.md`
- AI_DEV_PROT: `.prot/CHEATSHEET.md`
