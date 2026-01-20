# Testing Sync Flow - Investigation Guide

> **Branch**: `feature/investigate-sync-flow`
> **Purpose**: Diagnose why uploaded receipts appear in Debug panel but not Ledger view

---

## What Changed

### Enhanced Logging Added

I've added detailed logging to track the complete sync flow:

**autoSyncService.ts**:
- Logs pull parameters (date filters, traceId)
- Logs detailed pull results (synced count, conflicts, errors)

**transactionPullService.ts**:
- Logs API fetch parameters before calling cloud
- Logs cloud fetch results with transaction date ranges
- Logs first cloud transaction as sample
- Logs each new transaction found
- Logs conflict resolution details (timestamps, winner)

### New Documentation

**docs/operations/SYNC_FLOW_ARCHITECTURE.md**:
- Complete map of sync flow from upload → cloud → local → display
- Identifies 6 potential failure points
- Explains each component's role

**docs/operations/DEBUG_LEDGER_SYNC.md**:
- User-facing debug guide
- Step-by-step diagnosis checklist
- Common issues and fixes

---

## How to Test

### Step 1: Build and Run with Enhanced Logging

```bash
# Switch to investigation branch
git checkout feature/investigate-sync-flow
git pull origin feature/investigate-sync-flow

# Build and run
cd app
npm run tauri dev
```

### Step 2: Clear Logs for Clean Start

1. Open Debug panel (type "debug" anywhere in app)
2. Scroll to bottom → Click "Clear Logs" button
3. Keep Debug panel open to watch logs in real-time

### Step 3: Upload a Receipt

1. Switch to Capture view
2. Drag and drop a receipt image (use test images from `/private/tmp/yorutsuke-test/`)
3. Watch the upload progress in Capture view
4. Wait for "uploaded" status (should take ~3-5 seconds)

### Step 4: Monitor Auto-Sync Logs

**Watch for these log events** (in Debug panel):

#### 4.1 Auto-Sync Timer Running

Look for this event every 3 seconds:
```json
{
  "event": "auto_sync_cycle_execute",
  "userId": "device-xxx",
  "operation": "pull"  // or "push"
}
```

**If you DON'T see this**:
- ❌ Auto-sync timer is not running
- Check for: `auto_sync_timer_not_started` log
- Possible causes: Network offline, userId not set

#### 4.2 Pull Operation Started

Look for:
```json
{
  "event": "auto_sync_pull_execute",
  "userId": "device-xxx",
  "traceId": "trace-xxx",
  "startDate": "undefined (no filter)",
  "endDate": "undefined (no filter)",
  "note": "Auto-sync pulls without date filters to catch all cloud transactions"
}
```

**This confirms**: Auto-sync is fetching ALL transactions (no date restrictions)

#### 4.3 Fetch Parameters

Look for:
```json
{
  "event": "transaction_sync_fetch_params",
  "userId": "device-xxx",
  "startDate": "undefined (no filter)",
  "endDate": "undefined (no filter)",
  "note": "Fetching from cloud with these date filters",
  "traceId": "trace-xxx"
}
```

#### 4.4 Cloud Fetch Results

Look for:
```json
{
  "event": "transaction_sync_cloud_fetched",
  "userId": "device-xxx",
  "count": 5,  // ← Check this number
  "firstTxDate": "2026-01-18",
  "lastTxDate": "2026-01-15",
  "traceId": "trace-xxx"
}
```

**Critical checks**:
- ✅ `count > 0`: Cloud has transactions
- ❌ `count === 0`: No transactions in cloud (check Debug panel "Latest Cloud Transactions")
- Check date range: Does it include your uploaded receipt's date?

#### 4.5 Sample Transaction

Look for:
```json
{
  "event": "transaction_sync_cloud_sample",
  "txId": "tx-xxx",
  "date": "2026-01-18",
  "amount": 1500,
  "status": "unconfirmed",  // ← Should be "unconfirmed" for new receipts
  "merchant": "Some Store",
  "isDirty": false,  // ← Should be false (from cloud)
  "traceId": "trace-xxx"
}
```

**Check**:
- Does this match your uploaded receipt?
- Is the date correct?
- Is status "unconfirmed"?

#### 4.6 New Transaction Found

Look for:
```json
{
  "event": "transaction_sync_new_found",
  "txId": "tx-xxx",
  "date": "2026-01-18",
  "amount": 1500,
  "status": "unconfirmed",
  "traceId": "trace-xxx"
}
```

**This means**: Transaction is NOT in local database yet, will be inserted.

**If you DON'T see this**:
- Transaction already exists in local database
- Look for `transaction_sync_conflict` instead

#### 4.7 Transaction Inserted

Look for:
```json
{
  "event": "transaction_sync_inserted",
  "txId": "tx-xxx",
  "traceId": "trace-xxx"
}
```

**This confirms**: Transaction was successfully inserted into local database.

#### 4.8 Pull Complete

Look for:
```json
{
  "event": "auto_sync_pull_complete",
  "userId": "device-xxx",
  "traceId": "trace-xxx",
  "synced": 1,  // ← Check this number
  "conflicts": 0,
  "errorCount": 0
}
```

