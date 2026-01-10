# Feature Plan: #114 Dashboard Yesterday's Summary

> **Step 2 of Two-Step Planning** - UI-first approach with mock data validation

| 项目 | 值 |
|------|-----|
| Issue | #114 |
| MVP | MVP3 |
| 复杂度 | T1 |
| 预估 | 5h (4h original + 1h for breakdown) |
| 状态 | [x] 规划 / [ ] 开发中 / [ ] Review / [ ] 完成 |

---

## 1. 目标

**做什么**: Display **yesterday's** income/expense summary with confirmed/unconfirmed breakdown

**为什么**: Users check dashboard in the morning to review yesterday's completed business activity

**架构决策**: 🎯 **Local-First Reactive View**
- Reports are a "live lens" into local SQLite data
- User confirmations/deletions update reports **immediately**
- Cloud = Storage Backup, Local DB = User Reality
- Show sync status indicator ("Last synced: 2 min ago")

**验收标准**:
- [ ] Display **yesterday's** income total (with breakdown)
- [ ] Display **yesterday's** expense total (with breakdown)
- [ ] Display net profit (income - expense)
- [ ] Show confirmed vs unconfirmed amounts (live reactive)
- [ ] Show pending confirmation count
- [ ] Show upload queue status (Ready/Processing)
- [ ] Show sync status indicator (last synced time)
- [ ] **Reactive updates**: Confirm/delete yesterday's tx → report updates instantly
- [ ] Handle empty state (no transactions yesterday)
- [ ] All SC-900~921 test scenarios pass

---

## 2. 实现方案

### 🎨 UI-First Approach (Recommended)

**Phase 1: Design & Mock Data** (~2h)
- Design the breakdown UI (confirmed/unconfirmed display)
- Create mock data for different scenarios
- Implement UI with mocked values
- Get user approval on design/UX

**Phase 2: Data Integration** (~2h)
- Implement yesterday date calculation
- Add confirmed/unconfirmed filtering logic
- Integrate with real transaction data
- Update domain functions if needed

**Phase 3: Testing & Polish** (~1h)
- Write test cases SC-900~921
- Edge case handling
- i18n translations
- Manual testing

### 改动范围

| 文件 | 类型 | 改动 | Phase |
|------|------|------|-------|
| `app/src/02_modules/report/views/DashboardView.tsx` | 修改 | UI redesign with breakdown | Phase 1 |
| `app/src/01_domains/transaction/rules.ts` | 修改 | Add breakdown calculation function | Phase 2 |
| `app/src/02_modules/capture/index.ts` | 修改 | Export useCaptureStats | Phase 2 |
| `app/src/i18n/locales/en.json` | 修改 | Add translation keys | Phase 1 |
| `app/src/i18n/locales/ja.json` | 修改 | Add translation keys | Phase 1 |

---

## 3. Phase 1: UI Design with Mock Data (2h)

### Step 1.1: Design the Breakdown UI (~30min)

**Current Hero Card**:
```
┌─────────────────────────────────┐
│ Today's Balance                 │
│ ↑ ¥20,000                       │
│                                 │
│ +¥50,000 Income                 │
│ -¥30,000 Expense                │
└─────────────────────────────────┘
```

**New Design - Option A (Inline Breakdown)**:
```
┌─────────────────────────────────┐
│ Yesterday's Balance             │
│ ↑ ¥20,000                       │
│                                 │
│ +¥50,000 Income                 │
│   └─ ✓ ¥45,000 | ⏳ ¥5,000    │
│ -¥30,000 Expense                │
│   └─ ✓ ¥28,000 | ⏳ ¥2,000    │
└─────────────────────────────────┘
```

**New Design - Option B (Separate Section)**:
```
┌─────────────────────────────────┐
│ Yesterday's Balance             │
│ ↑ ¥20,000                       │
│                                 │
│ +¥50,000 Income                 │
│ -¥30,000 Expense                │
│                                 │
│ Status:                         │
│ ✓ ¥73,000 Confirmed             │
│ ⏳ ¥7,000 Pending (3 items)     │
└─────────────────────────────────┘
```

**Decision**: Choose Option A or B based on visual balance

### Step 1.2: Create Mock Data (~15min)

