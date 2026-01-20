# Sync Flow Architecture

> Complete map of transaction sync between local (SQLite) and cloud (DynamoDB)

**Investigation**: Why do transactions appear in Debug panel (cloud) but not Ledger (local)?

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ACTIONS                            │
├─────────────────────────────────────────────────────────────────┤
│  Upload Receipt  │  Confirm Tx  │  Edit Tx  │  Delete Tx       │
└────────┬─────────┴──────┬───────┴────┬──────┴──────┬───────────┘
         │                │            │             │
         v                v            v             v
┌────────────────────────────────────────────────────────────────┐
│                      LOCAL DATABASE (SQLite)                   │
│  - images table (md5, thumbnailPath, originalPath)            │
│  - transactions table (id, userId, status, date, ...)         │
│  - isDirty flag (tracks unsynced changes)                     │
└────────┬───────────────────────────────────────┬───────────────┘
         │                                       │
         v                                       v
┌─────────────────────┐                ┌─────────────────────────┐
│  AUTO SYNC SERVICE  │◄───────────────│  MANUAL SYNC SERVICE    │
│  (3-second timer)   │                │  (User clicks "Sync")   │
└──────┬──────┬───────┘                └─────────────────────────┘
       │      │
   PUSH│      │PULL
       │      │
       v      v
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUD (AWS)                              │
│  ┌───────────────┐  ┌────────────────┐  ┌───────────────────┐ │
│  │  S3 Bucket    │  │  DynamoDB      │  │  Lambda Functions │ │
│  │  (images)     │  │  (transactions)│  │  (API endpoints)  │ │
│  └───────────────┘  └────────────────┘  └───────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Auto Sync Service (`autoSyncService.ts`)

**Purpose**: Continuously sync local and cloud data every 3 seconds

**Initialization**:
```typescript
// main.tsx (line 36)
autoSyncService.init();

// App.tsx (line 38)
useEffect(() => {
  autoSyncService.setUser(userId);
}, [userId]);
```

**Timer Loop**:
```
Every 3 seconds:
  1. Check if network is online
  2. Check if user is set
  3. Execute sync cycle:
     - If nextOperation === 'push': push dirty transactions
     - If nextOperation === 'pull': fetch cloud transactions
  4. Alternate operation for next cycle
```

**Key Methods**:
- `init()` - Initialize service (called once at app startup)
- `setUser(userId)` - Set current user, restart timer
- `executeSyncCycle()` - Run one push or pull cycle
- `executePush()` - Push dirty transactions to cloud
- `executePull()` - Pull cloud transactions to local

**State Machine**:
```
init() → setUser(userId) → restartSyncTimer() → executeSyncCycle()
                                                      ↓
                                            ┌─────────┴─────────┐
                                            │                   │
                                         PUSH                 PULL
                                            │                   │
                                            v                   v
                                    executePush()      executePull()
                                            │                   │
                                            └─────────┬─────────┘
                                                      │
                                                 nextOperation
                                                  alternates
```

### 2. Transaction Pull Service (`transactionPullService.ts`)

**Purpose**: Fetch transactions from cloud and merge into local database

**Flow**:
```
pullTransactions(userId, traceId, startDate?, endDate?)
  │
  ├─► Step 1: Fetch from cloud (via fetchTransactions API)
  │   │
  │   └─► transactionApi.fetchTransactions(userId, startDate, endDate, 'all')
  │       │
  │       └─► Lambda: GET /transactions?userId=xxx&status=all
  │
  ├─► Step 2: Fetch from local (via transactionDb)
  │   │
  │   └─► loadTransactions(userId, { startDate, endDate, includeDeleted: true })
  │
  ├─► Step 3: Merge (for each cloud transaction)
  │   │
  │   ├─► If NOT in local: upsertTransaction(cloudTx) → synced++
  │   │
  │   └─► If in local: resolveConflict(cloudTx, localTx)
  │       │
  │       ├─► Cloud wins: upsertTransaction(cloudTx) → synced++, conflicts++
  │       └─► Local wins: skip → conflicts++
  │
  └─► Step 4: Sync images for transactions
      │
      └─► syncImagesForTransactions(cloudTransactions, userId, traceId)
```

**Conflict Resolution** (`resolveConflict.ts`):
```typescript
function resolveConflict(cloud: Transaction, local: Transaction): Transaction {
  // Rule 1: Local deleted → Local wins
  if (local.status === 'deleted') return local;

  // Rule 2: Cloud deleted → Cloud wins
  if (cloud.status === 'deleted') return cloud;

  // Rule 3: Local dirty (unsynced changes) → Local wins
  if (local.isDirty) return local;

  // Rule 4: Latest update time wins
  const cloudTime = new Date(cloud.updatedAt).getTime();
  const localTime = new Date(local.updatedAt).getTime();
  return cloudTime > localTime ? cloud : local;
}
```

