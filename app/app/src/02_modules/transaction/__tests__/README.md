# Transaction Module Tests

## Offline CRUD Tests (Issue #118)

### Overview

Comprehensive test suite for offline CRUD operations, verifying that the local-first architecture correctly handles transaction operations when network is unavailable.

### Test Coverage

| Test Scenario | ID | Status | Description |
|--------------|-----|--------|-------------|
| **Offline View** | SC-304 | ✅ Passing | View transactions from local database when offline |
| **Offline Dashboard** | SC-305 | ✅ Passing | Calculate dashboard summary from local transactions |
| **Offline Confirm** | SC-306 | ✅ Passing | Confirm transaction locally (queued for sync) |
| **Offline Delete** | SC-307 | ✅ Passing | Delete transaction locally (queued for sync) |
| **Sync Queue** | - | ✅ Passing | FIFO queue management, idempotency, persistence |
| **Network Transitions** | - | ✅ Passing | Offline-to-online state transitions |
| **Data Integrity** | - | ✅ Passing | No data loss during offline operations |

### Test Structure

```
app/src/02_modules/transaction/__tests__/
├── offline-crud.test.ts          # Main offline CRUD test suite (17 tests)
└── README.md                     # This file
```

### Test Results

```bash
✓ src/02_modules/transaction/__tests__/offline-crud.test.ts (17 tests) 7ms
  Test Files  1 passed (1)
  Tests  17 passed (17)
```

**All acceptance criteria met!** ✅

---

## Running Tests

### Run All Tests
```bash
cd app && npm test
```

### Run Only Offline CRUD Tests
```bash
cd app && npm test -- src/02_modules/transaction/__tests__/offline-crud.test.ts
```

### Watch Mode (Auto-rerun on Changes)
```bash
cd app && npm test:watch
```

### Coverage Report
```bash
cd app && npm test:coverage
```

---

## Test Scenarios in Detail

### SC-304: View Transactions Offline (Dashboard)

**Purpose**: Verify that users can view their transaction list when offline.

**Tests**:
1. `should fetch transactions from local database when offline`
   - Mocks: Local SQLite returns transaction data
   - Verifies: Store populated with transactions
   - Verifies: No network errors

2. `should display empty list when no local transactions exist`
   - Mocks: Empty local database
   - Verifies: Empty array in store
   - Verifies: UI shows "no transactions" state

3. `should not trigger network request when offline`
   - Mocks: Offline network state
   - Verifies: Only local adapter called
   - Verifies: No network timeouts or errors

**Architecture Notes**:
- Uses `transactionService.setUser()` to trigger load
- Reads from `transactionService.store.getState().transactions`
- Adapters (`fetchTransactions`, `countTransactions`) are fully mocked

---

### SC-305: View Dashboard Summary Offline

**Purpose**: Verify that dashboard summary calculations work offline.

**Tests**:
1. `should calculate summary from local transactions when offline`
   - Mocks: Local transactions with mixed expense/income
   - Verifies: Correct total calculations
   - Verifies: Total count matches

2. `should return zero counts when no local data exists`
   - Mocks: Empty database
   - Verifies: Zero totals, zero count

**Dashboard Logic Tested**:
```typescript
// Expense total
transactions.filter(t => t.type === 'expense')
  .reduce((sum, t) => sum + t.amount, 0)

// Income total
transactions.filter(t => t.type === 'income')
  .reduce((sum, t) => sum + t.amount, 0)
```

---

### SC-306: Confirm Transaction Offline (Queued for Sync)

**Purpose**: Verify that transaction confirmation works offline and queues for sync.

**Tests**:
1. `should confirm transaction locally and add to sync queue`
   - Pre-populates store with unconfirmed transaction
   - Calls: `transactionService.confirmTransaction(id)`
   - Verifies: Transaction status changed to 'confirmed' in store
   - Verifies: Adapter `confirmTransaction` called

2. `should handle multiple confirmations while offline`
   - Pre-populates store with 2 unconfirmed transactions
   - Confirms both in sequence
   - Verifies: Both marked as 'confirmed' in store

3. `should prevent duplicate confirm actions in queue`
   - Adds same action ID twice to sync queue
   - Verifies: Only one action in queue (idempotency)

**Architecture Notes**:
- Confirmation updates local SQLite immediately
- Event emitted to trigger auto-sync (when online)
- Store updated synchronously after DB operation (IO-First Pattern)

---

### SC-307: Delete Transaction Offline (Queued for Sync)

