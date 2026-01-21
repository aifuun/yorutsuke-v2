# Feature Plan: #112 Enforce 4-layer architecture in headless hooks

> **Step 2 of Two-Step Planning** - Refactor before MVP4 feature work

| 项目 | 值 |
|------|-----|
| Issue | #112 |
| MVP | Tech Debt (pre-MVP4) |
| 复杂度 | T2 - Logic (mechanical refactoring) |
| 预估 | 4h |
| 状态 | [x] 规划 / [x] 开发中 / [ ] Review / [x] 完成 |

---

## 1. 目标

**做什么**: Refactor headless hooks to call Services instead of Adapters directly

**为什么**:
- Enforce consistent 4-layer architecture across codebase
- Improve testability (services can be mocked easily)
- Align with ADR-001 Service Pattern

**验收标准**:
- [x] No headless hook imports from `adapters/` directly
- [x] All adapter calls go through service layer
- [x] Existing functionality preserved (no regressions)
- [x] All 105+ tests pass

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

- [x] Create `transactionService.ts` with Pure TS functions:
  - [x] `loadTransactions(userId, options)` → wraps `fetchTransactions`
  - [x] `countTotalTransactions(userId, options)` → wraps `countTransactions`
  - [x] `saveNewTransaction(tx)` → wraps `saveTransaction`
  - [x] `removeTransaction(id)` → wraps `deleteTransaction`
  - [x] `confirmExistingTransaction(id)` → wraps `confirmTransaction`
- [x] Update `services/index.ts` to export new service
- [x] Refactor `useTransactionLogic.ts` to import from service
- [x] Verify transaction functionality works

**Phase 2: Auth Module** (~1h)

- [x] Create `auth/services/authService.ts` with Pure TS functions:
  - [x] `registerUser(email, password)` → wraps authApi
  - [x] `verifyUserEmail(email, code)` → wraps authApi
  - [x] `loginUser(email, password)` → wraps authApi
  - [x] `logoutUser()` → wraps authApi
  - [x] `refreshAccessToken()` → wraps authApi
  - [x] `loadUserSession()` → wraps tokenStorage
  - [x] `saveUserTokens(tokens)` → wraps tokenStorage
  - [x] `saveUserProfile(user)` → wraps tokenStorage
  - [x] `getGuestDeviceId()` → wraps tokenStorage
  - [x] `getStoredGuestId()` → wraps tokenStorage
  - [x] `clearStoredTokens()` → wraps tokenStorage
- [x] Create `auth/services/index.ts`
- [x] Refactor `useAuth.ts` to import from service
- [x] Refactor `useEffectiveUserId.ts` to import from service
- [x] Verify auth functionality works

**Phase 3: Settings Module** (~1h)

- [x] Create `settings/services/settingsService.ts` with Pure TS functions:
  - [x] `loadAppSettings()` → wraps settingsDb
  - [x] `updateAppSetting(key, value)` → wraps settingsDb
- [x] Create `settings/services/index.ts`
- [x] Refactor `useSettings.ts` to import from service
- [x] Verify settings functionality works

**Phase 4: Verification** (~0.5h)

- [x] Run `npm test` - all 105+ tests pass
- [x] Run `npm run tauri dev` - manual smoke test
- [x] Verify no headless hook imports adapters: `grep -r "from.*adapters" app/src/**/headless/`

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
| 2026-01-10 | 开发完成 | 3 services 创建，3 headless hooks 重构，105 tests pass |
| | 完成 | |

---

*开发前确认*:
- [x] 方案已确认，无 open questions
- [x] 依赖已就绪
- [x] 测试用例覆盖完整