### 3. Transaction Push Service (`transactionPushService.ts`)

**Purpose**: Push local dirty transactions to cloud

**Flow**:
```
syncDirtyTransactions(userId, traceId)
  │
  ├─► Step 1: Fetch dirty transactions from local
  │   │
  │   └─► fetchDirtyTransactions(userId) → WHERE isDirty = 1
  │
  ├─► Step 2: Push each to cloud
  │   │
  │   └─► transactionApi.syncTransaction(tx, traceId)
  │       │
  │       └─► Lambda: PUT /sync { userId, transaction, traceId }
  │
  └─► Step 3: Clear dirty flag on success
      │
      └─► clearDirtyFlag(transactionId)
```

### 4. Transaction Sync Service (`transactionSyncService.ts`)

**Purpose**: Immediate sync after upload completion (not periodic)

**Trigger**: After instant processor Lambda completes

**Flow**:
```
IPC Event: 'image_uploaded' → triggerSync(imageId)
  │
  └─► autoSyncService.triggerManualSync()
      │
      └─► executeSyncCycle() (immediate, not waiting for timer)
```

### 5. Full Sync (`fullSync.ts`)

**Purpose**: Complete bidirectional sync (push + pull)

**Trigger**:
- App startup (App.tsx line 64)
- Manual sync button click

**Flow**:
```
fullSync(userId)
  │
  ├─► Step 1: Push dirty transactions
  │   │
  │   └─► transactionPushService.syncDirtyTransactions()
  │
  └─► Step 2: Pull cloud transactions
      │
      └─► transactionPullService.pullTransactions()
```

---

## Data Flow: Upload Receipt → Ledger Display

### Phase 1: Upload (Client → Cloud)

```
1. User drops image in Capture view
   │
   ├─► captureService.enqueue(imageId, file)
   │
   ├─► Compress image (WebP, 90% quality)
   │   └─► Store compressed in: ~/Library/Application Support/com.yorutsuke.app/images/
   │
   ├─► uploadService.processTask(imageId)
   │   │
   │   ├─► Get presigned URL from Lambda
   │   │   └─► Lambda: POST /presign { userId, fileName, traceId }
   │   │
   │   └─► Upload to S3 (PUT presignedUrl)
   │       └─► S3 EventBridge triggers instant-processor Lambda
   │
   └─► Store in images table (status: 'uploaded')
```

### Phase 2: Processing (Cloud)

```
2. Instant Processor Lambda
   │
   ├─► Download image from S3
   │
   ├─► Call Bedrock Nova Lite for OCR
   │   └─► Extract: amount, merchant, date, category
   │
   ├─► Create transaction in DynamoDB
   │   │
   │   └─► PutItem {
   │         id: tx-xxx,
   │         userId: device-xxx,
   │         amount: 1500,
   │         status: 'unconfirmed',  ← Default status
   │         date: '2026-01-18',
   │         processingModel: 'us.amazon.nova-lite-v1:0',
   │         confidence: 0.95
   │       }
   │
   └─► Return success to client (optional notification)
```

**⚠️ CRITICAL**: At this point, transaction exists in **cloud (DynamoDB)** but NOT in **local (SQLite)**.

### Phase 3: Sync (Cloud → Local)

```
3. Auto Sync Service (runs every 3 seconds)
   │
   ├─► Timer fires → executeSyncCycle()
   │   │
   │   └─► nextOperation = 'pull'
   │       │
   │       └─► executePull()
   │           │
   │           └─► transactionPullService.pullTransactions()
   │
   ├─► Step 1: Fetch from cloud
   │   │
   │   └─► transactionApi.fetchTransactions(userId, startDate, endDate, 'all')
   │       │
   │       └─► Lambda returns: [{ id: tx-xxx, status: 'unconfirmed', ... }]
   │
   ├─► Step 2: Fetch from local
   │   │
   │   └─► transactionDb.loadTransactions(userId, { includeDeleted: true })
   │       │
   │       └─► SQLite returns: [] (transaction not yet in local)
   │
   ├─► Step 3: Merge
   │   │
   │   └─► For tx-xxx:
   │       │
   │       ├─► localMap.get('tx-xxx') → undefined (not in local)
   │       │
   │       └─► upsertTransaction(cloudTx)
   │           │
   │           └─► INSERT INTO transactions VALUES (...)
   │               │
   │               └─► synced++ → Result: { synced: 1, conflicts: 0 }
   │
   └─► Step 4: Sync images
       │
       └─► syncImagesForTransactions([cloudTx], userId, traceId)
           │
           ├─► Check if image exists locally (by MD5)
           │   │
           │   ├─► If exists: skip download
           │   └─► If NOT exists: download from S3
           │
           └─► Update images table: link transaction to image
```

