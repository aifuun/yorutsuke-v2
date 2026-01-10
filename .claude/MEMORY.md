# Memory

Long-term project knowledge. Session context comes from `git log` + `gh issue list`.

## Architecture Decisions

Record important decisions with context.

### [2026-01] Transaction Cloud Sync (#108)
- **Decision**: Implemented pull-only cloud-to-local transaction sync with conflict resolution
- **Trigger**: Transactions processed in cloud (Lambda → DynamoDB) but app reads from local SQLite; gap broke "local-first" promise
- **Architecture**:
  - **transactionApi.ts**: Cloud API adapter (DynamoDB via Lambda)
  - **syncService.ts**: Orchestration with conflict resolution
  - **useSyncLogic.ts**: FSM-based headless hook (`idle | syncing | success | error`)
  - **transactionSyncService.ts**: Global service listening to `upload:complete` events
  - **Migration v6**: Added `status` and `version` columns to transactions table
- **Conflict Resolution Strategy**:
  1. Local confirmed > Cloud timestamp (user manual confirmation is highest authority)
  2. Cloud updatedAt > Local updatedAt → Cloud wins (newer data)
  3. Local updatedAt > Cloud updatedAt → Local wins (local edits)
  4. Same updatedAt → Cloud wins (default to source of truth)
- **Auto-Sync Triggers**:
  - **On mount**: If last sync > 5 minutes ago
  - **After upload**: 3 seconds after image upload completes (allow Lambda processing time)
  - **Manual**: User clicks "Sync" button in TransactionView header
- **Key Design Decisions**:
  - **Pull-only**: Cloud is source of truth; no push to cloud (future: MVP5 bidirectional)
  - **No pagination**: Fetch all user transactions (acceptable for <100 tx; future: pagination if >1000)
  - **Debounced**: Multiple uploads trigger single sync (3s delay after last upload)
  - **Idempotent**: Safe to retry; uses `upsertTransaction()` for conflict-free merging
- **Pillar Compliance**:
  - **A (Nominal Types)**: TransactionId, UserId branded types
  - **B (Airlock)**: Zod validation on all API responses
  - **D (FSM)**: Explicit states in useSyncLogic
  - **L (Headless)**: Logic in hooks, UI in views
  - **Q (Idempotency)**: Sync is safe to retry
  - **R (Observability)**: JSON semantic logs for all sync events
- **Testing**: 17 unit tests + 9 integration tests covering all conflict scenarios
- **Critical Bugs Fixed**:
  - **BUG-003 - Foreign Key Constraint**: `FOREIGN KEY (image_id) REFERENCES images(id)` prevented syncing transactions when source images didn't exist locally (30-day TTL, other devices, guest→user migration). Solution: Migration v7 drops FK, keeps `image_id` as soft reference
  - **BUG-004 - Date Filter**: Default "This Month" filter hid all historical test data (2018-2025). Solution: Changed default to "All"
- **Files**:
  - `app/src/02_modules/transaction/adapters/transactionApi.ts` (new)
  - `app/src/02_modules/transaction/services/syncService.ts` (new)
  - `app/src/02_modules/transaction/services/transactionSyncService.ts` (new)
  - `app/src/02_modules/transaction/headless/useSyncLogic.ts` (new)
  - `app/src/02_modules/transaction/views/TransactionView.tsx` (updated)
  - `app/src/00_kernel/storage/migrations.ts` (migration v6, v7)
  - `app/src/main.tsx` (service initialization)

### [2026-01] Phase 2 Design System - Component Library (#126-131, #108)
- **Decision**: Implemented complete component library based on Material Design 3 (70%) + Yorutsuke pragmatism (30%)
- **Trigger**: Issues #126-131 documentation complete, ready for implementation phase
- **Scope**: Full Component Library (~18h implementation)
- **Architecture Decisions**:
  - **Toast System**: Zustand vanilla store (consistent with existing architecture)
  - **Modal System**: Individual modals (YAGNI principle, no global manager)
  - **Component Pattern**: Co-located CSS (.tsx + .css files), explicit exports via index.ts
  - **State Management**: FSM pattern (no boolean flags), Zustand vanilla stores
- **Components Implemented** (45 files):
  1. **Foundation**: .sr-only utility, Spinner (3 sizes), Skeleton (pulse animation)
  2. **Toast System**: toastStore (Zustand), Toast (4 variants), ToastContainer (Portal), useToast hook
  3. **Button**: 4 variants (primary/secondary/ghost/danger), 3 sizes, icon support, loading state
  4. **Modal**: 3 sizes, focus trap (Tab cycles), Escape/overlay close, ARIA attributes
  5. **Forms**: Input (password toggle), Select (custom arrow), Textarea (char count), Checkbox, Radio + RadioGroup (arrow navigation)
  6. **States**: EmptyState (3 variants, role="status"), ErrorState (retry button, role="alert")
  7. **Progress**: Linear bar, 3 variants, indeterminate mode, ARIA progressbar
  8. **Integration**: Barrel export (components/index.ts), all CSS imported in main.tsx
