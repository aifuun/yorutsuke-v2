# Memory

## Current Context

Update at session end, read at session start.

- **Last Progress**: [2026-01-03] Mock layer + UI improvements
- **Next Steps**: Test capture flow end-to-end with real API
- **Blockers**: None

## Architecture Decisions

Record important decisions with context.

### [2026-01-03] Mock Layer for UI Development
- **Decision**: Centralized mock configuration in `00_kernel/config/mock.ts`
- **Trigger**: `VITE_USE_MOCK=true` OR no Lambda URLs configured
- **Coverage**: quotaApi, uploadApi, reportApi
- **UI Indicator**: Orange banner at top when in mock mode
- **Docs**: Added to `docs/README.md` Development Modes section

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