**✅ SUCCESS**: Transaction now exists in **local SQLite database**.

### Phase 4: Display (Local → UI)

```
4. Ledger View renders
   │
   ├─► useTransactionLogic.load()
   │   │
   │   └─► transactionDb.loadTransactions(userId, options)
   │       │
   │       └─► SELECT * FROM transactions
   │           WHERE user_id = ?
   │           AND (status IS NULL OR status != 'deleted')
   │           AND date >= ?  ← Date filter from UI
   │           AND date <= ?
   │           ORDER BY date DESC
   │
   ├─► Filters applied:
   │   ├─► Date range (default: "This Month")
   │   ├─► Status filter (default: "All")
   │   ├─► Type filter (default: "All")
   │   └─► Category filter (default: "All")
   │
   └─► Render transaction list
       │
       └─► [tx-xxx appears in list] ✅
```

---

## Potential Failure Points

### ❌ Point 1: Auto Sync Not Starting

**Location**: `autoSyncService.setUser()`

**Symptoms**:
- No `auto_sync_timer_started` log
- No `auto_sync_cycle_execute` logs

**Root Causes**:
1. `userId` is null or undefined
2. Network is offline (`networkMonitor.getStatus()` returns false)
3. Service not initialized (should not happen - init in main.tsx)

**Debug**:
```typescript
// Check in autoSyncService.ts line 146-151
if (!this.userId || !networkMonitor.getStatus()) {
  logger.debug('auto_sync_timer_not_started', {
    reason: !this.userId ? 'no_user' : 'offline',
  });
  return;
}
```

### ❌ Point 2: Pull Operation Fetches 0 Transactions

**Location**: `transactionPullService.pullTransactions()`

**Symptoms**:
- Logs show `transaction_sync_cloud_fetched` with `count: 0`
- OR `count > 0` but `synced: 0`

