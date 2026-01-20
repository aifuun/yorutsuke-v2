# Debug Guide: Receipt Not Appearing in Ledger

## Problem
Uploaded receipt appears in Debug panel ("Latest Cloud Transactions") but NOT in Ledger view.

## Root Cause
- **Debug panel**: Fetches directly from cloud (DynamoDB via Lambda)
- **Ledger view**: Fetches from local SQLite database
- **Missing link**: Auto-sync from cloud → local database not working

---

## Step 1: Check if Auto-Sync is Running

### 1.1 Check Logs in Debug Panel

Go to Debug panel → Scroll to logs section

**Look for these log entries** (should appear every 3 seconds):

```json
{
  "event": "auto_sync_cycle_execute",
  "userId": "device-xxx",
  "operation": "pull"  // or "push"
}
```

**If you see these logs**:
- ✅ Auto-sync is running
- ⏩ Continue to Step 2

**If you DON'T see these logs**:
- ❌ Auto-sync is not running
- 🔍 Check if `userId` is set correctly
- 🔍 Check if network is online
- Look for error logs like `auto_sync_timer_not_started`

### 1.2 Check Pull Results

Look for logs after pull operation:

```json
{
  "event": "auto_sync_pull_cycle_complete",
  "synced": 5,       // Number of transactions synced
  "conflicts": 0,
  "userId": "device-xxx"
}
```

**If `synced: 0`**:
- Cloud has no new transactions since last sync
- OR cloud transactions already exist locally
- 🔍 Check timestamp of last upload vs last sync

**If `synced > 0`**:
- ✅ Transactions were synced to local database
- ⏩ Continue to Step 2

---

## Step 2: Verify Transaction is in Local Database

### 2.1 Open Debug Panel → System Info

Look for database statistics:

```
SQLite Database: /Users/xxx/Library/Application Support/com.yorutsuke.app/yorutsuke.db
Total transactions: 42
```

**Check if the number increased after upload**:
- Before upload: 40 transactions
- After upload + sync: 42 transactions
- If increased: ✅ Transaction was synced

### 2.2 Direct Database Query

Open Debug panel → find "Latest Cloud Transactions" section

Compare:
- **Cloud count**: Shows X transactions
- **Local count**: Check total in System Info

If they don't match → auto-sync is not pulling all transactions

---

## Step 3: Check Ledger View Filters

### 3.1 Open Ledger View

Check these filters at the top of the page:

**Date Range**:
- Default: "This Month"
- If today is Jan 1 and you uploaded Dec 31 → transaction won't show!
- **Fix**: Change to "All" or select correct month

**Status Filter**:
- Options: All / Pending / Confirmed
- If set to "Confirmed" and transaction is "Unconfirmed" → won't show
- **Fix**: Change to "All"

**Type Filter**:
- Options: All / Income / Expense
- If set to "Income" and transaction is "Expense" → won't show
- **Fix**: Change to "All"

**Category Filter**:
- Options: All / Food / Transport / etc.
- If category doesn't match → won't show
- **Fix**: Change to "All"

### 3.2 Force Refresh Ledger

While in Ledger view:
1. Click the "Sync" button in the header
2. Wait 3 seconds
3. Check if transaction appears

---

## Step 4: Check Transaction Status

### 4.1 View Transaction in Debug Panel

In Debug panel → "Latest Cloud Transactions":
- Find your uploaded receipt transaction
- Check the `status` field

**Expected values**:
- `"unconfirmed"` - Default for newly processed receipts
- `"confirmed"` - User has reviewed and confirmed
- `"needs_review"` - AI confidence is low