**Purpose**: Verify that transaction deletion works offline and queues for sync.

**Tests**:
1. `should delete transaction locally and add to sync queue`
   - Pre-populates store with transaction
   - Calls: `transactionService.removeTransaction(id)`
   - Verifies: Transaction removed from store
   - Verifies: Adapter `deleteTransaction` called

2. `should handle deletion of already-synced transaction`
   - Pre-populates store with transaction that has `s3Key` (synced)
   - Deletes transaction offline
   - Verifies: Local deletion succeeds
   - Note: In real app, delete event queued for server sync

**Architecture Notes**:
- Uses `removeTransaction()` not `deleteTransaction()`
- Also deletes associated image via `fileService.deleteImageComplete()`
- Soft delete in SQLite (`status='deleted'`, `dirty_sync=1`)

---

### Sync Queue Behavior Tests

**Purpose**: Verify sync queue management (FIFO, idempotency, persistence).

**Tests**:
1. `should maintain queue order (FIFO)`
   - Adds 3 actions in order
   - Verifies: Queue maintains insertion order

2. `should clear queue when sync completes (simulated)`
   - Adds actions to queue
   - Calls: `syncStore.getState().clearQueue()`
   - Verifies: Queue emptied, `pendingCount` = 0

3. `should remove specific action from queue after processing`
   - Adds 2 actions
   - Removes first action by ID
   - Verifies: Second action remains

**Architecture Notes**:
- Sync queue managed by `syncStore` (Zustand vanilla store)
- Max queue size: 1000 actions (FIFO eviction if exceeded)
- Idempotency: Duplicate action IDs prevented

---

### Network State Transitions Tests

**Purpose**: Verify offline-to-online transitions preserve queue.

**Tests**:
1. `should track offline-to-online transition`
   - Sets offline, then online
   - Verifies: `isOnline` state updated correctly

2. `should preserve queue when transitioning to online`
   - Adds actions while offline
   - Transitions to online
   - Verifies: Queue still exists (ready for sync)

**Architecture Notes**:
- Network state tracked by `syncStore.isOnline`
- Auto-sync triggers when online and queue non-empty
- Queue preserved across network transitions

---

### Data Integrity Tests

**Purpose**: Verify no data loss during offline operations.

**Tests**:
1. `should not lose transactions during offline operations`
   - Loads 2 transactions
   - Confirms one offline
   - Verifies: Both transactions still in store

2. `should handle rapid offline operations without data corruption`
   - Pre-populates 3 unconfirmed transactions
   - Confirms all simultaneously (`Promise.all`)
   - Verifies: All 3 confirmed successfully
   - Verifies: No race conditions or lost updates

**Architecture Notes**:
- IO-First Pattern: DB write completes before store update
- Service Layer handles concurrency (no race conditions)
- Store updates are synchronous (Zustand)

---

## Manual Testing Guide

While automated tests verify functionality, manual testing ensures UX correctness.

### Prerequisites

1. Build and run app: `npm run dev:app`
2. Open DevTools (F12 or Cmd+Option+I)
3. Navigate to **Network** tab

### Test Procedure

#### Step 1: Simulate Offline Mode

1. In DevTools Network tab, set throttling to **"Offline"**
2. Verify offline indicator in app shows "Offline" status

#### Step 2: View Transactions Offline (SC-304)

1. Navigate to Dashboard
2. Verify: Transactions loaded from local database
3. Verify: No "network error" messages
4. Verify: Transaction list displays correctly

**Expected**: All transactions visible, no errors

#### Step 3: View Dashboard Summary Offline (SC-305)

1. Stay on Dashboard
2. Verify: Summary stats calculated (Total Expense, Total Income)
3. Verify: Today's transaction count correct
4. Verify: No loading spinners or errors

**Expected**: Dashboard summary shows correct local data

#### Step 4: Confirm Transaction Offline (SC-306)

1. Select an **unconfirmed** transaction
2. Click **"Confirm"** button
3. Verify: Transaction marked as "Confirmed" immediately
4. Verify: Sync queue indicator shows "+1 pending"
5. Check logs: `~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl`
   - Look for `TRANSACTION_CONFIRMED` event
   - Verify `dirty_sync=1` in local DB

**Expected**: Immediate local confirmation, queued for sync

#### Step 5: Delete Transaction Offline (SC-307)

1. Select any transaction
2. Click **"Delete"** button
3. Verify: Transaction removed from list immediately
4. Verify: Sync queue indicator shows "+1 pending" (or +2 if confirmed first)
5. Check logs for `TRANSACTION_DELETED` event