**Root Causes**:
1. **Date filter too narrow**: `startDate` and `endDate` exclude transaction's date
2. **Transaction already in local**: Idempotent (won't insert duplicate)
3. **Cloud fetch failed**: Lambda returned empty array

**Debug**:
```typescript
// Check transactionPullService.ts line 122
const cloudTransactions = await fetchFromCloud(userId, startDate, endDate);
logger.info('transaction_sync_cloud_fetched', {
  userId,
  count: cloudTransactions.length,  // ← Check this
  startDate,  // ← Check date range
  endDate,
  traceId
});
```

### ❌ Point 3: Date Range Excludes Transaction

**Location**: `transactionPullService.fetchFromCloud()`

**Issue**: Pull operation uses `startDate` and `endDate` parameters that may be too narrow.

**Default Behavior** (need to verify):
```typescript
// autoSyncService.executePull() line 330
const result = await pullTransactions(this.userId, traceId);
// ⚠️ No startDate/endDate passed → What's the default?
```

**In `transactionPullService.pullTransactions()` line 122**:
```typescript
const cloudTransactions = await fetchFromCloud(userId, startDate, endDate);
// If startDate/endDate undefined → what does Lambda return?
```

**Need to check**: `transactionApi.fetchTransactions()` default behavior when dates are undefined.

### ❌ Point 4: Conflict Resolution Chooses Local

**Location**: `resolveConflict.ts`

**Symptoms**:
- Logs show `transaction_sync_skipped` with `source: 'local'`
- `conflicts: 1` but `synced: 0`

**Root Cause**: Local transaction wins conflict, so cloud version is ignored.

**Debug**:
```typescript
// Check resolveConflict.ts logic
if (local.isDirty) return local;  // ← Local has unsynced changes
```

### ❌ Point 5: Ledger Filters Hide Transaction

**Location**: `TransactionView.tsx` filters

**Symptoms**:
- Transaction in database (can verify via Debug panel)
- Not visible in Ledger view

**Root Causes**:
1. **Date range filter**: Default is "This Month" - transaction from last month won't show
2. **Status filter**: If set to "Confirmed", unconfirmed transactions hidden
3. **Type filter**: If set to "Income", expense transactions hidden
4. **Category filter**: If set to "Food", transport transactions hidden

**Default Filters**:
```typescript
// TransactionView.tsx
const [dateRange, setDateRange] = useState<DateRange>('thisMonth');  // ⚠️
const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
```

### ❌ Point 6: Transaction Has Wrong Status

**Location**: Lambda instant-processor

**Symptoms**:
- Transaction exists in cloud
- Status is NOT "unconfirmed" (expected default)
- Status might be null, "deleted", or other unexpected value

**Root Cause**: Lambda processing error or status not set properly.

**Debug**: Check CloudWatch logs for instant-processor Lambda.

---

## Investigation Plan

### Phase 1: Verify Auto-Sync is Running ✅

**Test**:
1. Open Debug panel
2. Check logs for `auto_sync_timer_started`
3. Check logs for `auto_sync_cycle_execute` (every 3 seconds)

**Expected**:
```json
{ "event": "auto_sync_timer_started", "userId": "device-xxx", "intervalMs": 3000 }
{ "event": "auto_sync_cycle_execute", "userId": "device-xxx", "operation": "pull" }
```

**If FAIL**: Check `autoSyncService.setUser()` and `networkMonitor.getStatus()`.

### Phase 2: Verify Pull Fetches Cloud Transactions ✅

**Test**:
1. Upload receipt
2. Wait for processing (check Debug panel "Latest Cloud Transactions")
3. Wait 3 seconds for auto-sync
4. Check logs for `transaction_sync_cloud_fetched`

**Expected**:
```json
{ "event": "transaction_sync_cloud_fetched", "count": 1, "userId": "device-xxx" }
```

**If count: 0**: Check `startDate` and `endDate` in logs. Verify transaction's `date` field is within range.

### Phase 3: Verify Transactions Are Upserted ✅

**Test**:
1. After pull operation
2. Check logs for `transaction_sync_inserted`

**Expected**:
```json
{ "event": "transaction_sync_inserted", "txId": "tx-xxx", "traceId": "trace-xxx" }
```

**If NOT found**: Check for `transaction_sync_skipped` or `transaction_sync_error`.

### Phase 4: Verify Ledger Filters ✅

**Test**:
1. Open Ledger view
2. Set all filters to "All"
3. Set date range to "All"
4. Check if transaction appears

**Expected**: Transaction visible in list.

**If FAIL**: Check transaction's `date`, `status`, `type`, `category` fields.

### Phase 5: Add Enhanced Logging 🔧

**Goal**: Add temporary verbose logging to track exact flow.

**Locations**:
1. `autoSyncService.executePull()` - Log before/after pull
2. `transactionPullService.pullTransactions()` - Log each step with details
3. `transactionDb.upsertTransaction()` - Log SQL execution
4. `useTransactionLogic.load()` - Log query parameters

**Format**:
```typescript
logger.debug('sync_investigation', {
  phase: 'pull_start',
  userId,
  startDate,
  endDate,
  traceId,
});
```

### Phase 6: Test with Real Upload 🧪

**Test Flow**:
1. Clear all transactions (use Debug panel)
2. Upload receipt
3. Monitor logs in real-time
4. Check database count before/after sync
5. Check Ledger view with "All" filters

**Expected Timeline**:
- T+0s: Upload starts
- T+3s: Upload completes → S3 → Lambda triggered
- T+10s: Lambda processing completes → transaction in DynamoDB
- T+13s: Auto-sync pull cycle → transaction in SQLite
- T+14s: Ledger view shows transaction

---

## Success Criteria

**✅ Sync is working if**:
1. Auto-sync logs appear every 3 seconds
2. Pull operation shows `synced > 0` after upload
3. Database transaction count increases by 1
4. Ledger view (with "All" filters) displays transaction
5. Transaction's `status` is "unconfirmed"

**❌ Sync is broken if**:
- No auto-sync logs appear
- Pull shows `count: 0` from cloud
- Pull shows `synced: 0` despite `count > 0`
- Transaction in database but not in Ledger (filter issue)
- Transaction has wrong status (processing issue)

---

## Next Steps

1. ✅ Create this architecture document
2. 🔧 Add enhanced logging to sync services
3. 🧪 Test with real upload and monitor logs
4. 📝 Document findings
5. 🐛 Fix root cause
6. ✅ Verify fix with multiple uploads
7. 🧹 Clean up temporary logging

---

**Investigation Branch**: `feature/investigate-sync-flow`
**Related Docs**: `DEBUG_LEDGER_SYNC.md` (user-facing guide)
