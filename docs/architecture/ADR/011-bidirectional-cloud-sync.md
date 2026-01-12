# ADR-011: Bidirectional Cloud Sync (Issue #86)

**Status**: Implemented
**Date**: 2026-01-12
**Context**: Need bidirectional synchronization between local SQLite and cloud DynamoDB for transaction data.

## Problem

Users need transaction data synced between:
- **Local SQLite** - Fast, offline-capable storage for UI
- **Cloud DynamoDB** - Persistent, multi-device accessible storage

Requirements:
1. **Push Sync** (Local → Cloud) - Upload local changes (confirm, edit, delete)
2. **Pull Sync** (Cloud → Local) - Download newly processed transactions from Lambda
3. **Conflict Resolution** - Handle concurrent modifications
4. **Offline Support** - Queue changes when network unavailable
5. **Recovery** - Detect and recover from interrupted syncs

## Decision

### Architecture: Unified Sync Module

Consolidated all sync logic under `02_modules/sync/`:

```
sync/
├── services/
│   ├── transactionPushService.ts   # Local → Cloud
│   ├── transactionPullService.ts   # Cloud → Local
│   ├── syncCoordinator.ts          # Unified API
│   ├── imageSyncService.ts         # Image sync (moved)
│   └── recoveryService.ts          # Startup recovery
├── stores/
│   └── syncStore.ts                # Sync state, queue, network status
├── utils/
│   └── networkMonitor.ts           # Online/offline events
└── components/
    ├── SyncStatusIndicator.tsx     # UI indicator
    └── RecoveryPrompt.tsx          # Startup recovery prompt
```

**Rationale**: Sync is infrastructure, not business logic. Centralizing avoids split between `transaction/` and `sync/` modules.

### Push Sync (Local → Cloud)

**Trigger**: After local operations (confirm, edit, delete)
```typescript
// transactionService.ts
await confirmTransaction(id);           // IO-First: DB write first
triggerSync(userId, 'confirm');         // Then trigger sync (async, non-blocking)
```

**Implementation**:
1. Mark record as dirty: `dirty_sync = 1`
2. Check network status
3. Online → POST /transactions/sync
4. Offline → Add to queue

**Offline Queue**:
- Stored in Zustand `syncStore`
- Persisted to localStorage
- Processed on network reconnect

### Pull Sync (Cloud → Local)

**Trigger**:
- Auto-sync on app startup (if >5 minutes since last sync)
- Manual sync button
- After upload completes (5 second delay)

**Implementation**:
1. GET /transactions?userId=xxx&startDate=xxx&endDate=xxx
2. Compare cloud vs local by `updatedAt` timestamp
3. Merge using Last-Write-Wins (LWW)

### Conflict Resolution: Last-Write-Wins (LWW)

**Strategy**: Compare `updatedAt` timestamps
```typescript
if (!localTx) {
  upsert(cloudTx);              // Cloud record is new
} else if (cloudTx.updatedAt > localTx.updatedAt) {
  upsert(cloudTx);              // Cloud is newer
  conflicts++;
} else {
  // Local is newer, keep local version
}
```

**Push Sync Condition**:
```sql
ConditionExpression: "attribute_not_exists(transactionId) OR updatedAt < :localUpdatedAt"
```
- Only overwrites if cloud version doesn't exist or is older

**Rationale**:
- Simple, deterministic
- No need for version vectors
- Acceptable for single-user transaction edits
- Future: Add CRDTs if multi-device editing needed

### Network Monitoring

**Implementation**:
```typescript
// App.tsx initialization
networkMonitor.initialize();
networkMonitor.subscribe((isOnline) => {
  if (isOnline) processQueue();  // Auto-retry on reconnect
});
```

**Store Integration**:
- `useSyncStore` tracks `isOnline`, `isSyncing`, `queue`, `lastSyncedAt`
- UI reads store for real-time status

### Data Recovery

**Startup Check**:
```typescript
const status = await recoveryService.checkRecoveryStatus(userId);
if (status.needsRecovery) {
  // Show RecoveryPrompt modal
}
```

**Recovery Options**:
1. **Sync Now** → Process queue + sync dirty records
2. **Discard Changes** → Clear dirty flags + clear queue

**Rationale**: Prevents data loss from crashes or force-quits during sync.

## Lambda Endpoints

### GET /transactions (Pull Sync)
```
Query params: userId, startDate, endDate
Returns: { transactions: [...] }
```
- Fetches all pages automatically
- Uses DynamoDB `byDate` GSI

### POST /transactions/sync (Push Sync)
```
Body: { userId, transactions: [...] }
Returns: { synced: number, failed: string[] }
```
- Batch upserts with conditional writes
- Last-Write-Wins conflict resolution
- Idempotent (Pillar Q)

## Consequences

### Positive
✅ **Centralized** - All sync logic in one module
✅ **Offline-first** - Queue + auto-retry
✅ **Recoverable** - Startup recovery prompt
✅ **Observable** - Sync status visible to user
✅ **Idempotent** - Safe to retry push sync

### Negative
⚠️ **LWW Limitations** - Last writer wins, may lose concurrent edits
⚠️ **Single-user assumption** - Not optimized for multi-device concurrent edits
⚠️ **Manual conflict resolution** - No automatic merge for complex conflicts

### Future Improvements
- Add CRDT for multi-device editing
- Add conflict log for manual review
- Add delta sync (only changed fields)
- Add sync telemetry dashboard

## References

- **Issue**: #86 (Cloud Sync Service)
- **Related ADRs**: ADR-001 (Service Pattern), ADR-005 (TraceId vs IntentId), ADR-007 (Transaction Cloud Sync)
- **Implementation**: `app/src/02_modules/sync/`
- **Lambda**: `infra/lambda/transactions/index.mjs`
- **CDK**: `infra/lib/yorutsuke-stack.ts`

## Test Coverage

- **SC-1500**: Check recovery status on startup
- **SC-1501**: Push dirty transactions (online)
- **SC-1502**: Queue dirty transactions (offline)
- **SC-1503**: Process queue on network reconnect
- **SC-1504**: Pull new transactions from cloud
- **SC-1505**: Resolve conflicts with LWW
- **SC-1506**: Sync Now button triggers full sync
- **SC-1507**: Recovery prompt - Sync Now
- **SC-1508**: Recovery prompt - Discard
- **SC-1509**: SyncStatusIndicator shows pending count
- **SC-1510**: Network status indicator (online/offline)

## Pillars Applied

- **Pillar Q**: Idempotent push sync (conditional writes)
- **Pillar F**: Optimistic concurrency (updatedAt comparison)
- **Pillar L**: Headless logic separated from UI
- **Pillar R**: Observable (logs, sync status, recovery events)
- **Pillar M**: Compensation (queue + retry on failure)

---

**Approved by**: Issue #86 completion
**Implementation**: 2026-01-12
**Next Review**: When adding multi-device support or CRDTs