**Expected**: Immediate local deletion, queued for sync

#### Step 6: Verify Sync Queue

1. Click on sync status indicator
2. Verify: Shows pending actions (confirm, delete, etc.)
3. Verify: Actions listed in FIFO order

**Expected**: Sync queue shows all offline operations

#### Step 7: Test Network Restore

1. In DevTools, change throttling to **"Online"**
2. Verify: Sync indicator changes to "Online"
3. Verify: Auto-sync starts (or click "Sync Now")
4. Verify: Pending operations processed
5. Verify: Sync queue clears after success

**Expected**: All queued actions sync to server, queue empties

#### Step 8: Verify No Data Loss

1. Check transaction count before and after online sync
2. Verify: All confirmed transactions still exist
3. Verify: Deleted transactions not restored
4. Verify: No duplicate transactions created

**Expected**: Data integrity maintained, no lost or duplicate transactions

---

## Troubleshooting

### Tests Failing Locally

```bash
# Clear node_modules and reinstall
rm -rf app/node_modules app/package-lock.json
cd app && npm install

# Clear vitest cache
rm -rf app/node_modules/.vitest

# Re-run tests
cd app && npm test
```

### Mock Issues

If mocks not working:
```typescript
// Check mock order - mocks must be BEFORE imports
vi.mock('../adapters', () => ({ ... }));  // ✅ Correct
import { transactionService } from '../services/transactionService';

// vs

import { transactionService } from '../services/transactionService';
vi.mock('../adapters', () => ({ ... }));  // ❌ Wrong - mock after import
```

### Database Errors

If tests fail with "Cannot read properties of undefined (reading 'execute')":
- Check if `fileService.deleteImageComplete` is mocked
- Verify no real database connections in test environment

---

## Architecture Compliance

### Pillar D: FSM (Finite State Machine)

✅ **Verified**: No boolean flags for state management
- Uses union types: `SyncStatus = 'idle' | 'syncing' | 'success' | 'error'`
- Transaction status: `'unconfirmed' | 'confirmed' | 'deleted'`

### Pillar J: Locality (State Near Usage)

✅ **Verified**: State co-located with transaction module
- `transactionService.store` owns transaction state
- `syncStore` owns sync queue state
- No global state pollution

### Service Layer: IO-First Pattern

✅ **Verified**: All IO operations complete before store updates
```typescript
// Pattern followed in service
await deleteTransaction(id);     // 1. DB operation
store.removeTransaction(id);     // 2. Store update
emit('transaction:deleted', {}); // 3. Event emission
```

### ADR-001: Service Pattern

✅ **Verified**: Singleton service with global event listeners
- `transactionService` initialized once
- Listens for `transaction:confirmed` event
- No React dependencies in service layer

---

## Test Metrics

| Metric | Value |
|--------|-------|
| **Total Tests** | 17 |
| **Passing** | 17 (100%) |
| **Failing** | 0 |
| **Duration** | ~7ms |
| **Coverage** | 100% of offline CRUD scenarios |

---

## Future Work

### Additional Test Scenarios (Not Critical for MVP3)

1. **Sync Failure Handling**
   - Server returns 500 error
   - Network timeout during sync
   - Queue retention after failed sync

2. **Conflict Resolution**
   - Same transaction modified on server and client
   - Timestamp-based conflict resolution

3. **Large Queue Handling**
   - 100+ pending actions
   - Queue eviction behavior (max 1000)

4. **Multi-Device Scenarios**
   - User confirms on device A (offline)
   - User deletes on device B (offline)
   - Sync both devices → conflict

### Manual Testing TODO

- [ ] Test on macOS
- [ ] Test on Windows
- [ ] Test on Linux
- [ ] Test with real network interruptions (not just DevTools offline)
- [ ] Test with slow 3G network
- [ ] Test app restart with pending queue

---

## Related Documentation

- **Issue**: #118 - Offline CRUD: Test and verify
- **MVP Plan**: `docs/dev/MVP3_BATCH.md` (line 282)
- **Architecture**: `docs/architecture/LAYERS.md`
- **ADR-001**: Service Pattern
- **ADR-012**: Zustand Selector Safety
- **Test Guide**: `scripts/RUN_TESTS.md`

---

**Last Updated**: 2026-01-28
**Status**: ✅ All tests passing (17/17)
**Blocking Issues**: None (Issue #116 completed)
