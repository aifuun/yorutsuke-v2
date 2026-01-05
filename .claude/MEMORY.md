# Memory

## Current Context

Update at session end, read at session start.

- **Last Progress**: [2026-01-05] Reviewed docs/operations for consistency with architecture docs; identified rate limit discrepancy (10s vs 2s) and quota tier ambiguity
- **Next Steps**: Fix inconsistencies between ARCHITECTURE.md and QUOTA.md (rate limit, tier defaults)
- **Blockers**: None

## Architecture Decisions

Record important decisions with context.

### [2026-01-05] React = Dumb Display, Logic in Backend (#82)
- **Decision**: React should only subscribe to events and render; all orchestration logic belongs in pure modules
- **Trigger**: StrictMode race condition in `useDragDrop.ts` caused duplicate Tauri listeners
- **Problem**: Tauri event listeners were managed inside React `useEffect`, leading to:
  - Async race condition with cleanup
  - Two listener sets registered → duplicate image processing
  - Workaround needed (ignore flag pattern)
- **Correct Pattern**:
  ```
  App Startup → initService() (once, outside React)
       ↓ EventBus
  Pure Module → emit('event', data)
       ↓ EventBus subscription
  React Hook → useAppEvent('event') → update state
  ```
- **Benefits**:
  - No StrictMode issues (listeners initialized once)
  - True Pillar L compliance (React only subscribes)
  - Easier testing (pure modules)
- **TODO**: Refactor `useDragDrop.ts` to Service pattern after MVP1
- **Issue**: #82

### [2026-01-03] Mock Layer for UI Development
- **Decision**: Centralized mock configuration in `00_kernel/config/mock.ts`
- **Trigger**: `VITE_USE_MOCK=true` OR no Lambda URLs configured
- **Coverage**: quotaApi, uploadApi, reportApi
- **UI Indicator**: Orange banner at top when in mock mode
- **Docs**: Added to `docs/README.md` Development Modes section

### [2026-01-03] TraceId Lifecycle Implementation (Pillar N)
- **Decision**: Add traceId for per-receipt lifecycle tracking
- **Scope**: Tracks single receipt from drop → compress → duplicate check → upload → confirm
- **Generation**: Created at drop time in `tauriDragDrop.ts` with `trace-` prefix
- **Flow**:
  1. Drop → traceId assigned, `image:pending` emitted
  2. Compress → `image:compressing` emitted with traceId
  3. Duplicate Check → MD5 calculated, check database
  4. If duplicate → `image:duplicate` emitted
  5. If unique → `image:compressed` emitted, proceed to upload
  6. Upload → `upload:complete` or `upload:failed` with traceId
- **Key Distinction**:
  - `traceId`: Tracks single receipt lifecycle (Pillar N: Observability)
  - `intentId`: Idempotency for retries (Pillar Q: Idempotency)
- **Files Changed**:
  - `00_kernel/types/branded.ts`: Added TraceId type
  - `00_kernel/eventBus/types.ts`: Added traceId to all image/upload events
  - `01_domains/receipt/types.ts`: Added traceId to ReceiptImage
  - `02_modules/capture/types.ts`: Added traceId to DroppedItem
  - `02_modules/capture/adapters/tauriDragDrop.ts`: Generate traceId on drop
  - `02_modules/capture/adapters/imageDb.ts`: New adapter for SQLite operations
  - `02_modules/capture/headless/useCaptureLogic.ts`: Duplicate detection after compression

### [2026-01-03] Default Language Change
- **Decision**: Changed default language from Japanese to English
- **Files**: i18n/index.ts, migrations.ts, settingsDb.ts
- **Sync**: useSettings now syncs i18n language on load

### [2026-01-02] Admin Panel Implementation
- **Decision**: Independent React web app with Cognito auth
- **Scope**: 4 minimal pages (Dashboard, Control, Costs, Batch)
- **Auth**: Cognito User Pool with self-signup disabled
- **API**: API Gateway + Lambda with Cognito Authorizer (replaced IAM auth)
- **Hosting**: S3 + CloudFront
- **Why Cognito over IAM**: Browser-friendly JWT tokens, no SigV4 complexity
- **Resources**:
  - CloudFront: `d2m8nzedscy01y.cloudfront.net`
  - User Pool: `ap-northeast-1_INc3k2PPP`
  - Admin user: `admin@yorutsuke.local`

### [2025-01-01] Control Strategy Review
- **Analysis**: Reviewed runtime control flow for race conditions
- **Issues Found**:
  1. `processingRef` + FSM state dual tracking → potential race
  2. No explicit SQLite transactions → data integrity risk
  3. Stale closure in quota check → over-quota possible
  4. `emitSync` naming misleading → doesn't wait for handlers