```typescript
// Mock data scenarios for UI testing
const MOCK_SCENARIOS = {
  typical: {
    yesterday: {
      income: { total: 50000, confirmed: 45000, unconfirmed: 5000 },
      expense: { total: 30000, confirmed: 28000, unconfirmed: 2000 },
    },
  },
  allConfirmed: {
    yesterday: {
      income: { total: 50000, confirmed: 50000, unconfirmed: 0 },
      expense: { total: 30000, confirmed: 30000, unconfirmed: 0 },
    },
  },
  allUnconfirmed: {
    yesterday: {
      income: { total: 50000, confirmed: 0, unconfirmed: 50000 },
      expense: { total: 30000, confirmed: 0, unconfirmed: 30000 },
    },
  },
  empty: {
    yesterday: {
      income: { total: 0, confirmed: 0, unconfirmed: 0 },
      expense: { total: 0, confirmed: 0, unconfirmed: 0 },
    },
  },
};
```

### Step 1.3: Implement UI with Mock (~45min)

```typescript
// DashboardView.tsx changes
export function DashboardView({ userId, onViewChange }: DashboardViewProps) {
  // TODO Phase 1: Use mock data
  const MOCK_MODE = true; // Remove in Phase 2
  const yesterdaySummary = MOCK_MODE
    ? MOCK_SCENARIOS.typical.yesterday
    : calculateRealYesterdaySummary();

  const netBalance = yesterdaySummary.income.total - yesterdaySummary.expense.total;
  const isPositive = netBalance >= 0;

  return (
    <div className="card card--hero hero-card">
      <p className="card--hero__title">{t('dashboard.yesterdayBalance')}</p>
      <div className="hero-balance">
        <span className={`hero-arrow ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '↑' : '↓'}
        </span>
        <span className="card--hero__value">
          ¥{Math.abs(netBalance).toLocaleString()}
        </span>
      </div>
      <div className="hero-breakdown">
        <div className="hero-income">
          <span className="hero-value">+¥{yesterdaySummary.income.total.toLocaleString()}</span>
          <span className="hero-label">{t('report.income')}</span>
          {/* NEW: Breakdown */}
          <div className="hero-breakdown-detail">
            <span className="confirmed">✓ ¥{yesterdaySummary.income.confirmed.toLocaleString()}</span>
            {yesterdaySummary.income.unconfirmed > 0 && (
              <span className="unconfirmed">⏳ ¥{yesterdaySummary.income.unconfirmed.toLocaleString()}</span>
            )}
          </div>
        </div>
        {/* Same for expense */}
      </div>
    </div>
  );
}
```

### Step 1.4: Add i18n Translations (~15min)

**en.json**:
```json
{
  "dashboard": {
    "yesterdayBalance": "Yesterday's Balance",
    "yesterdaySummary": "Yesterday's Summary",
    "confirmed": "Confirmed",
    "pending": "Pending",
    "queueStatus": "Queue Status",
    "queueReady": "Ready",
    "queueProcessing": "Processing"
  }
}
```

**ja.json**:
```json
{
  "dashboard": {
    "yesterdayBalance": "昨日の収支",
    "yesterdaySummary": "昨日の精算",
    "confirmed": "確認済",
    "pending": "未確認",
    "queueStatus": "アップロード状況",
    "queueReady": "待機中",
    "queueProcessing": "処理中"
  }
}
```

### Step 1.5: CSS Styling (~15min)

```css
.hero-breakdown-detail {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  opacity: 0.8;
}

.hero-breakdown-detail .confirmed {
  color: var(--color-success);
}

.hero-breakdown-detail .unconfirmed {
  color: var(--color-warning);
}
```

### Phase 1 Deliverable:
- [ ] Visual mockup with 4 scenarios (typical, all confirmed, all unconfirmed, empty)
- [ ] User can switch between scenarios using Debug panel or URL param
- [ ] Ready for design approval

---

## 4. Phase 2: Data Integration (2h)

### Step 2.1: Calculate Yesterday's Date (~15min)

```typescript
// utils/dateHelpers.ts (new file)
export function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toLocaleDateString('sv-SE'); // YYYY-MM-DD
}
```

### Step 2.2: Add Breakdown Domain Function (~30min)

```typescript
// app/src/01_domains/transaction/rules.ts
export interface DailySummaryBreakdown {
  totalIncome: number;
  totalExpense: number;
  confirmedIncome: number;
  confirmedExpense: number;
  unconfirmedIncome: number;
  unconfirmedExpense: number;
  count: number;
  confirmedCount: number;
  unconfirmedCount: number;
}

