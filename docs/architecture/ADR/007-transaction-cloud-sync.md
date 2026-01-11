# ADR-007: Transaction Cloud Sync with Conflict Resolution

**Status**: Accepted  
**Date**: 2026-01  
**Issue**: #108  
**Author**: Claude (AI Assistant)

## Context

The app processes receipts in three stages:
1. Local capture (Tauri) → SQLite
2. Cloud processing (Lambda + Bedrock) → DynamoDB
3. Local verification (React) → SQLite

**Problem**: Gap between cloud-processed transactions and local view:
- Receipts uploaded to cloud for OCR processing
- Lambda completes processing → DynamoDB updated
- But React app only reads from local SQLite
- User never sees cloud-processed results without manual sync

**Impact**:
- Broken "local-first" promise
- Users miss updated transaction data
- No automatic cloud-to-local sync

## Decision

Implement **pull-only cloud-to-local sync** with **explicit conflict resolution**:

### Architecture

```
React App
    ↓
transactionSyncService (Global Service)
    ├─ Listen to upload:complete events
    ├─ Trigger sync 3 seconds later (allow Lambda processing time)
    └─ Manual sync button in TransactionView
    ↓
syncService (Orchestrator)
    ├─ Fetch all user transactions from DynamoDB via Lambda
    ├─ Apply conflict resolution
    └─ Upsert to local SQLite
    ↓
useSyncLogic (Headless Hook)
    ├─ FSM: idle → syncing → success/error → idle
    └─ Expose status, error, lastSync timestamp
    ↓
Local SQLite
    └─ Transactions with status & version columns (Migration v6)
```

### Conflict Resolution Strategy

Priority order (highest to lowest):

1. **Local confirmed > Cloud timestamp**
   - User manual confirmation is highest authority
   - Don't overwrite user-confirmed data

2. **Cloud updatedAt > Local updatedAt** → Cloud wins
   - Newer cloud data takes precedence
   - Assumes cloud is source of truth

3. **Local updatedAt > Cloud updatedAt** → Local wins
   - Local edits are preserved
   - Useful for offline editing

4. **Same updatedAt** → Cloud wins
   - Default to source of truth
   - Rare edge case

### Auto-Sync Triggers

| Trigger | Timing | Reason |
|---------|--------|--------|
| **On mount** | If last sync > 5 min ago | Catch up after app restart |
| **After upload** | 3 sec delay | Allow Lambda processing time |
| **Manual** | User clicks "Sync" button | Explicit sync on demand |

### Key Design Decisions

1. **Pull-only**: Cloud is source of truth; no push to cloud (bidirectional is MVP5)
2. **No pagination**: Fetch all user transactions (<100 expected; pagination if >1000)
3. **Debounced**: Multiple uploads trigger single sync (3s delay after last upload)
4. **Idempotent**: Safe to retry; uses `upsertTransaction()` for conflict-free merging
5. **FSM-based**: Explicit states (idle | syncing | success | error) with typed transitions

### Implementation

**useSyncLogic.ts** (Headless hook):
```typescript
const [state, dispatch] = useReducer(syncReducer, initialState);
// state: { status, error, lastSync, transactions }

const sync = async () => {
  dispatch({ type: 'START' });
  try {
    const cloudTx = await transactionApi.fetchAll();
    const resolved = resolveConflicts(cloudTx, localTx);
    dispatch({ type: 'SUCCESS', data: resolved });
  } catch (err) {
    dispatch({ type: 'ERROR', error: err });
  }
};
```

**transactionSyncService.ts** (Global service):
```typescript
// Listen to upload complete events
on('upload:complete', () => {
  debounceSync(syncLogic.sync, 3000);
});

// On mount, sync if needed
if (Date.now() - lastSync > 5 * 60 * 1000) {
  syncLogic.sync();
}
```

## Critical Bugs Fixed

### Bug-003: Foreign Key Constraint
**Problem**: `FOREIGN KEY (image_id) REFERENCES images(id)` prevented syncing when source images didn't exist locally.

**Scenario**: 30-day image TTL, multi-device sync, guest→user migration

**Fix**: Migration v7 removes FK, keeps `image_id` as soft reference (safer for cloud sync)

### Bug-004: Date Filter Default
**Problem**: Default "This Month" filter hid all historical test data (2018-2025)

**Fix**: Changed default to "All" (better for testing, users can filter down)

## Consequences

**Positive**:
- ✅ Cloud-processed transactions now appear in local view
- ✅ Automatic sync on upload (3s delay)
- ✅ Conflict resolution prevents data loss
- ✅ Idempotent (safe to retry)
- ✅ FSM ensures consistent state
- ✅ 17 unit + 9 integration tests

**Negative**:
- ❌ No bidirectional sync yet (MVP5)
- ❌ Full transaction fetch (no pagination)
- ❌ 3-second delay after upload (acceptable tradeoff)

**Pillar Compliance**:
- **A (Nominal Types)**: ✅ TransactionId, UserId branded types
- **B (Airlock)**: ✅ Zod validation on all API responses
- **D (FSM)**: ✅ Explicit states in useSyncLogic
- **L (Headless)**: ✅ Logic in hooks, UI in views
- **Q (Idempotency)**: ✅ Sync is safe to retry
- **R (Observability)**: ✅ JSON semantic logs for all sync events

## Related Files

- `app/src/02_modules/transaction/adapters/transactionApi.ts` - Cloud API adapter
- `app/src/02_modules/transaction/services/syncService.ts` - Orchestration + conflict resolution
- `app/src/02_modules/transaction/services/transactionSyncService.ts` - Global service
- `app/src/02_modules/transaction/headless/useSyncLogic.ts` - FSM-based hook
- `app/src/02_modules/transaction/views/TransactionView.tsx` - UI integration
- `app/src/00_kernel/storage/migrations.ts` - v6, v7

## Testing

- ✅ 17 unit tests (conflict resolution logic)
- ✅ 9 integration tests (full sync flow)
- ✅ All 105 tests passing

## Future Work

- **MVP5**: Bidirectional sync (local → cloud push)
- **MVP5**: Pagination for >1000 transactions
- **Optimization**: Intelligent field merge (don't overwrite all fields)

## References

- Issue #108: Transaction Cloud Sync
- Pillar A: Nominal Types
- Pillar B: Airlock (Schema validation)
- Pillar D: FSM (State machines)
- Pillar L: Headless architecture
- Pillar Q: Idempotency
- Pillar R: Observability