- **Decisions**:
  - P1: Add `withTransaction()` wrapper for SQLite atomicity
  - P1: Remove `processingRef`, use FSM `currentId` as single source
  - P2: Single quota checkpoint (remove redundant checks)
  - P3: Add Intent-ID for idempotency (Pillar Q)
- **Documentation**: Updated `docs/ARCHITECTURE.md` with Control Strategy section

## Solved Issues

Problems encountered and their solutions.

### [2026-01-03] Capture Pipeline Core Bugs (#45-49)
- **#45 FAILURE blocks processing**: FSM entered 'error' state and never returned to 'idle'
  - Fix: Changed FAILURE reducer to return 'idle', store error per-image
- **#46 Quota not persisted**: In-memory count reset on app restart
  - Fix: Use `countTodayUploads(userId)` from SQLite instead of in-memory state
- **#47 Race condition**: UPLOAD_SUCCESS/FAILURE overwrote PAUSED state
  - Fix: Check `state.status === 'paused'` before returning to 'idle'
- **#48 Missing user_id**: Images had no user association for multi-user isolation
  - Fix: Added migration v3, userId filtering in all DB operations
- **#49 Orphaned files**: Compressed files remained when DB write failed
  - Fix: Track `compressedPath` and delete in catch block
- **Guest User Support**: Added `useEffectiveUserId` hook for guest-{deviceId} pattern
- **New Issue**: #56 for guest data migration on login (deferred)

### [2026-01-03] Missing transactions Table
- **Problem**: `no such table: transactions` error on first launch
- **Root Cause**: migrations.ts had `transactions_cache` but transactionDb.ts queried `transactions`
- **Solution**: Added `transactions` table to migrations, use shared `getDb()` in transactionDb

### [2026-01-03] Language Setting Not Syncing
- **Problem**: Settings showed 'ja' but UI displayed in English
- **Root Cause**: i18n initialized before settings loaded from SQLite
- **Solution**: Call `changeLanguage()` in useSettings after loading settings

### [2025-12-29] Image Drop Delay Issue
- **Problem**: In original project, dropped images took several seconds to appear in queue list
- **Root Cause**: `useImageQueue`'s async `loadHistory()` called `setItems(historyItems)` which overwrote newly added images
- **Solution**: When implementing View layer, use one of:
  1. Separate `historyItems` and `pendingItems` state, merge for display
  2. Use `useReducer` to ensure LOAD_HISTORY and ADD_PENDING are atomic
- **Prevention**: Avoid async initialization overwriting real-time state; history loading should append, not replace

### [2025-12-29] #5 Image Compression Strategy
- **Decision**: Grayscale + WebP 75% + max 1024px
- **Why Grayscale**: Reduces file size ~60% while maintaining OCR quality (receipts are mostly text)
- **MD5 Timing**: Calculate hash AFTER compression (on WebP bytes), not on original file
  - Same original image compressed twice = same hash (deterministic)
  - Deduplication works even if user re-drops the same image
- **Output Path**: Use temp dir (`std::env::temp_dir().join("yorutsuke-v2")`) for compressed files

### [2025-12-29] #6 Upload Queue FSM Design
- **State Machine**: `idle | processing | paused` (not boolean flags)
- **Error Classification**: Critical for retry logic
  - `network/server` → auto-retry with exponential backoff (1s, 2s, 4s)
  - `quota/unknown` → no retry, pause queue
- **Double Processing Prevention**: Use `processingRef: Set<string>` to track in-flight tasks
  - Problem: useEffect can trigger multiple times before state updates
  - Solution: Track processing tasks in a ref, not in state
- **Retry Cleanup**: Only remove from processingRef AFTER backoff delay, not immediately

### [2025-12-29] #7 Auth Flow Learnings
- **Three-Step Flow**: register → verify (email code) → login
  - After register: stay logged out (wait for verification)
  - After verify: stay logged out (user must login explicitly)
  - This avoids auto-login with unverified accounts
- **Device Binding**: Generate deviceId once, store in SQLite, send with every login
  - Enables: "Logged in from new device" notifications
  - Enables: Device-specific session revocation
- **Token Refresh Failure**: Auto-logout user (don't leave in broken authenticated state)
- **Initial State**: Start with `status: 'loading'` to check stored tokens on mount

## References

Key resources and links.

<!-- Format: Topic - Link/Path -->

## Best Practices

Lessons learned from this project.

<!-- Format: Scenario → Approach → Result -->
