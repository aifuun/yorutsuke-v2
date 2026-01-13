# Feature Plan: #86 Cloud Sync Service (Local → Cloud)

> **Step 2 of Two-Step Planning** - Detailed implementation plan for cloud synchronization

| 项目 | 值 |
|------|-----|
| Issue | #86 |
| MVP | MVP3.5 (Confirmation Write-back) |
| 复杂度 | T3 (Distributed writes, network ops, saga pattern) |
| 预估 | 8-10h |
| 状态 | [x] 规划 / [ ] 开发中 / [ ] Review / [ ] 完成 |

---

## 1. 目标

**做什么**: Implement bidirectional cloud sync - push local changes (confirm/edit/delete) to DynamoDB with offline queue support

**为什么**:
- Issue #116 implemented local operations with `dirty_sync` flag
- Users need their confirmations/edits synced to cloud for multi-device access
- Offline queue ensures data integrity when network unavailable
- Data recovery needed for new device setup

**验收标准**:
- [ ] Sync dirty records (confirm/edit/delete) to DynamoDB
- [ ] Offline queue for failed sync attempts
- [ ] Auto-retry when network reconnects
- [ ] Data recovery on new device (fetch cloud → restore to SQLite)
- [ ] Conflict resolution (Last-Write-Wins)
- [ ] Sync status indicator in UI
- [ ] Network status monitoring
- [ ] All test scenarios (SC-1500~1521) passing

---

