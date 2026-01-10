# Feature Plan: #112 Enforce 4-layer architecture in headless hooks

> **Step 2 of Two-Step Planning** - Refactor before MVP4 feature work

| 项目 | 值 |
|------|-----|
| Issue | #112 |
| MVP | Tech Debt (pre-MVP4) |
| 复杂度 | T2 - Logic (mechanical refactoring) |
| 预估 | 4h |
| 状态 | [x] 规划 / [ ] 开发中 / [ ] Review / [ ] 完成 |

---

## 1. 目标

**做什么**: Refactor headless hooks to call Services instead of Adapters directly

**为什么**:
- Enforce consistent 4-layer architecture across codebase
- Improve testability (services can be mocked easily)
- Align with ADR-001 Service Pattern

**验收标准**:
- [ ] No headless hook imports from `adapters/` directly
- [ ] All adapter calls go through service layer
- [ ] Existing functionality preserved (no regressions)
- [ ] All 105+ tests pass

---

## 2. 实现方案

### 改动范围

| 文件 | 类型 | 改动 |
|------|------|------|
| `transaction/services/transactionService.ts` | 新增 | CRUD operations wrapper |
| `transaction/headless/useTransactionLogic.ts` | 修改 | Import from service |
| `auth/services/authService.ts` | 新增 | Auth operations wrapper |
| `auth/headless/useAuth.ts` | 修改 | Import from service |
| `auth/headless/useEffectiveUserId.ts` | 修改 | Import from service |
| `settings/services/settingsService.ts` | 新增 | Settings operations wrapper |
| `settings/headless/useSettings.ts` | 修改 | Import from service |

### 实现步骤

**Phase 1: Transaction Module** (~1.5h)

- [ ] Create `transactionService.ts` with Pure TS functions:
  - `loadTransactions(userId, options)` → wraps `fetchTransactions`
  - `countTransactions(userId, options)` → wraps `countTransactions`
  - `saveTransaction(tx)` → wraps `saveTransaction`
  - `removeTransaction(id)` → wraps `deleteTransaction`
  - `confirmTransaction(id)` → wraps `confirmTransaction`
- [ ] Update `services/index.ts` to export new service
- [ ] Refactor `useTransactionLogic.ts` to import from service
- [ ] Verify transaction functionality works

**Phase 2: Auth Module** (~1h)

- [ ] Create `auth/services/authService.ts` with Pure TS functions:
  - `signIn(username, password)` → wraps authApi
  - `signOut()` → wraps authApi
  - `getGuestId()` → wraps tokenStorage
  - etc.
- [ ] Create `auth/services/index.ts`
- [ ] Refactor `useAuth.ts` to import from service
- [ ] Refactor `useEffectiveUserId.ts` to import from service
- [ ] Verify auth functionality works

**Phase 3: Settings Module** (~1h)

- [ ] Create `settings/services/settingsService.ts` with Pure TS functions:
  - `loadSettings()` → wraps settingsDb
  - `updateSetting(key, value)` → wraps settingsDb
- [ ] Create `settings/services/index.ts`
- [ ] Refactor `useSettings.ts` to import from service
- [ ] Verify settings functionality works

**Phase 4: Verification** (~0.5h)

- [ ] Run `npm test` - all 105+ tests pass
- [ ] Run `npm run tauri dev` - manual smoke test
- [ ] Verify no headless hook imports adapters: `grep -r "from.*adapters" app/src/**/headless/`

---

## 3. 测试用例

### 回归测试 (现有测试)

| 模块 | 测试文件 | 验证 |
|------|----------|------|
| Transaction | `transactionDb.test.ts` | Adapter tests unchanged |
| Transaction | `syncService.test.ts` | Service tests pass |
| Auth | Existing auth tests | Auth flow works |
| Settings | Existing settings tests | Settings work |

### 场景测试 (手动)

| ID | 场景 | 预期 |
|----|------|------|
| SC-001 | Load transaction list | Transactions display correctly |
| SC-002 | Confirm transaction | Confirmation works, UI updates |
| SC-003 | Delete transaction | Soft delete works |
| SC-004 | Login/logout | Auth flow unchanged |
| SC-005 | Change settings | Settings persist |

---

## 4. 风险 & 依赖

**风险**:
| 风险 | 级别 | 应对 |
|------|------|------|
| 功能回归 | 低 | 现有测试覆盖，手动验证 |
| 遗漏改动 | 低 | grep 验证无直接 adapter 导入 |

**依赖**:
- [x] 无前置 Issue
- [x] 参考模式: `capture/services/captureService.ts`

---

## 5. Service Pattern Reference

**From capture module (correct pattern):**

```typescript
// services/transactionService.ts (Pure TS, no React)
import { fetchTransactions, saveTransaction, ... } from '../adapters/transactionDb';

export async function loadTransactions(
  userId: UserId,
  options: FetchTransactionsOptions
): Promise<Transaction[]> {
  return fetchTransactions(userId, options);
}

export async function removeTransaction(id: TransactionId): Promise<void> {
  return deleteTransaction(id);
}
// ... etc
```

```typescript
// headless/useTransactionLogic.ts (React hook)
import { loadTransactions, removeTransaction, ... } from '../services/transactionService';
// NOT: import { fetchTransactions } from '../adapters/transactionDb';
```

---

## 6. 进度

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-01-10 | 规划完成 | |
| | 开发中 | |
| | 完成 | |

---

*开发前确认*:
- [x] 方案已确认，无 open questions
- [x] 依赖已就绪
- [x] 测试用例覆盖完整
