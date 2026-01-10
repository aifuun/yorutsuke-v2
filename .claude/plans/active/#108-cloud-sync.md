# Feature Plan: #108 Cloud Sync for Transactions

> **Step 2 of Two-Step Planning** - 在开发前完成详细规划

| 项目 | 值 |
|------|-----|
| Issue | #108 |
| MVP | MVP4 (Sync & Offline) |
| 复杂度 | T2 |
| 预估 | 3-4h |
| 状态 | [x] 规划 / [ ] 开发中 / [ ] Review / [ ] 完成 |

---

## 1. 目标

**做什么**: Implement cloud-to-local synchronization for transactions

**为什么**:
- Transactions are processed in cloud (Lambda → DynamoDB) but app reads from local SQLite
- Current gap breaks "local-first" architecture promise
- Users can't see their processed transactions without sync

**验收标准**:
- [ ] Download transactions from DynamoDB via API
- [ ] Upsert to local SQLite (merge, no duplicates)
- [ ] Conflict resolution (cloud vs local edits)
- [ ] Show sync status in UI (last synced, syncing...)
- [ ] Manual sync trigger button works
- [ ] Auto-sync on app startup
- [ ] Auto-sync after image upload completes
- [ ] Handle offline/network errors gracefully
- [ ] All tests passing (unit + integration)

---

## 2. 实现方案

### 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Sync Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Action                                                │
│      ↓                                                      │
│  TransactionView.tsx                                        │
│      ↓                                                      │
│  useSyncLogic (headless) ← NEW                             │
│      ├─→ transactionApi.fetchTransactions() ← NEW          │
│      │   (GET from DynamoDB via Lambda)                     │
│      │                                                      │
│      └─→ syncService.syncTransactions() ← NEW              │
│          (Conflict resolution + merge)                      │
│              ↓                                              │
│          transactionDb.saveTransaction()                    │
│          (Upsert to SQLite)                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Schema Alignment

**Local SQLite (BEFORE)**:
```sql
CREATE TABLE transactions (
  id, user_id, image_id, type, category, amount, currency,
  description, merchant, date, created_at, updated_at,
  confirmed_at, confidence, raw_text
);
```

**Local SQLite (AFTER)** - Add missing fields:
```sql
ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'unconfirmed';
ALTER TABLE transactions ADD COLUMN version INTEGER DEFAULT 1;
```

**Field Mapping (Cloud → Local)**:
| Cloud (DynamoDB) | Local (SQLite) | Note |
|------------------|----------------|------|
| `transactionId` | `id` | Primary key |
| `userId` | `user_id` | FK |
| `imageId` | `image_id` | FK (nullable) |
| `status` | `status` | NEW field |
| `version` | `version` | NEW field (for future concurrency control) |
| `validationErrors` | (skip) | Don't store locally |
| `isGuest` | (skip) | Derived from `user_id` prefix |
| `ttl` | (skip) | Cloud-only |

### Conflict Resolution Strategy

**When**: Cloud and local have same `transactionId` but different data

**Rules**:
1. **Local confirmed, cloud not** → Local wins (user has manually confirmed)
2. **Cloud `updatedAt` > Local `updatedAt`** → Cloud wins (newer data)
3. **Local `updatedAt` > Cloud `updatedAt`** → Local wins (local edits)
4. **Same `updatedAt`** → Cloud wins (default to source of truth)

**Implementation**:
```typescript
function resolveConflict(cloudTx: Transaction, localTx: Transaction): Transaction {
  // Rule 1: Local confirmed takes priority
  if (localTx.confirmedAt && !cloudTx.confirmedAt) return localTx;

  // Rule 2-4: Compare updatedAt
  if (cloudTx.updatedAt > localTx.updatedAt) return cloudTx;
  if (localTx.updatedAt > cloudTx.updatedAt) return localTx;
  return cloudTx; // Default to cloud
}
```

### 改动范围

| 文件 | 类型 | 改动 |
|------|------|------|
| **Adapters** | | |
| `app/src/02_modules/transaction/adapters/transactionApi.ts` | 新增 | Cloud API adapter |
| `app/src/02_modules/transaction/adapters/transactionDb.ts` | 修改 | Add `upsertTransaction()` |
| `app/src/02_modules/transaction/adapters/index.ts` | 修改 | Export `transactionApi` |
| **Services** | | |
| `app/src/02_modules/transaction/services/syncService.ts` | 新增 | Sync orchestration |
| `app/src/02_modules/transaction/services/index.ts` | 新增 | Exports |
| **Headless** | | |
| `app/src/02_modules/transaction/headless/useSyncLogic.ts` | 新增 | Sync state management |
| `app/src/02_modules/transaction/headless/index.ts` | 修改 | Export `useSyncLogic` |
| **Views** | | |
| `app/src/02_modules/transaction/views/TransactionView.tsx` | 修改 | Add sync UI + auto-sync |
| **Database** | | |
| `app/src-tauri/migrations/0005_add_transaction_sync_fields.sql` | 新增 | Schema migration |
| **Tests** | | |
| `app/src/02_modules/transaction/adapters/transactionApi.test.ts` | 新增 | API adapter tests |
| `app/src/02_modules/transaction/services/syncService.test.ts` | 新增 | Sync logic tests |

