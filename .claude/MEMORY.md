# Memory

## Current Context

Update at session end, read at session start.

- **Last Progress**: [2026-01-08] Completed MVP2 and Issue #101 (Admin Config API). Integrated dynamic model configuration for instant-processor.
- **Next Steps**: Implement remaining Batch processing Lambdas for MVP3.
- **Blockers**: None

## Architecture Decisions

Record important decisions with context.

### [2026-01-08] Hybrid Batch Cloud Processing (#96)
- **Decision**: Use a three-mode processing strategy (Instant, Batch, Hybrid) for Cloud OCR.
- **Trigger**: AWS Bedrock Batch Inference offers 50% discount but requires a minimum of 100 records and is asynchronous.
- **Strategy**: 
  - **Instant-Mode**: Real-time processing via On-Demand API (fast but full price).
  - **Batch-Mode**: Collective processing via Batch API (slow but 50% off).
  - **Hybrid-Mode**: Auto-switch to Instant-Mode if batch threshold (100) isn't met by configured timeout.
- **Impact**: Balanced UX (Morning reports always ready) with optimized operational cost.
- **Issue**: #96

### [2026-01-07] Architecture Documentation Refactoring (#94)
- **Decision**: Split monolithic ARCHITECTURE.md into atomic, focused documents
- **Trigger**: 1000+ line document was hard for AI to process and maintain
  docs/architecture/
  ├── README.md           # Navigation index
  ├── LAYERS.md           # Four-layer architecture
  ├── PATTERNS.md         # State patterns
  ├── FLOWS.md            # Data flow diagrams
  ├── MODELS.md           # Domain vs Storage models
  ├── STORES.md           # Zustand runtime state
  ├── STORAGE.md          # Local vs Cloud storage
  ├── SCHEMA.md           # Database table definitions
  └── ADR/                # Architecture Decision Records
  ```
- **Doc Modularization**: Also split `docs/tests/FRONTEND.md` and `docs/dev/PROGRAM_PATHS.md` into module-specific sub-documents for easier maintenance.
- **Benefits**:
  - AI can read single focused document instead of scanning 1000+ lines
  - Easier to maintain and update specific sections
  - ADRs capture "why" for key decisions
- **Issue**: #94

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

## Solved Issues

Problems encountered and their solutions.

### [2026-01-08] Admin Config API Implementation (#101)
- **Problem**: Need a way for admin to switch AI models and processing modes without redeploying code.
- **Solution**: 
  - Created `ControlTable` (DynamoDB) for settings.
  - Implemented `batch-config` Lambda with a public URL + CORS.
  - Updated `instant-processor` to dynamically fetch `modelId`.
- **Incident**: CDK deployment failed initially due to bootstrap version mismatch (needed v30) and resource collision (ControlTable already in AdminStack).
- **Fix**: Ran `cdk bootstrap` and used `Table.fromTableName` in main stack to shared the existing resource.

### [2026-01-06] SQLite "database is locked" Error
- **Problem**: Upload shows success briefly, then fails with "database is locked"
- **Root Cause**: Store updates trigger synchronous subscriptions that start new DB writes
  ```typescript
  // ❌ Wrong order - store update triggers subscription → new DB operation
  uploadStore.uploadSuccess(id);     // Triggers subscription → new DB operation
  await fileService.updateStatus();  // Conflicts with above → lock error
  ```
- **Solution**: IO-First Pattern - complete all DB operations before updating stores
  ```typescript
  // ✅ Correct order
  await fileService.updateStatus();  // DB write first
  uploadStore.uploadSuccess(id);     // Then notify UI
  ```
- **Prevention**: Added `.claude/rules/service-layer.md` with IO-First Pattern
- **Key Insight**: Zustand `subscribe()` callbacks run synchronously, not on next tick.

### [2026-01-07] Debug "Clear All Data" Freeze
- **Problem**: App became unresponsive after clicking "Clear All Data" in Debug panel.
- **Root Cause**:
  1. `clearAllData` was deleting the `settings` table, including `schema_version`.
  2. Post-reload, the App ran all migrations again (locking the DB).
  3. Race conditions between background service polling and DB deletion.
- **Solution**:
  1. Modified `clearAllData` to exclude `settings` table (preserving schema_version and preferences).
  2. Improved deletion order for child tables (transactions, etc.) to satisfy foreign keys.
  3. Optimized `DebugView` to explicitly stop services (`captureService.destroy()`) and clear memory stores before reloading.
- **Prevention**: Use `DELETE` on specific tables instead of broad wipes; ensure services are stopped before data resets.

### [2026-01-07] Paste Interaction Permission Error
- **Problem**: Pasteurizing images from clipboard failed with `fs.write_file not allowed`.
- **Solution**: Updated `app/src-tauri/capabilities/default.json` to include `fs:allow-write-file`, `fs:allow-read-file`, `fs:allow-exists`, and `fs:allow-remove-file`.
- **Knowledge**: High-level permission IDs like `fs:default` in Tauri 2.0 don't always cover specific write operations; explicit granular permissions are safer.
### [2026-01-07] Tauri 2 HTTP Fetch "Load failed"
- **Problem**: External HTTP requests (Lambda API calls) failed with "TypeError: Load failed"
- **Symptom**: Request never reached AWS Lambda (server logs empty), error was client-side
- **Root Cause**: Tauri 2 security model blocks native browser `fetch` for external URLs
- **Solution**: Import `fetch` from `@tauri-apps/plugin-http` instead of using native fetch
  ```typescript
  // ❌ Wrong
  const response = await fetch(url, { ... });

  // ✅ Correct
  import { fetch } from '@tauri-apps/plugin-http';
  const response = await fetch(url, { ... });
  ```
- **Files Fixed**: `quotaApi.ts`, `uploadApi.ts`
- **Prevention**: Added rule to `.claude/rules/tauri-stack.md`

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

## References

Key resources and links.

<!-- Format: Topic - Link/Path -->

## Best Practices

Lessons learned from this project.

<!-- Format: Scenario → Approach → Result -->