export function createDailySummaryWithBreakdown(
  targetDate: string,
  transactions: Transaction[]
): DailySummaryBreakdown {
  const dayTransactions = transactions.filter(t => t.date === targetDate);
  const confirmed = dayTransactions.filter(t => t.confirmedAt);
  const unconfirmed = dayTransactions.filter(t => !t.confirmedAt);

  const { income: confIncome, expense: confExpense } = categorizeByType(confirmed);
  const { income: unconfIncome, expense: unconfExpense } = categorizeByType(unconfirmed);

  return {
    totalIncome: [...confIncome, ...unconfIncome].reduce((sum, t) => sum + t.amount, 0),
    totalExpense: [...confExpense, ...unconfExpense].reduce((sum, t) => sum + t.amount, 0),
    confirmedIncome: confIncome.reduce((sum, t) => sum + t.amount, 0),
    confirmedExpense: confExpense.reduce((sum, t) => sum + t.amount, 0),
    unconfirmedIncome: unconfIncome.reduce((sum, t) => sum + t.amount, 0),
    unconfirmedExpense: unconfExpense.reduce((sum, t) => sum + t.amount, 0),
    count: dayTransactions.length,
    confirmedCount: confirmed.length,
    unconfirmedCount: unconfirmed.length,
  };
}
```

### Step 2.3: Integrate Real Data - Reactive View (~45min)

```typescript
// DashboardView.tsx
import { getYesterdayDate } from '../../../00_kernel/utils/dateHelpers';
import { createDailySummaryWithBreakdown } from '../../../01_domains/transaction';

export function DashboardView({ userId, onViewChange }: DashboardViewProps) {
  const yesterday = getYesterdayDate();
  const { state, transactions } = useTransactionLogic(userId);
  const syncLogic = useSyncLogic(userId, true); // Get last synced time

  // 🎯 LOCAL-FIRST REACTIVE: Uses current local DB state
  // When user confirms/deletes a transaction, `transactions` updates
  // → useMemo recalculates → report updates instantly
  const yesterdaySummary = useMemo(
    () => createDailySummaryWithBreakdown(yesterday, transactions),
    [yesterday, transactions] // Re-calculates when transactions change
  );

  // Format last synced time for display
  const lastSyncedDisplay = syncLogic.getTimeSinceLastSync();

  // Use yesterdaySummary.confirmedIncome, yesterdaySummary.unconfirmedIncome, etc.
}
```

**Key Points**:
- ✅ `transactions` comes from `useTransactionLogic` (subscribes to local SQLite)
- ✅ When user confirms/deletes → SQLite updates → store notifies → transactions array updates
- ✅ `useMemo` recalculates → report UI updates **immediately**
- ✅ No need to wait for cloud sync

### Step 2.4: Add Sync Status Indicator (~20min)

```typescript
// Show when data was last synced with cloud
<div className="dashboard-sync-status">
  <span className="sync-icon">☁️</span>
  <span className="sync-text">
    Last synced: {lastSyncedDisplay || 'Never'}
  </span>
</div>
```

**CSS**:
```css
.dashboard-sync-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  opacity: 0.7;
}
```

### Step 2.5: Add Upload Queue Status (~30min)

```typescript
// Export from capture module
// app/src/02_modules/capture/index.ts
export { useCaptureStats } from './hooks/useCaptureState';

// DashboardView.tsx
import { useCaptureStats } from '../../capture';

const { pendingCount, uploadingCount, compressingCount } = useCaptureStats();
const activeCount = pendingCount + uploadingCount + compressingCount;
const queueStatus = activeCount > 0
  ? `${t('dashboard.queueProcessing')} (${activeCount})`
  : t('dashboard.queueReady');