### 实现步骤

**Phase 1: Schema + API Adapter** (~1.5h)
- [ ] Create migration `0005_add_transaction_sync_fields.sql`
  - Add `status TEXT DEFAULT 'unconfirmed'`
  - Add `version INTEGER DEFAULT 1`
- [ ] Create `transactionApi.ts` adapter
  - Implement `fetchTransactions(userId): Promise<Transaction[]>`
  - Use Zod schema validation (Pillar B)
  - Add timeout handling (10s timeout)
  - Add mock mode support (check `isMockingOnline()`)
  - Error handling for 400/403/429/500
- [ ] Update `transactionDb.ts`
  - Modify `mapDbToTransaction()` to include new fields
  - Add `upsertTransaction()` function (INSERT OR REPLACE)
- [ ] Unit tests for `transactionApi.ts`
  - TC-1.1: Successful fetch returns parsed transactions
  - TC-1.2: Network timeout throws error
  - TC-1.3: Invalid response fails Zod validation
  - TC-1.4: 403 error handled correctly

**Phase 2: Sync Service** (~1h)
- [ ] Create `syncService.ts`
  - Implement `syncTransactions(userId): Promise<SyncResult>`
  - Fetch from cloud via `transactionApi.fetchTransactions()`
  - Fetch local via `transactionDb.fetchTransactions()`
  - Merge logic with conflict resolution
  - Upsert resolved transactions via `transactionDb.upsertTransaction()`
  - Return `{ synced: number, conflicts: number, errors: string[] }`
- [ ] Add conflict resolution helper
  - `resolveConflict(cloud, local): Transaction`
- [ ] Unit tests for `syncService.ts`
  - TC-2.1: Empty local, fetch cloud → insert all
  - TC-2.2: Conflict (cloud newer) → cloud wins
  - TC-2.3: Conflict (local confirmed) → local wins
  - TC-2.4: No conflicts → no changes

**Phase 3: Headless Hook + UI** (~1h)
- [ ] Create `useSyncLogic.ts` headless hook
  - FSM state: `'idle' | 'syncing' | 'success' | 'error'`
  - Action: `sync(): Promise<void>`
  - Track: `lastSyncedAt`, `syncCount`, `error`
  - Use `syncService.syncTransactions()`
  - Persist `lastSyncedAt` to localStorage
- [ ] Update `TransactionView.tsx`
  - Add "Sync Now" button
  - Show sync status ("Last synced: 2 min ago" or "Syncing...")
  - Disable button during sync
  - Auto-sync on mount (if `lastSyncedAt` > 5 min ago)
- [ ] UI tests
  - TC-3.1: Click "Sync Now" → triggers sync
  - TC-3.2: During sync → button disabled
  - TC-3.3: After sync → shows "Last synced: just now"

**Phase 4: Auto-Sync Triggers** (~0.5h)
- [ ] Add auto-sync after image upload
  - In `uploadService` (or equivalent), trigger sync after successful upload
  - Wait 3 seconds (allow Lambda to process)
  - Call `sync()` from `useSyncLogic`
- [ ] Integration test
  - TC-4.1: Upload image → wait → check transactions synced

**Phase 5: Tests + Documentation** (~0.5h)
- [ ] Integration test: Full sync flow
  - Mock cloud API with 5 transactions
  - Mock local DB with 2 transactions (1 conflict)
  - Run sync → verify 5 transactions in local DB
- [ ] Update MEMORY.md with sync design decisions
- [ ] Run `*review` post-code checklist

---

## 3. 测试用例

### Unit Tests: transactionApi.ts

| Case | 输入 | 期望 |
|------|------|------|
| TC-1.1 | Valid API response | Transactions parsed, Zod validates |
| TC-1.2 | Network timeout (>10s) | Throws timeout error |
| TC-1.3 | Invalid JSON response | Zod parse fails, throws error |
| TC-1.4 | 403 error | Throws "Unauthorized" error |
| TC-1.5 | Mock mode enabled | Returns mock transactions |

### Unit Tests: syncService.ts

