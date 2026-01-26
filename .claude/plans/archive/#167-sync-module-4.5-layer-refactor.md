# Feature Plan: Issue #167 - Sync Module 4.5-Layer Refactor

**Issue**: #167
**Title**: Refactor Sync Module to Add Adapter Layer (Fix Firewall Violation)
**Type**: Architecture Refactor (T2)
**Created**: 2026-01-22
**Status**: Planning

---

## 1. Problem Statement

### Current State (Pillar I Violation)

The Sync module violates **Pillar I (Firewalls)** by directly importing adapters from Transaction and Capture modules:

```typescript
// ❌ VIOLATION: Direct deep imports bypass module boundaries
import * as transactionDb from '../../transaction/adapters/transactionDb';
import * as transactionApi from '../../transaction/adapters/transactionApi';
import { fetchTransactionsFromCloud, upsertTransaction } from '../../transaction/adapters';
import { checkFileExists } from '../../transaction/adapters';
```

**Files with violations**:
- `services/transactionPushService.ts` (lines 18-19)
- `services/transactionPullService.ts` (line 9)
- `services/recoveryService.ts` (direct transaction adapter imports)
- `services/imageSyncService.ts` (direct transaction adapter imports)

### Why This Is a Problem

1. **Tight Coupling**: Sync module is tightly coupled to internal implementation of Transaction/Capture modules
2. **Fragile Architecture**: Changes in Transaction adapters break Sync module
3. **No Firewall**: Violates Pillar I - modules should only depend on public exports
4. **Maintainability**: Hard to test, hard to evolve independently

### Incomplete 4.5-Layer Structure

Current sync module structure:
```
sync/
├── stores/          ✅ Layer 2: Vanilla Zustand stores
├── services/        ✅ Layer 2: Business logic
├── hooks/           ✅ Layer 1.5: React bridge (single hook)
├── components/      ✅ Layer 1: Views (SyncStatusIndicator, RecoveryPrompt)
├── utils/           ⚠️ Infrastructure (networkMonitor, syncQueue)
└── adapters/        ❌ MISSING - No adapter layer!
```

**Missing pieces** per ADR-020 and Debug module pattern:
- ❌ No `adapters/` directory
- ❌ No wrapper adapters for transaction/capture dependencies
- ❌ Incomplete Hook Bridge (only 1 hook, missing state hooks)
- ⚠️ Components mixed with services (should use hooks)

---

## 2. Target Architecture (ADR-020 Compliant)

### 2.1 Complete 4.5-Layer Structure

```
sync/
├── adapters/                    # ✅ NEW: Layer 3 (Adapter)
│   ├── transactionSyncAdapter.ts   # Wraps transaction adapters
│   ├── imageSyncAdapter.ts         # Wraps image adapters
│   └── index.ts                     # Public exports
│
├── stores/                      # ✅ Layer 2: Vanilla Zustand stores
│   ├── syncStore.ts                # Network, queue, lastSyncedAt
│   └── index.ts
│
├── services/                    # ✅ Layer 2: Business logic
│   ├── transactionPushService.ts   # Push: Local → Cloud
│   ├── transactionPullService.ts   # Pull: Cloud → Local
│   ├── imageSyncService.ts         # Image synchronization
│   ├── recoveryService.ts          # Startup recovery
│   ├── autoSyncService.ts          # Auto-sync orchestration
│   ├── manualSyncService.ts        # Manual sync orchestration
│   └── syncCoordinator.ts          # Full bidirectional sync
│
├── hooks/                       # ✅ Layer 1.5: Hook Bridge (React)
│   ├── useSyncState.ts             # NEW: State hooks (Connector/Selector)
│   ├── useSyncTrigger.ts           # Existing: Auto-sync on mount
│   └── index.ts
│
├── views/                       # ✅ Layer 1: Pure React components
│   ├── SyncStatusIndicator.tsx     # Moved from components/
│   ├── RecoveryPrompt.tsx          # Moved from components/
│   └── index.ts
│
├── utils/                       # Infrastructure
│   ├── networkMonitor.ts
│   └── syncQueue.ts
│
└── index.ts                     # Public API
```

### 2.2 Adapter Layer Design

**Purpose**: Wrap external dependencies, create firewall boundary