```

---

## 5. Phase 3: Testing & Polish (1h)

### Test Cases

| ID | 场景 | Phase 1 (Mock) | Phase 2 (Real) |
|----|------|----------------|----------------|
| SC-900 | Load dashboard | ✓ Mock typical | ✓ Real data |
| SC-901 | Empty yesterday | ✓ Mock empty | ✓ Filter yesterday = 0 |
| SC-902 | Income display | ✓ Mock ¥50k | ✓ Calculate from DB |
| SC-903 | Expense display | ✓ Mock ¥30k | ✓ Calculate from DB |
| SC-904 | Net profit | ✓ Mock ¥20k | ✓ income - expense |
| SC-905 | All confirmed | ✓ Mock scenario | ✓ All tx.confirmedAt set |
| SC-906 | All unconfirmed | ✓ Mock scenario | ✓ No tx.confirmedAt |
| SC-907 | Mixed confirmed | ✓ Mock typical | ✓ Some confirmed |
| **SC-908** | **Reactive confirm** | N/A | **Confirm yesterday's tx → report updates** |
| **SC-909** | **Reactive delete** | N/A | **Delete yesterday's tx → report updates** |
| SC-910 | Pending count | ✓ Mock 3 | ✓ Count unconfirmed |
| SC-920 | Queue empty | ✓ Mock 0 | ✓ captureStats = 0 |
| SC-921 | Queue active | ✓ Mock 3 | ✓ captureStats > 0 |
| **SC-922** | **Sync indicator** | N/A | **Show "Last synced: X min ago"** |

### Manual Testing Checklist

**Phase 1**:
- [ ] Switch between mock scenarios (typical/all confirmed/empty)
- [ ] Check visual layout on different screen sizes
- [ ] Verify translations (en/ja)
- [ ] Confirm breakdown is readable
- [ ] Get user approval on design

**Phase 2**:
- [ ] Verify yesterday's date calculation (check at midnight boundary)
- [ ] Confirm confirmed/unconfirmed split matches data
- [ ] Test with empty database (no transactions)
- [ ] Test with only today's data (yesterday should be empty)
- [ ] **Test reactive updates**: Confirm a yesterday transaction → verify report updates instantly
- [ ] **Test reactive deletes**: Delete a yesterday transaction → verify report recalculates
- [ ] Verify sync status indicator shows correct time
- [ ] Verify queue status updates when uploading

---

## 6. 风险 & 依赖

**风险**:
| 风险 | 级别 | 应对 |
|------|------|------|
| UI design approval delay | 低 | Phase 1 takes only 2h, fast iteration |
| Breakdown logic complexity | 低 | Straightforward filtering by confirmedAt |
| Midnight boundary edge case | 中 | Test at 23:59/00:00, use local date correctly |
| User confusion (report changes after confirm) | 低 | Add sync status indicator, expected behavior |

**Architecture Decision**:
| Decision | Rationale |
|----------|-----------|
| **Local-First Reactive** | User Reality = Local DB, not cloud |
| Reports update immediately | Responsive UX, no waiting for sync |
| Show sync status | User knows data freshness |
| Cloud = Storage Backup | Cloud syncs eventually (MVP5), but local is authoritative for UI |

**依赖**:
- [x] `createDailySummary` exists (extend to add breakdown)
- [x] `useCaptureStats` exists (need to export)
- [ ] User approval on Phase 1 design

---

## 7. 进度

| 日期 | 阶段 | 状态 | 备注 |
|------|------|------|------|
| 2026-01-11 | 规划完成 | ✅ | UI-first approach |
| | Phase 1: UI + Mock | ⏳ | 2h - Design approval needed |
| | Phase 2: Integration | ⏸️ | After Phase 1 approval |
| | Phase 3: Testing | ⏸️ | |

---

## 8. Phase Checkpoints

### ✅ Phase 1 Complete When:
- [ ] Mock data scenarios implemented (4 scenarios)
- [ ] Breakdown UI renders correctly
- [ ] Translations added (en/ja)
- [ ] CSS styling complete
- [ ] **User approves the design**

### ✅ Phase 2 Complete When:
- [ ] Yesterday date calculation correct
- [ ] Real data integration working
- [ ] Breakdown matches database state
- [ ] Queue status displays correctly
- [ ] All mock references removed

### ✅ Phase 3 Complete When:
- [ ] All SC-900~921 tests pass
- [ ] Manual testing complete
- [ ] Edge cases handled
- [ ] Ready to close issue

---

*开发前确认*:
- [x] UI-first approach approved
- [x] Phase 1 (mock) designed
- [x] Phase 2 (real data) planned
- [x] 测试用例覆盖完整