- **Design Specifications** (7 docs, 4850+ lines):
  - BUTTONS.md, FORMS.md, FEEDBACK.md, STATES.md, ACCESSIBILITY.md, ICONS.md, DATA-VIZ.md
- **Key Features**:
  - All components use design tokens (no hardcoded values)
  - WCAG 2.1 Level AA compliance (color contrast, keyboard nav, ARIA)
  - Mobile responsive (768px breakpoint)
  - prefers-reduced-motion support
  - Keyboard accessible (Tab, Enter, Space, Escape, Arrow keys)
  - Focus indicators (2px outline, 2px offset)
- **Bundle Impact**:
  - CSS: +1KB (15.94KB → 17.24KB gzipped)
  - JS: No change (185.54KB gzipped)
  - Build time: 1.34s
- **Files**:
  - `app/src/components/` (45 new files: Button, Input, Select, Textarea, Checkbox, Radio, Modal, Toast, EmptyState, ErrorState, Progress, Spinner, Skeleton)
  - `app/src/components/index.ts` (barrel export)
  - `app/src/main.tsx` (CSS imports)
  - `app/src/App.tsx` (ToastContainer)
  - `app/src/styles.css` (removed .btn, added .sr-only)
  - `docs/design/` (7 specifications)
  - `app/src/App.tsx` (userId propagation)
- **Issue**: #108 (completed 2026-01-09)
- **Next Steps**: Issue #109 - Transaction Management UX (images, sorting, pagination, soft delete)

### [2026-01] Border Radius Migration - Complete Standardization (#122)
- **Decision**: Migrated all hardcoded border-radius values to design tokens + added stylelint enforcement
- **Trigger**: Issue #122 (RADIUS.md) completed documentation, migration needed for consistency
- **Scope**: 71+ occurrences across 12 CSS files
- **Migration Mapping**:
  - 4px → var(--radius-xs) - Tags, badges, small elements
  - 6px → var(--radius-sm) - Legacy web design (optional)
  - 8px → var(--radius-md) - Buttons, inputs, small cards
  - 12px → var(--radius-lg) - Cards, modals, containers
  - 16px → var(--radius-xl) - Large cards, hero sections
  - 24px → var(--radius-2xl) - Hero cards (Yorutsuke signature)
  - 9999px → var(--radius-full) - Pills, circular elements
- **stylelint Enforcement**:
  - Added `declaration-property-value-disallowed-list` rule
  - Prevents hardcoded px/rem/em values in border-radius
  - Allows CSS variables (var(--radius-*)) and percentages (50%)
- **Impact**:
  - Consistency: 100% of border-radius values now use design tokens
  - Prevention: stylelint catches new hardcoded values in pre-commit
  - Bundle size: +1KB CSS gzipped (minimal, worth the maintainability)
  - Build time: 1.43s (no performance impact)
- **Files Modified** (71 occurrences):
  - Sidebar.css (2), styles.css (22), report.css (7), dashboard.css (5)
  - ledger.css (11), settings.css (7), capture.css (4), debug.css (3)
  - confirm-dialog.css (3), QuotaIndicator.css (2), ImageLightbox.css (2), Pagination.css (1)
- **Verification**:
  - ✅ stylelint: 0 errors (all hardcoded values migrated)
  - ✅ Build: Success (1.43s)
  - ✅ Type check: Passed
  - ✅ New components: 100% using tokens from day 1
- **M3 Adoption**: 85% (6/7 scales directly from M3, 2 adjustments for brand/web standards)
- **Issue**: #122 (completed 2026-01-10)

### [2026-01-09] Claude Code Commands Optimization (#105)
- **Decision**: Comprehensive restructuring of .claude/commands/ directory for consistency, maintainability, and AI effectiveness
- **Trigger**: 19 command files had inconsistent formats, duplicate content, and no metadata structure
- **Four-Phase Approach**:
  1. **Standardization**: Created command-template.md; added YAML frontmatter to all 17 commands
  2. **Consolidation**: Merged save→sync, diff→status; extracted 3 shared patterns (git-workflow, pillar-reference, command-template)
  3. **Streamline**: Reduced next.md (-43%), scaffold.md (-49%), tier.md (-40%); moved examples to separate files
  4. **Enhancements**: Added parameter docs, command chaining, context-aware approve.md, Related sections to all commands