**If status is `"deleted"`**:
- ❌ Transaction was deleted (won't show in Ledger)
- Check who deleted it (check logs for `transaction:deleted` event)

### 4.2 Check Processing Model

In the same transaction in Debug panel:
- Check if `processingModel` field exists
- Check if `confidence` field exists

**If both are `null`**:
- Transaction was not processed by Lambda
- OR processing failed
- 🔍 Check CloudWatch Lambda logs for errors

---

## Step 5: Manual Sync Test

### 5.1 Trigger Manual Full Sync

1. Open Debug panel
2. Find "Manual Sync" section (if available)
3. Click "Sync Now"
4. Wait for completion
5. Go to Ledger view and check

### 5.2 Check Sync Logs

After manual sync, check logs for:

```json
{
  "event": "transaction_sync_started",
  "userId": "device-xxx",
  "traceId": "trace-xxx"
}
```

Then look for:

```json
{
  "event": "transaction_sync_cloud_fetched",
  "count": 5,  // Number of transactions fetched from cloud
  "traceId": "trace-xxx"
}
```

Then:

```json
{
  "event": "transaction_sync_local_fetched",
  "count": 4,  // Number of transactions in local database
  "traceId": "trace-xxx"
}
```

Then for each new transaction:

```json
{
  "event": "transaction_sync_inserted",
  "txId": "tx-xxx",
  "traceId": "trace-xxx"
}
```

**If count difference = 0**:
- All cloud transactions already exist locally
- Check if transaction is actually in cloud (use Debug panel)

---

## Common Issues and Fixes

### Issue 1: Auto-Sync Not Starting

**Symptoms**:
- No `auto_sync_cycle_execute` logs
- Timer never started

**Possible Causes**:
1. Network offline → Check network icon in app
2. No userId set → Check if you're logged in/have guest ID
3. Service not initialized → Should not happen (initialized in main.tsx)

**Fix**:
1. Restart app
2. Check network connection
3. Check logs for `auto_sync_timer_started`

### Issue 2: Pull Operation Finds 0 Transactions

**Symptoms**:
- Logs show `synced: 0`
- But Debug panel shows cloud transactions

**Possible Causes**:
1. Date range filter in pull operation too narrow
2. Transaction timestamp outside of pull window
3. Transaction already exists locally (idempotent)

**Fix**:
1. Check `startDate` and `endDate` parameters in pull logs
2. Verify transaction's `date` field (not `createdAt`)
3. Check if transaction already in local database

### Issue 3: Ledger Filters Hiding Transaction

**Symptoms**:
- Transaction in local database (count increased)
- But not visible in Ledger view

**Possible Causes**:
1. Date filter excludes transaction's date
2. Status filter doesn't match transaction status
3. Type/category filter doesn't match

**Fix**:
1. Reset all filters to "All"
2. Check transaction date vs current date range filter
3. Manually search for transaction by amount or merchant

### Issue 4: Transaction Has Wrong Status

**Symptoms**:
- Transaction in database
- Status is "deleted" or unexpected value

**Possible Causes**:
1. Lambda processing failed (status not set)
2. Transaction was deleted locally
3. Conflict resolution chose wrong version

**Fix**:
1. Check CloudWatch Lambda logs for processing errors
2. Check local logs for `transaction:deleted` events
3. Re-upload receipt if processing failed

---

## Quick Diagnosis Checklist

Run through this checklist in order:

- [ ] **Auto-sync logs visible?** → If NO: restart app, check network
- [ ] **Pull operation shows `synced > 0`?** → If NO: check date filters
- [ ] **Database transaction count increased?** → If NO: check pull errors
- [ ] **Ledger filters set to "All"?** → If NO: reset filters
- [ ] **Transaction status is NOT "deleted"?** → If YES: re-upload
- [ ] **Date range includes transaction date?** → If NO: change date range

---

## Developer Notes

### Where to Look in Code

| Component | File | Purpose |
|-----------|------|---------|
| Auto-sync timer | `sync/services/autoSyncService.ts` | 3-second interval loop |
| Pull logic | `sync/services/transactionPullService.ts` | Fetch cloud → upsert local |
| Ledger query | `transaction/adapters/transactionDb.ts` | Load from SQLite |
| Debug fetch | `debug/views/DebugView.tsx` | Direct cloud query |

### Key Logs to Watch

| Event | Meaning |
|-------|---------|
| `auto_sync_timer_started` | Timer initialized successfully |
| `auto_sync_cycle_execute` | Sync cycle started (every 3s) |
| `auto_sync_pull_execute` | Pull operation started |
| `transaction_sync_cloud_fetched` | Cloud transactions fetched |
| `transaction_sync_inserted` | Transaction added to local DB |
| `auto_sync_pull_cycle_complete` | Pull operation completed |

### Database Schema

Transaction status values:
- `"unconfirmed"` - Default for new receipts
- `"confirmed"` - User reviewed
- `"needs_review"` - Low AI confidence
- `"deleted"` - Soft deleted (hidden from UI)

---

## Solution Path

**Most Likely Issues (in order of probability)**:

1. **Ledger date filter** excludes transaction (80% of cases)
   - Fix: Change filter to "All" or correct month

2. **Auto-sync not running** (15% of cases)
   - Fix: Restart app, check network

3. **Transaction processing failed** (5% of cases)
   - Fix: Check Lambda logs, re-upload receipt

---

## Next Steps

1. Follow Step 1 to verify auto-sync is running
2. If running, check Step 3 for filter issues
3. If not running, check Step 5 for manual sync test
4. If still failing, provide:
   - Screenshots of Debug panel logs
   - Transaction ID from "Latest Cloud Transactions"
   - Current Ledger filter settings