## 2. 实现方案

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Bidirectional Sync Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOCAL OPERATION (Confirm/Edit/Delete)                          │
│      ↓                                                          │
│  transactionDb.confirmTransaction() ← Sets dirty_sync=1 ✅     │
│      ↓                                                          │
│  transactionService.confirmExistingTransaction()                │
│      ├─→ Update local store                                    │
│      └─→ syncService.syncDirtyTransactions() ← NEW             │
│              ↓                                                  │
│          Query: SELECT * FROM transactions WHERE dirty_sync=1   │
│              ↓                                                  │
│          [Online?]                                              │
│           ├─ YES → POST /transactions/sync                      │
│           │        └→ DynamoDB upsert                           │
│           │        └→ Clear dirty_sync flag                     │
│           │                                                     │
│           └─ NO  → syncStore.addToQueue(action)                │
│                    └→ Retry when online                         │
│                                                                 │
│  DATA RECOVERY (New Device)                                     │
│      ↓                                                          │
│  App Start → detectAndRestore()                                 │
│      ↓                                                          │
│  Check: local empty + userId exists?                            │
│      ↓                                                          │
│  GET /transactions?userId={userId}                              │
│      ↓                                                          │
│  mergeCloudData() ← LWW conflict resolution                     │
│      ↓                                                          │
│  transactionDb.upsertTransaction() ← Bulk insert                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Current State (From Issue #116) ✅

Already implemented:
```typescript
// app/src/02_modules/transaction/adapters/transactionDb.ts

async function confirmTransaction(id: TransactionId): Promise<void> {
  await database.execute(
    'UPDATE transactions SET confirmed_at = ?, updated_at = ?, dirty_sync = ? WHERE id = ?',
    [now, now, 1, id],  // ✅ Sets dirty_sync=1
  );
}

async function updateTransaction(id: TransactionId, fields: UpdateTransactionFields): Promise<void> {
  // ... dynamic UPDATE
  updates.push('dirty_sync = ?');
  params.push(1);  // ✅ Marks for sync
}

async function deleteTransaction(id: TransactionId): Promise<void> {
  await database.execute(
    'UPDATE transactions SET status = ?, dirty_sync = ?, updated_at = ? WHERE id = ?',
    ['deleted', 1, now, id],  // ✅ Soft delete + mark for sync
  );
}
```

### What We Need to Build

**Phase 1: Core Sync Service** (~4h)
```typescript
// app/src/02_modules/sync/services/syncService.ts

class SyncService {
  // Query dirty records and sync to cloud
  async syncDirtyTransactions(): Promise<SyncResult> {
    const dirty = await transactionDb.fetchDirtyTransactions();
    if (dirty.length === 0) return { synced: 0, failed: [], queued: 0 };

    if (!networkMonitor.isOnline()) {
      // Offline: add to queue
      dirty.forEach(tx => syncStore.addToQueue(createSyncAction(tx)));
      return { synced: 0, failed: [], queued: dirty.length };
    }

    try {
      // Online: sync to cloud
      const result = await transactionApi.syncTransactions(userId, dirty);

      // Clear dirty flag for synced records
      await transactionDb.clearDirtyFlags(result.synced);

      // Queue failed records for retry
      result.failed.forEach(id => syncStore.addToQueue(...));

      return result;
    } catch (e) {
      // Network error: queue all for retry
      dirty.forEach(tx => syncStore.addToQueue(createSyncAction(tx)));
      throw e;
    }
  }

  // Process offline queue when reconnect
  async processQueue(): Promise<void> {
    const queue = syncStore.getQueue();
    if (queue.length === 0) return;

    syncStore.setSyncStatus(true);

    for (const action of queue) {
      try {
        await this.syncSingleAction(action);
        syncStore.removeFromQueue(action.id);
      } catch (e) {
        logger.error('Queue process failed', { action, error: e });
      }
    }

    syncStore.setSyncStatus(false);
  }

  // Fetch cloud data for recovery
  async fetchCloudData(userId: UserId): Promise<Transaction[]> {
    return transactionApi.fetchAllTransactions(userId);
  }

  // Merge cloud data into local (LWW conflict resolution)
  async mergeCloudData(cloudTxs: Transaction[]): Promise<MergeResult> {
    const localTxs = await transactionDb.fetchAllTransactions();
    const localMap = new Map(localTxs.map(tx => [tx.id, tx]));

    const toInsert: Transaction[] = [];
    const toUpdate: Transaction[] = [];
    let conflicts = 0;

    for (const cloudTx of cloudTxs) {
      const localTx = localMap.get(cloudTx.id);

      if (!localTx) {
        // New record from cloud
        toInsert.push(cloudTx);
      } else {
        // Conflict: compare updated_at (LWW)
        if (cloudTx.updatedAt > localTx.updatedAt) {
          toUpdate.push(cloudTx);
          conflicts++;
        }
        // If local newer, keep local (no action)
      }
    }

    // Bulk upsert
    await transactionDb.bulkUpsert([...toInsert, ...toUpdate]);

    return { inserted: toInsert.length, updated: toUpdate.length, conflicts };
  }
}
```

**Phase 2: Network Monitoring** (~2h)
```typescript
// app/src/02_modules/sync/utils/networkMonitor.ts

class NetworkMonitor {
  private isOnline = navigator.onLine;
  private listeners: Array<(online: boolean) => void> = [];

  constructor() {
    window.addEventListener('online', () => this.handleStatusChange(true));
    window.addEventListener('offline', () => this.handleStatusChange(false));
  }

  private handleStatusChange(online: boolean) {
    this.isOnline = online;
    syncStore.setOnlineStatus(online);

    // Trigger queue processing on reconnect
    if (online) {
      syncService.processQueue();
    }

    this.listeners.forEach(fn => fn(online));
  }

  subscribe(fn: (online: boolean) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  getStatus(): boolean {
    return this.isOnline;
  }
}

export const networkMonitor = new NetworkMonitor();
```

**Phase 3: Lambda Endpoints** (~2h)

**Endpoint 1: POST /transactions/sync**
```javascript
// infra/lambda/sync-transactions/index.mjs

export async function handler(event) {
  const body = JSON.parse(event.body);
  const { userId, transactions } = SyncRequestSchema.parse(body);

  const synced = [];
  const failed = [];

  for (const tx of transactions) {
    try {
      await dynamodb.put({
        TableName: process.env.TRANSACTIONS_TABLE,
        Item: {
          userId,
          transactionId: tx.id,
          imageId: tx.imageId,
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          merchant: tx.merchant,
          description: tx.description,
          date: tx.date,
          confirmedAt: tx.confirmedAt,
          updatedAt: tx.updatedAt,
          status: tx.status,
          createdAt: tx.createdAt,
        },
      });
      synced.push(tx.id);
    } catch (e) {
      logger.error('Sync failed', { txId: tx.id, error: e });
      failed.push(tx.id);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ synced: synced.length, failed }),
  };
}
```

**Endpoint 2: GET /transactions?userId={userId}**
```javascript
// infra/lambda/get-transactions/index.mjs

export async function handler(event) {
  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };
  }

  const result = await dynamodb.query({
    TableName: process.env.TRANSACTIONS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
  });

  const transactions = result.Items.map(item => ({
    id: item.transactionId,
    userId: item.userId,
    imageId: item.imageId,
    type: item.type,
    category: item.category,
    amount: item.amount,
    merchant: item.merchant,
    description: item.description,
    date: item.date,
    confirmedAt: item.confirmedAt,
    updatedAt: item.updatedAt,
    status: item.status,
    createdAt: item.createdAt,
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ transactions }),
  };
}
```

**Phase 4: Data Recovery** (~2h)
```typescript
// app/src/02_modules/sync/services/recoveryService.ts

async function detectAndRestore() {
  const localCount = await transactionDb.count();
  const userId = authStore.getUserId();

  if (localCount === 0 && userId && !userId.startsWith('device-')) {
    try {
      const cloudData = await syncService.fetchCloudData(userId);

      if (cloudData.length > 0) {
        // Show recovery prompt
        const shouldRestore = await showRecoveryPrompt(cloudData.length);

        if (shouldRestore) {
          const result = await syncService.mergeCloudData(cloudData);
          logger.info('Recovery complete', result);
          return result;
        }
      }
    } catch (e) {
      logger.error('Recovery failed', { error: e });
    }
  }
}

// Call on app start
// app/src/App.tsx
useEffect(() => {
  detectAndRestore();
}, []);
```

### 改动范围

| 文件 | 类型 | 改动 |
|------|------|------|
| **Sync Module (NEW)** | | |
| `app/src/02_modules/sync/services/syncService.ts` | 新增 | Core sync orchestration |
| `app/src/02_modules/sync/services/recoveryService.ts` | 新增 | Data recovery logic |
| `app/src/02_modules/sync/stores/syncStore.ts` | 新增 | Zustand store for sync state |
| `app/src/02_modules/sync/utils/networkMonitor.ts` | 新增 | Online/offline detection |
| `app/src/02_modules/sync/components/RecoveryPrompt.tsx` | 新增 | Recovery UI |
| `app/src/02_modules/sync/components/SyncStatusIndicator.tsx` | 新增 | Sync status badge |
| `app/src/02_modules/sync/index.ts` | 新增 | Public exports |
| **Transaction Module (MODIFY)** | | |
| `app/src/02_modules/transaction/services/transactionService.ts` | 修改 | Call syncService after operations |
| `app/src/02_modules/transaction/adapters/transactionDb.ts` | 修改 | Add `fetchDirtyTransactions()`, `clearDirtyFlags()`, `bulkUpsert()` |
| `app/src/02_modules/transaction/adapters/transactionApi.ts` | 修改 | Add `syncTransactions()`, `fetchAllTransactions()` |
| **Lambda (NEW)** | | |
| `infra/lambda/sync-transactions/index.mjs` | 新增 | POST /transactions/sync endpoint |
| `infra/lambda/get-transactions/index.mjs` | 新增 | GET /transactions endpoint |
| `infra/lib/yorutsuke-stack.ts` | 修改 | Add new Lambda functions |
| **App** | | |
| `app/src/App.tsx` | 修改 | Call detectAndRestore() on mount |

---

## 3. 实现步骤

### Phase 1: Core Sync Service (4h)

**Step 1.1: Create sync module structure**
- [ ] Create `app/src/02_modules/sync/` directory
- [ ] Create `services/`, `stores/`, `utils/`, `components/` subdirectories
- [ ] Create `index.ts` with exports

**Step 1.2: Implement syncService.ts**
- [ ] `syncDirtyTransactions()` - Query dirty records, call Lambda
- [ ] `processQueue()` - Retry queued actions
- [ ] `fetchCloudData()` - Fetch all transactions from cloud
- [ ] `mergeCloudData()` - LWW conflict resolution
- [ ] Error handling for network failures
- [ ] Logging with traceId (Pillar R)

**Step 1.3: Implement syncStore.ts (Zustand)**
- [ ] State: `isSyncing`, `lastSyncedAt`, `pendingCount`, `queue`, `isOnline`
- [ ] Actions: `addToQueue()`, `removeFromQueue()`, `clearQueue()`
- [ ] Actions: `setSyncStatus()`, `setOnlineStatus()`
- [ ] Persist `lastSyncedAt` to localStorage

**Step 1.4: Update transactionDb.ts**
- [ ] Add `fetchDirtyTransactions(): Promise<Transaction[]>`
- [ ] Add `clearDirtyFlags(ids: TransactionId[]): Promise<void>`
- [ ] Add `bulkUpsert(transactions: Transaction[]): Promise<void>`

**Step 1.5: Update transactionApi.ts**
- [ ] Add `syncTransactions(userId, txs): Promise<SyncResult>`
- [ ] Add `fetchAllTransactions(userId): Promise<Transaction[]>`
- [ ] Zod validation for responses (Pillar B)
- [ ] Mock mode support

**Step 1.6: Integrate with transactionService.ts**
```typescript
// After confirmExistingTransaction()
import { syncService } from '@/02_modules/sync';

async function confirmExistingTransaction(id: TransactionId) {
  await transactionDb.confirmTransaction(id);  // ✅ Sets dirty_sync=1
  transactionStore.updateTransaction(id, { confirmedAt: new Date().toISOString() });

  // NEW: Trigger cloud sync (async, non-blocking)
  syncService.syncDirtyTransactions().catch(e => {
    logger.error('Sync failed', { error: e });
  });
}
```

### Phase 2: Network Monitoring (2h)

**Step 2.1: Implement networkMonitor.ts**
- [ ] Listen to `online` and `offline` events
- [ ] Update `syncStore.isOnline` on status change
- [ ] Trigger `syncService.processQueue()` on reconnect
- [ ] Subscribe pattern for components

**Step 2.2: Create SyncStatusIndicator.tsx**
- [ ] Show "Online" / "Offline" badge
- [ ] Show "Syncing..." during sync
- [ ] Show "X pending" if queue has items
- [ ] Show "Last synced: 5 min ago"
- [ ] Add to TransactionView.tsx header

**Step 2.3: Add offline indicator to UI**
- [ ] Add to status bar or header
- [ ] Use `networkMonitor.subscribe()` to update

### Phase 3: Lambda Endpoints (2h)

**Step 3.1: Create sync-transactions Lambda**
- [ ] Create `infra/lambda/sync-transactions/index.mjs`
- [ ] Zod schema validation for request
- [ ] DynamoDB batch write (PutItem for each transaction)
- [ ] Error handling, logging
- [ ] Return `{ synced: number, failed: TransactionId[] }`

**Step 3.2: Create get-transactions Lambda**
- [ ] Create `infra/lambda/get-transactions/index.mjs`
- [ ] Query DynamoDB by userId (GSI or primary key)
- [ ] Return all transactions (including deleted)
- [ ] Zod validation for response

**Step 3.3: Update CDK stack**
- [ ] Add new Lambda functions to `yorutsuke-stack.ts`
- [ ] Grant DynamoDB read/write permissions
- [ ] Add API Gateway routes: `POST /transactions/sync`, `GET /transactions`
- [ ] Deploy with `npm run deploy -- --all`

### Phase 4: Data Recovery (2h)

**Step 4.1: Create recoveryService.ts**
- [ ] `detectAndRestore()` - Check for cloud data on empty local
- [ ] Call on app start (App.tsx)
- [ ] Show recovery prompt if cloud data exists

**Step 4.2: Create RecoveryPrompt.tsx**
- [ ] Modal component
- [ ] Show transaction count: "Found 25 transactions in cloud"
- [ ] Buttons: "Restore" / "Skip"
- [ ] Progress bar during restore
- [ ] Success message after restore

**Step 4.3: Integrate with App.tsx**
```typescript
// app/src/App.tsx
import { detectAndRestore } from '@/02_modules/sync';

useEffect(() => {
  detectAndRestore();
}, []);
```

### Phase 5: Testing & Documentation (1h)

**Step 5.1: Unit tests**
- [ ] `syncService.test.ts` - Test sync logic, conflict resolution
- [ ] `networkMonitor.test.ts` - Test online/offline detection
- [ ] `recoveryService.test.ts` - Test merge logic

**Step 5.2: Integration tests**
- [ ] SC-1500: Sync confirmed transaction
- [ ] SC-1503: Offline queue
- [ ] SC-1510: Data recovery on new device
- [ ] SC-1520: Conflict resolution (LWW)

**Step 5.3: Documentation**
- [ ] Update MEMORY.md with sync design decisions
- [ ] Update CHANGELOG.md
- [ ] Run `*review` post-code checklist

---

## 4. 测试用例

### Unit Tests: syncService.ts

| Case | Input | Expected |
|------|-------|----------|
| UT-1.1 | 3 dirty records, online | POST to Lambda, clear dirty flags |
| UT-1.2 | 3 dirty records, offline | Add to queue, return queued=3 |
| UT-1.3 | Lambda fails (500) | Add to queue, throw error |
| UT-1.4 | Conflict (cloud newer) | Cloud wins, upsert to local |
| UT-1.5 | Conflict (local newer) | Local wins, no action |

### Integration Tests: Full Flow

**SC-1500: Sync confirmed transaction**
- When: Confirm unconfirmed transaction
- Then:
  - [ ] SQLite: `dirty_sync=1`
  - [ ] Wait 2s (sync interval)
  - [ ] DynamoDB: transaction has `confirmedAt`
  - [ ] SQLite: `dirty_sync=0`

**SC-1501: Sync edited transaction**
- When: Edit confirmed transaction (change amount)
- Then:
  - [ ] SQLite: `dirty_sync=1`
  - [ ] Sync completes
  - [ ] DynamoDB: amount updated, `updatedAt` matches

**SC-1502: Sync deleted transaction**
- When: Delete transaction
- Then:
  - [ ] SQLite: `status='deleted'`, `dirty_sync=1`
  - [ ] Sync completes
  - [ ] DynamoDB: record marked as deleted

**SC-1503: Offline queue**
- When: Disconnect network, confirm transaction
- Then:
  - [ ] Sync status shows "Pending (1)"
  - [ ] Reconnect network
  - [ ] Auto-sync triggers, status shows "Synced"

**SC-1504: Sync failure retry**
- When: Mock Lambda failure (return 500), confirm transaction
- Then:
  - [ ] Added to retry queue
  - [ ] Fix Lambda, auto-retry succeeds

**SC-1510: Detect cloud data on new device**
- When: Fresh install, login with existing user
- Then:
  - [ ] Recovery prompt appears
  - [ ] Click "Restore"
  - [ ] All cloud transactions appear in ledger

**SC-1511: Recovery without data loss**
- When: Login on Device A (confirm 5 transactions), login on Device B (fresh install)
- Then:
  - [ ] Restore cloud data
  - [ ] All 5 transactions present on Device B

**SC-1520: Conflict resolution (LWW)**
- When: Device A edits tx-001 (amount=1000), Device B edits tx-001 (amount=2000, later timestamp)
- Then:
  - [ ] Device B syncs
  - [ ] Amount=2000 (Device B won, later timestamp)

---

## 5. 风险 & 依赖

**风险**:
| 风险 | 级别 | 应对 |
|------|------|------|
| Network failures during sync | 高 | Offline queue + auto-retry |
| Race condition (sync while user editing) | 中 | Use LWW, accept data loss (rare case) |
| Large queue (>100 actions) | 低 | Batch processing, pagination if needed |
| Lambda timeout (>29s) | 低 | Batch sync in chunks of 25 records |

**依赖**:
- ✅ Issue #116 - Transaction Confirmation (`dirty_sync` flag) - COMPLETE
- ✅ Local SQLite operations - COMPLETE
- [ ] Lambda: `sync-transactions` endpoint - NEW
- [ ] Lambda: `get-transactions` endpoint - NEW
- [ ] DynamoDB: Read/write access - EXISTS
- [ ] Network status API - NEW

**技术决策**:
- **Why dirty_sync flag?**: Simple, reliable, survives app restart
- **Why soft delete?**: Sync compatibility, audit trail, cross-device consistency
- **Why Last-Write-Wins?**: Simple, conflicts rare, acceptable for MVP3.5
- **Why async sync?**: Non-blocking UX, offline support, batch efficiency

---

## 6. Pillar 遵循

| Pillar | 应用 |
|--------|------|
| **A: Nominal Types** | Use `TransactionId`, `UserId` (not `string`) |
| **B: Airlock** | Validate all API responses with Zod schema |
| **D: FSM** | Sync state: `'idle' \| 'syncing' \| 'success' \| 'error'` |
| **F: Concurrency** | LWW conflict resolution (compare `updatedAt`) |
| **L: Headless** | No sync logic in views, only in services |
| **M: Saga** | Compensation for failed syncs (queue + retry) |
| **Q: Idempotency** | Sync is idempotent (safe to retry) |
| **R: Observability** | Log sync events: `{ event: 'SYNC_STARTED', userId, count }` |

---

## 7. 进度

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-01-12 | 规划完成 | Feature plan ready |
| | 开发中 | After `*approve` |
| | 完成 | After tests pass + `*issue close` |

---

*开发前确认*:
- [x] 方案已确认，无 open questions
- [x] Issue #116 foundation ready (`dirty_sync` flag)
- [x] 测试用例覆盖完整 (unit + integration)
- [ ] User approves plan → ready to start coding