- **Results**:
  - 19 files → 17 files (-11%)
  - 100% standardized with YAML frontmatter
  - Git workflow duplication: 9 copies → 3 references (-89%)
  - Created `.claude/patterns/` for shared content
  - All commands now have cross-references (Related sections)
- **Key Patterns**:
  - **Command Chaining**: Commands suggest next logical step (*issue close → *sync, *cdk diff → *approve)
  - **Context-Aware Approve**: Detects previous command and executes appropriate action
  - **Minimal Frontmatter**: Only name, category, requires, aliases (no verbose metadata)
  - **@-References**: Consistent path references to patterns/templates/rules
- **Backward Compatibility**: Preserved aliases (*save → *sync --ask --memory, *diff → *status --diff)
- **Files**:
  - All 17 commands in `.claude/commands/`
  - `.claude/patterns/` (command-template, git-workflow, pillar-reference)
  - `.claude/workflow/examples/next-command.md`
- **Issue**: #105

### [2026-01-09] Workflow Documentation Restructure
- **Decision**: Reorganized workflow documentation into layered structure with Two-Step Planning methodology
- **Trigger**: Need for clearer planning process and better separation between strategic (MVP) and tactical (Feature) planning
- **Structure**:
  - `.claude/WORKFLOW.md` → Main index and cheatsheet (entry point)
  - `.claude/rules/workflow.md` → Core principles (three-layer architecture: MVP → Issues → TODO)
  - `.claude/workflow/planning.md` → Two-Step Planning detailed guide
  - `.claude/workflow/templates/` → Planning templates (mvp-decomp, feature-plan, test-cases)
- **Two-Step Planning Methodology**:
  1. **Step 1 (MVP-Level, ~40 min)**: Analyze MVP goals → Create rough GitHub Issues → Build dependency graph
  2. **Step 2 (Feature-Level, 1-2h)**: Just-in-time detailed planning per feature → Dev Plan + Test Cases before implementation
- **Benefits**:
  - Avoids upfront over-planning (learn from previous features)
  - Separates strategic roadmap from tactical implementation
  - Templates provide consistency without duplication
- **Cleanup**: Renamed `INBOX.md` → `QUICK-NOTES.md` for clarity; moved clarified questions to inbox/
- **Files**:
  - `.claude/WORKFLOW.md` (index)
  - `.claude/rules/workflow.md` (three-layer architecture)
  - `.claude/workflow/planning.md` (two-step guide)
  - `CLAUDE.md` (updated references)

### [2026-01-09] AI_DEV_PROT v15 Review: batch-orchestrator Against 18 Pillars
- **Decision**: Conducted comprehensive pillar review of batch-orchestrator Lambda implementation
- **Method**: Read all 18 pillar checklists (.prot/pillar-a..r); mapped against Lambda code
- **Findings**:
  - **Strong (5 pillars)**: O(Async), R(Observability), B(Schema), G(Traceability), I(Firewalls)
  - **Critical gaps (3 pillars, now fixed)**:
    1. **Pillar Q (Idempotency)**: Missing `intentId` + no duplicate prevention → risk of duplicate Bedrock jobs
    2. **Pillar B (Input Parsing)**: Hard-coded `event` parsing → fails with API Gateway `event.body`
    3. **Pillar O (Async API)**: No `statusUrl` for polling → clients blind on job status
  - **Medium gaps (2 pillars, deferred)**: S3 manifest lookup inefficient; tests/logging sparse
- **Fixes Implemented** (Pillar Q + B + O):
  - ✅ Added `intentId: string` to input schema (required field)
  - ✅ Implemented `checkIdempotency()` with DynamoDB conditional check → cached response on retry
  - ✅ Fixed parsing: prefer `event.body` (string/JSON) → fallback to `event` (direct invoke)
  - ✅ Added `statusUrl` + `estimatedDuration` to response (Pillar O async pattern)
  - ✅ Changed batch-jobs table PK: `jobId` → `intentId` (idempotency key)
  - ✅ Added `jobId` GSI for reverse lookup
  - ✅ Processing marker prevents concurrent duplicates (Pillar F: CAS)
- **Semantic**: Client generates `intentId` once per user action; same `intentId` on retry returns cached `jobId`
- **Key Learning**: Pillar Q is **critical for any T3 operation** (payment, saga, async workflows); missing it is production bug
- **Pillar Usage Pattern**: Use CHEATSHEET.md as quick ref; drill into specific pillar checklist only when implementing/reviewing that area
- **Files**:
  - `infra/lambda/batch-orchestrator/index.mjs` (schema, parsing, idempotency, statusUrl)
  - `infra/lib/yorutsuke-stack.ts` (table PK change, GSI, env var)
  - `.claude/batch-orchestrator-PILLAR-FIXES.md` (detailed summary)

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