#### transactionSyncAdapter.ts
```typescript
// Wraps transaction module adapters for sync operations
export async function fetchDirtyTransactions(userId: UserId): Promise<Transaction[]> {
  return transactionDb.fetchDirtyTransactions(userId);
}

export async function clearDirtyFlags(ids: TransactionId[]): Promise<void> {
  return transactionDb.clearDirtyFlags(ids);
}

export async function syncTransactionsToCloud(
  userId: UserId,
  transactions: Transaction[]
): Promise<SyncResult> {
  return transactionApi.syncTransactions(userId, transactions);
}

export async function fetchTransactionsFromCloud(
  userId: UserId,
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  return transactionApi.fetchTransactions(userId, { startDate, endDate });
}

export async function fetchLocalTransactions(
  userId: UserId,
  options: FetchOptions
): Promise<Transaction[]> {
  return transactionDb.fetchTransactions(userId, options);
}

export async function upsertLocalTransaction(tx: Transaction): Promise<void> {
  return transactionDb.upsertTransaction(tx);
}
```

#### imageSyncAdapter.ts
```typescript
// Wraps image-related adapters for sync operations
export async function checkImageExists(filePath: string): Promise<boolean> {
  return imageDb.checkFileExists(filePath);
}

export async function downloadImageFromS3(
  imageId: ImageId,
  userId: UserId
): Promise<string> {
  return imageApi.downloadFromS3(imageId, userId);
}

export async function saveImageMetadata(
  imageId: ImageId,
  metadata: ImageMetadata
): Promise<void> {
  return imageDb.saveMetadata(imageId, metadata);
}
```

### 2.3 Hook Bridge Layer Enhancement

Per **ADR-020**, Hook Bridge has three identities:

#### Identity 1: Connector (连接器)
```typescript
// hooks/useSyncState.ts - Subscribe to syncStore
export function useSyncStatus(): SyncStatus {
  return useStore(syncStore, (s) => s.status);
}

export function useIsOnline(): boolean {
  return useStore(syncStore, (s) => s.isOnline);
}

export function useLastSyncedAt(): string | null {
  return useStore(syncStore, (s) => s.lastSyncedAt);
}

export function usePendingCount(): number {
  return useStore(syncStore, (s) => s.queue.length);
}
```

#### Identity 2: Selector (选择器)
```typescript
// Returns primitives only (ADR-012 compliance)
export function useIsSyncing(): boolean {
  return useStore(syncStore, (s) => s.status === 'syncing');
}

export function useHasError(): boolean {
  return useStore(syncStore, (s) => s.status === 'error');
}

export function useSyncError(): string | null {
  return useStore(syncStore, (s) => s.lastError);
}
```

#### Identity 3: Orchestrator (编排器)
```typescript
// Coordinates multiple services, UI-specific logic
export function useSyncActions() {
  const userId = useUserId(); // From auth context

  const triggerFullSync = useCallback(async () => {
    if (!userId) return;
    await manualSyncService.sync(userId);
  }, [userId]);

  const triggerPushSync = useCallback(async () => {
    if (!userId) return;
    await pushTransactions(userId);
  }, [userId]);

  return { triggerFullSync, triggerPushSync };
}
```

### 2.4 Service Layer Updates

Services will use adapter layer instead of direct imports:

```typescript
// ✅ AFTER: Use sync adapters
import {
  fetchDirtyTransactions,
  clearDirtyFlags,
  syncTransactionsToCloud,
} from '../adapters/transactionSyncAdapter';

// ❌ BEFORE: Direct imports (violation)
import * as transactionDb from '../../transaction/adapters/transactionDb';
import * as transactionApi from '../../transaction/adapters/transactionApi';
```

---

## 3. Implementation Steps

### Step 1: Create Adapter Layer (3-4 hours)

**Goal**: Add firewall boundary between sync and transaction/capture modules

**Tasks**:
1. Create `adapters/` directory
2. Create `transactionSyncAdapter.ts`
   - Wrap all transaction DB operations used by sync
   - Wrap all transaction API operations used by sync
   - Export typed interfaces
3. Create `imageSyncAdapter.ts`
   - Wrap image DB operations used by sync
   - Wrap image API operations (S3 downloads)
4. Create `adapters/index.ts` with public exports
5. Write unit tests for adapter wrappers

**Acceptance Criteria**:
- [ ] `adapters/transactionSyncAdapter.ts` wraps all transaction dependencies
- [ ] `adapters/imageSyncAdapter.ts` wraps all image dependencies
- [ ] No direct imports from `../../transaction/` or `../../capture/`
- [ ] All adapter functions have type signatures
- [ ] Unit tests verify adapter calls delegate correctly

### Step 2: Refactor Services to Use Adapters (2-3 hours)

**Goal**: Remove all Pillar I violations from services

**Tasks**:
1. Update `transactionPushService.ts`
   - Replace `transactionDb.*` with adapter calls
   - Replace `transactionApi.*` with adapter calls
2. Update `transactionPullService.ts`
   - Replace direct transaction adapter imports with sync adapters
3. Update `recoveryService.ts`
   - Replace direct transaction DB imports
4. Update `imageSyncService.ts`
   - Replace direct image adapter imports