| Case | 输入 | 期望 |
|------|------|------|
| TC-2.1 | Cloud: 5 tx, Local: 0 tx | Insert all 5, synced=5 |
| TC-2.2 | Cloud: newer `updatedAt` | Cloud wins, upserted |
| TC-2.3 | Local: confirmed, Cloud: not | Local wins, no change |
| TC-2.4 | Same `updatedAt` | Cloud wins (default) |
| TC-2.5 | Network error during fetch | Returns error in `SyncResult` |

### Integration Tests: Full Sync Flow

**TC-3.1: First sync (empty local)**
- Given: Local DB has 0 transactions
- Given: Cloud API returns 3 transactions
- When: Call `syncTransactions(userId)`
- Then:
  - [ ] All 3 transactions inserted to local DB
  - [ ] `SyncResult.synced = 3`
  - [ ] `SyncResult.conflicts = 0`

**TC-3.2: Sync with conflict (cloud newer)**
- Given: Local has transaction T1 (`updatedAt: 2026-01-01T10:00:00Z`)
- Given: Cloud has transaction T1 (`updatedAt: 2026-01-01T11:00:00Z`)
- When: Call `syncTransactions(userId)`
- Then:
  - [ ] Local T1 updated to cloud version
  - [ ] `SyncResult.synced = 1`
  - [ ] `SyncResult.conflicts = 1`

**TC-3.3: Sync with conflict (local confirmed)**
- Given: Local has T1 (`confirmedAt: 2026-01-01T10:00:00Z`)
- Given: Cloud has T1 (`confirmedAt: null`)
- When: Call `syncTransactions(userId)`
- Then:
  - [ ] Local T1 unchanged (local wins)
  - [ ] `SyncResult.synced = 0`
  - [ ] `SyncResult.conflicts = 1`

**TC-3.4: Auto-sync after upload**
- Given: User uploads receipt image
- When: Upload succeeds → wait 3s → auto-sync
- Then:
  - [ ] Sync triggered automatically
  - [ ] New transaction appears in TransactionView

**TC-3.5: Offline mode**
- Given: Mock offline mode enabled
- When: Call `syncTransactions(userId)`
- Then:
  - [ ] Returns error "Network error: offline mode"
  - [ ] Local DB unchanged
  - [ ] UI shows error message

### UI Tests (Manual)

**SC-108-1: Manual sync button**
- When: User clicks "Sync Now" button
- Then: Button shows "Syncing...", disabled, re-enabled after sync

**SC-108-2: Last synced timestamp**
- Given: Last sync was 5 min ago
- Then: UI shows "Last synced: 5 min ago"

**SC-108-3: Auto-sync on startup**
- Given: Last sync > 5 min ago
- When: App opens
- Then: Auto-sync triggered in background

---

## 4. 风险 & 依赖

**风险**:
| 风险 | 级别 | 应对 |
|------|------|------|
| Schema mismatch (Cloud vs Local) | 中 | Add schema migration, map fields explicitly |
| Conflict resolution bugs | 中 | Comprehensive unit tests, clear rules |
| Network timeout during sync | 低 | 10s timeout, graceful error handling |
| Large dataset (>1000 transactions) | 低 | Document limitation, add pagination in future |

**依赖**:
- [ ] TransactionsLambda API deployed and accessible
- [ ] Local SQLite schema updated (migration 0005)
- [ ] Mock mode toggle in Debug panel (for testing)

**技术决策**:
- **Conflict resolution**: Local confirmed wins > Cloud timestamp wins
  - **Rationale**: User's manual confirmation is highest authority
- **No push to cloud**: This is pull-only sync (cloud is source of truth)
  - **Future**: MVP5 may add bidirectional sync
- **No pagination**: Fetch all transactions for user
  - **Rationale**: Most users <100 transactions, acceptable for MVP4
  - **Future**: Add pagination if >1000 transactions

---

## 5. Pillar 遵循

| Pillar | 应用 |
|--------|------|
| **A: Nominal Types** | Use `TransactionId`, `UserId` (not `string`) |
| **B: Airlock** | Validate all API responses with Zod schema |
| **D: FSM** | Sync state: `'idle' \| 'syncing' \| 'success' \| 'error'` |
| **L: Headless** | `useSyncLogic` returns `{state, sync}`, no JSX |
| **Q: Idempotency** | Sync is idempotent (safe to retry) |
| **R: Observability** | Log sync events: `{ event: 'SYNC_STARTED', userId, count }` |

---

## 6. 进度

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-01-09 | 规划完成 | Feature plan ready |
| | 开发中 | After `*approve` |
| | 完成 | After tests pass + `*issue close` |

---

*开发前确认*:
- [x] 方案已确认，无 open questions
- [x] 依赖已就绪 (TransactionsLambda deployed)
- [x] 测试用例覆盖完整 (unit + integration)
- [ ] User approves plan → ready to `*approve` and start coding
