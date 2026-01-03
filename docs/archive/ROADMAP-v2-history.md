# Roadmap History (v2.0 - v2.1)

> Archived: 2026-01-03
> This file contains completed phases from the original ROADMAP.md

---

## Phase 0: Core Kernel (Complete)

> Foundation for all modules. No dependencies.

### #1 EventBus (00_kernel/eventBus)

**Tier**: T1 (Direct)
**Source**: `yorutsuke/app/src/utils/events.ts`

**Scope**:
- [x] `eventBus.ts` - Core emit/on API
- [x] `useAppEvent.ts` - React hook with cleanup
- [x] `types.ts` - Event type definitions

**Events implemented**:
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

---

### #2 SQLite + Migrations (00_kernel/storage)

**Tier**: T1 (Direct)
**Source**: `yorutsuke/app/src/db/connection.ts`

**Scope**:
- [x] `db.ts` - Connection management
- [x] `migrations.ts` - Schema versioning
- [x] `schema.sql` - Initial tables

---

### #3 Network Status (00_kernel/network)

**Tier**: T1 (Direct)
**Source**: `yorutsuke/app/src/hooks/useNetworkStatus.ts`

---

## Phase 1: Capture Pipeline (Complete)

### #4 Tauri Drag & Drop
### #5 Image Compression
### #6 Upload Queue
### #7 Auth (Cognito)

All completed with acceptance criteria met.

---

## Phase 2: User Features (Complete)

### #8 Report Views
### #9 Transaction Management
### #10 Settings Module

All completed.

---

## Phase 3: Polish (Complete)

### #11 i18n
### #12 Error Recovery

All completed.

---

## Phase 4: Backend APIs (Complete)

### #15 batch-process Lambda
### #16 report Lambda
### #17 transactions Lambda
### #18 config Lambda
### #19 quota Lambda

All Lambda functions deployed and functional.

---

## Backlog Items Completed

### #13 Transaction Filters - Complete
### #14 Report History - Complete

---

## Version Milestones Achieved

| Version | Date | Highlights |
|---------|------|------------|
| v0.1.0 | 2025-12-28 | Phase 0 (Kernel) |
| v0.2.0 | 2025-12-29 | Phase 1 (Capture) |
| v0.3.0 | 2025-12-29 | Phase 2 (Features) |
| v1.0.0 | 2025-12-29 | Production Ready |
| v1.1.0 | 2025-12-29 | Backlog (#13-#14) |
| v2.0.0 | 2025-12-29 | Backend APIs (#15-#19) |
| v2.1.0 | 2026-01-02 | Control Strategy improvements |