5. Verify all imports use `../adapters/` path
6. Run existing tests to verify no regressions

**Acceptance Criteria**:
- [ ] No `import from '../../transaction/adapters'` in any service file
- [ ] No `import from '../../capture/adapters'` in any service file
- [ ] All existing tests pass
- [ ] No change in runtime behavior

### Step 3: Enhance Hook Bridge Layer (2-3 hours)

**Goal**: Complete Hook Bridge per ADR-020 (three identities)

**Tasks**:
1. Create `hooks/useSyncState.ts` with primitive selectors:
   - `useSyncStatus()`: SyncStatus
   - `useIsOnline()`: boolean
   - `useLastSyncedAt()`: string | null
   - `usePendingCount()`: number
   - `useIsSyncing()`: boolean
   - `useHasError()`: boolean
   - `useSyncError()`: string | null
2. Create `syncActions` object for orchestration:
   - `triggerFullSync(userId)`
   - `triggerPushSync(userId)`
   - `triggerPullSync(userId)`
   - `retryQueue(userId)`
3. Update `hooks/index.ts` to export new hooks
4. Write hook tests (React Testing Library)

**Acceptance Criteria**:
- [ ] All hooks return primitives (ADR-012 compliance)
- [ ] No object selectors `(s) => ({ a: s.a, b: s.b })`
- [ ] Actions delegate to services, no business logic
- [ ] Hook tests verify selector returns

### Step 4: Refactor Views to Use Hooks (1-2 hours)

**Goal**: Components use Hook Bridge, not direct store access

**Tasks**:
1. Move `components/` → `views/`
2. Update `SyncStatusIndicator.tsx`:
   - Replace `useSyncStore((s) => ...)` with individual hooks
   - Use `useIsOnline()`, `usePendingCount()`, etc.
   - Remove object selectors
3. Update `RecoveryPrompt.tsx`:
   - Use `syncActions` for user actions
4. Update component tests
5. Update module exports in `index.ts`

**Acceptance Criteria**:
- [ ] No direct `useStore(syncStore, ...)` in components
- [ ] All components use hooks from `hooks/useSyncState.ts`
- [ ] No infinite loop warnings (object selector bugs)
- [ ] Component tests pass

### Step 5: Update Module Public API (30 min)

**Goal**: Clean public API following Debug module pattern

**Tasks**:
1. Update `sync/index.ts`:
   - Export hooks from Hook Bridge
   - Export views (not "components")
   - Export adapters (for advanced usage)
   - Export stores (for framework-agnostic usage)
   - Export services (for orchestration)
2. Add JSDoc comments for public API
3. Verify no internal files exported

**Acceptance Criteria**:
- [ ] `index.ts` follows Debug module export pattern
- [ ] Public API clearly organized by layer
- [ ] TypeScript exports resolve correctly
- [ ] No breaking changes for existing consumers

### Step 6: Documentation & Testing (1-2 hours)

**Goal**: Document new architecture, ensure quality

**Tasks**:
1. Update `docs/architecture/LAYERS.md`:
   - Add Sync module to Layer 1.5 examples
2. Update `docs/architecture/PATTERNS.md`:
   - Reference Sync as Hook Bridge example
3. Create integration tests:
   - Full sync flow (push + pull)
   - Adapter layer boundary validation
   - Hook state updates
4. Update existing tests for new structure
5. Run full test suite

**Acceptance Criteria**:
- [ ] LAYERS.md documents Sync module structure
- [ ] Integration tests cover adapter boundaries
- [ ] All unit tests pass
- [ ] No test coverage regression

---

## 4. Testing Strategy

### 4.1 Unit Tests

**Adapter Layer**:
- Mock underlying transaction/image adapters
- Verify wrapper functions delegate correctly
- Test error propagation

**Hook Layer**:
- Use React Testing Library
- Verify selectors return primitives
- Test actions call services correctly

**Service Layer**:
- Mock adapters (not transaction adapters directly)
- Verify business logic unchanged
- Test IO-First pattern compliance

### 4.2 Integration Tests

**Sync Flow**:
- Full bidirectional sync (push + pull)
- Offline queue processing
- Conflict resolution
- Network status handling

**Adapter Boundary**:
- Verify no direct transaction adapter imports
- Test adapter layer isolates changes
- Mock transaction module entirely

### 4.3 Manual Testing

**UI Components**:
- SyncStatusIndicator shows correct state
- RecoveryPrompt triggers actions correctly
- No infinite loops (object selector bugs)

**End-to-End**:
- Create dirty transaction → Push sync
- Process cloud transaction → Pull sync
- Go offline → Queue → Go online → Process queue

---

## 5. Risks & Mitigation