**Critical checks**:
- ✅ `synced > 0`: Transactions were synced to local database
- ❌ `synced === 0`: Nothing was synced (check why)

### Step 5: Verify in Ledger View

1. Switch to Ledger view
2. **IMPORTANT**: Set all filters to "All"
   - Date Range: "All"
   - Status: "All"
   - Type: "All"
   - Category: "All"
3. Check if your transaction appears in the list

**If transaction DOES appear**:
- ✅ Sync is working!
- ✅ Issue was filter-related

**If transaction DOES NOT appear**:
- ❌ Something is wrong with Ledger query
- Check database directly (see Step 6)

### Step 6: Verify in Database (Debug Panel)

1. Go to Debug panel
2. Find "System Info" section
3. Check "Total transactions" count

**Compare**:
- Before upload: X transactions
- After upload + sync: X + 1 transactions

**If count increased**:
- ✅ Transaction is in database
- ✅ Issue is in Ledger view filtering/rendering

**If count DID NOT increase**:
- ❌ Transaction was not inserted
- Check logs for errors in Step 4.7-4.8

---

## Expected Timeline

| Time | Event | Log to Watch |
|------|-------|--------------|
| T+0s | Upload starts | - |
| T+3s | Upload completes | `image_uploaded` |
| T+10s | Lambda processing | - |
| T+13s | Auto-sync pull | `auto_sync_cycle_execute` |
| T+14s | Transaction synced | `transaction_sync_inserted` |
| T+15s | Ledger displays | Manual check |

---

## Common Issues and What to Look For

### Issue 1: Auto-Sync Not Running

**Symptoms**:
- No `auto_sync_cycle_execute` logs
- No sync activity at all

**Logs to check**:
```json
{ "event": "auto_sync_timer_not_started", "reason": "no_user" }
// OR
{ "event": "auto_sync_timer_not_started", "reason": "offline" }
```

**Fix**:
- Check network connection
- Restart app
- Verify userId is set (check System Info in Debug panel)

### Issue 2: Cloud Fetch Returns 0 Transactions

**Symptoms**:
- Logs show `count: 0` in `transaction_sync_cloud_fetched`
- But Debug panel "Latest Cloud Transactions" shows transactions

**Logs to check**:
```json
{
  "event": "transaction_sync_fetch_params",
  "startDate": "2026-01-01",  // ← Check if too narrow
  "endDate": "2026-01-10"
}
```

**Fix**:
- Verify transaction date is within fetch range
- Check if cloud API is filtering incorrectly

### Issue 3: Conflict Resolution Skips Transaction

**Symptoms**:
- Logs show `count > 0` but `synced: 0`
- See `transaction_sync_conflict` with `winner: 'local'`

**Logs to check**:
```json
{
  "event": "transaction_sync_conflict",
  "txId": "tx-xxx",
  "localDirty": true,  // ← Local has unsynced changes
  "winner": "local"
}
```

**Fix**:
- Local transaction is dirty (has unsynced changes)
- Conflict resolution chose local over cloud
- This is correct behavior if local was modified

### Issue 4: Transaction Inserted but Not in Ledger

**Symptoms**:
- Logs show `transaction_sync_inserted`
- Database count increased
- But Ledger view is empty

**Check**:
1. Ledger filters (reset all to "All")
2. Transaction date vs Ledger date range
3. Transaction status vs Ledger status filter

**Most likely**: Date filter excludes transaction
- Ledger defaults to "This Month"
- If transaction date is last month → won't show

---

## What to Report Back

After running this test, please provide:

### 1. Auto-Sync Status
- [ ] Saw `auto_sync_cycle_execute` logs every 3 seconds?
- [ ] Saw `auto_sync_pull_execute` after upload?

### 2. Cloud Fetch Results
- Cloud transaction count: `___`
- Transaction date range: `___` to `___`
- Sample transaction ID: `___`

### 3. Sync Results
- New transactions found: `___`
- Transactions synced: `___`
- Conflicts: `___`
- Errors: `___`

### 4. Ledger View
- [ ] Transaction appears in Ledger (with "All" filters)?
- [ ] Transaction appears in Debug panel "Latest Cloud Transactions"?
- [ ] Database count increased after sync?

### 5. Key Logs
Copy and paste these logs from Debug panel:
- `transaction_sync_fetch_params`
- `transaction_sync_cloud_fetched`
- `transaction_sync_cloud_sample`
- `auto_sync_pull_complete`

---

## Next Steps

Once we have the log data from your test:

1. **If auto-sync is NOT running**: Fix timer initialization
2. **If cloud fetch returns 0**: Fix date filtering in API
3. **If synced count is 0**: Fix conflict resolution or upsert logic
4. **If transaction in DB but not Ledger**: Fix Ledger filtering

The enhanced logging will tell us exactly where the sync flow breaks!

---

## Clean Up After Testing

When investigation is complete:

```bash
# Remove temporary logging (future task)
git checkout development
git branch -D feature/investigate-sync-flow
```

Do NOT clean up yet - we need to analyze results first!