### Risk 1: Breaking Existing Functionality
**Probability**: Medium
**Impact**: High
**Mitigation**:
- Comprehensive test coverage before refactor
- Adapter layer is thin wrapper (minimal logic)
- Incremental migration (one service at a time)
- Keep existing tests passing throughout

### Risk 2: Object Selector Bugs (Infinite Loops)
**Probability**: Medium (if not careful)
**Impact**: Critical (app crash)
**Mitigation**:
- Follow ADR-012 strictly (primitives only)
- Code review focuses on selector returns
- Test with React StrictMode enabled
- Reference Debug module as template

### Risk 3: Incomplete Adapter Coverage
**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Grep for all transaction/capture imports upfront
- Create comprehensive adapter interface first
- Unit tests verify all operations wrapped
- Integration tests catch missing operations

### Risk 4: Performance Regression
**Probability**: Low
**Impact**: Low
**Mitigation**:
- Adapter layer is thin wrapper (no overhead)
- No additional async operations
- Benchmark critical paths if needed

---

## 6. Success Criteria

### Architecture Compliance
- [ ] ✅ No direct imports from `../../transaction/adapters` in services
- [ ] ✅ No direct imports from `../../capture/adapters` in services
- [ ] ✅ Adapter layer properly wraps all external dependencies
- [ ] ✅ Pillar I (Firewalls) violation resolved

### 4.5-Layer Structure
- [ ] ✅ Layer 3 (Adapters) created and populated
- [ ] ✅ Layer 2 (Services) use adapters exclusively
- [ ] ✅ Layer 1.5 (Hook Bridge) follows three identities (ADR-020)
- [ ] ✅ Layer 1 (Views) use hooks, not direct store access

### Code Quality
- [ ] ✅ All existing tests pass
- [ ] ✅ New adapter tests added
- [ ] ✅ New hook tests added
- [ ] ✅ No infinite loop warnings
- [ ] ✅ TypeScript compiles with no errors

### Documentation
- [ ] ✅ LAYERS.md updated with Sync module
- [ ] ✅ PATTERNS.md references Sync as example
- [ ] ✅ Module public API documented

---

## 7. References

### Architecture Decisions
- **ADR-020**: Hook Bridge Layer (Three Identities)
- **ADR-011**: Bidirectional Cloud Sync
- **ADR-012**: Zustand Selector Safety
- **ADR-001**: Service Pattern

### Documentation
- `docs/architecture/LAYERS.md` - 4.5-layer architecture
- `docs/architecture/PATTERNS.md` - State management patterns
- `docs/architecture/ADR/020-hook-bridge-layer.md` - Hook theory

### Reference Modules
- **Debug Module**: Complete 4.5-layer implementation
  - `app/src/02_modules/debug/adapters/` - Adapter pattern
  - `app/src/02_modules/debug/hooks/` - Hook Bridge pattern
  - `app/src/02_modules/debug/index.ts` - Public API pattern
- **Settings Module**: 4-layer implementation
  - `app/src/02_modules/settings/` - Clean separation example

### Code Examples
- `.prot/pillar-i/firewalls.md` - Firewall pattern
- `.prot/pillar-b/airlock.ts` - Adapter template
- `.claude/rules/zustand-hooks.md` - Hook safety rules

---

## 8. Estimated Effort

| Step | Estimated Time | Complexity |
|------|---------------|------------|
| Step 1: Create Adapter Layer | 3-4 hours | Medium |
| Step 2: Refactor Services | 2-3 hours | Medium |
| Step 3: Enhance Hook Bridge | 2-3 hours | Medium |
| Step 4: Refactor Views | 1-2 hours | Low |
| Step 5: Update Public API | 30 min | Low |
| Step 6: Documentation & Testing | 1-2 hours | Low |
| **Total** | **10-15 hours** | **T2** |

**Tier Classification**: **T2 (Logic)**
- Multiple file changes
- Architecture pattern implementation
- Careful import management
- Integration testing required

---

## 9. Implementation Order

**Priority**: Adapter Layer First (minimizes risk)

1. **Step 1** (Adapter Layer) - Creates firewall boundary
2. **Step 2** (Services) - Removes violations immediately
3. **Step 3** (Hook Bridge) - Completes architecture
4. **Step 4** (Views) - Improves component quality
5. **Step 5** (Public API) - Finalizes structure
6. **Step 6** (Docs & Tests) - Ensures quality

**Incremental Approach**: Each step leaves codebase in working state.

---

## 10. Approval

**Ready for Implementation**: Awaiting user approval

**Questions for User**:
1. Approve full 4.5-layer refactor (all steps)?
2. Or prioritize Pillar I fix only (Steps 1-2)?
3. Any additional requirements or concerns?

---

**Status**: ⏸️ Awaiting Approval
**Next Action**: User reviews plan → `*approve` → Begin Step 1
