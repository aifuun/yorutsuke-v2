# Issue #115: Transaction List - Type & Category Filters

## Overview

**Issue**: [#115](https://github.com/yourusername/yorutsuke-v2-1/issues/115)
**Complexity**: T1 (read-only, direct pattern)
**Estimated**: 5 hours
**Status**: Planning

## Context

The TransactionView already has comprehensive filtering (date, status, sorting, pagination). This task adds the missing filters:
1. **Type filter**: income / expense
2. **Category filter**: purchase / sale / shipping / packaging / fee / other

## Current State Analysis

### Existing Implementation (TransactionView.tsx:line 54-503)

**Already Working**:
- ✅ Date range filters (quick filters + custom date picker)
- ✅ Status filter (all / pending / confirmed)
- ✅ Sorting (by date or createdAt, ASC/DESC)
- ✅ Pagination (20 items per page)
- ✅ Summary cards (income/expense totals)
- ✅ Empty state handling

**Missing**:
- ❌ Type filter (income/expense)
- ❌ Category filter (purchase/sale/shipping/packaging/fee/other)

### Existing Filter Architecture

```typescript
// TransactionView.tsx:76-98
const buildFetchOptions = useCallback((): FetchTransactionsOptions => {
  const options: FetchTransactionsOptions = {
    sortBy,
    sortOrder,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  };

  // Date filters
  if (activeFilter !== 'all') {
    options.startDate = startDate.toLocaleDateString('sv-SE');
    options.endDate = endDate.toLocaleDateString('sv-SE');
  }

  // Status filter
  if (statusFilter !== 'all') {
    options.statusFilter = statusFilter;
  }

  return options;
}, [activeFilter, startDate, endDate, sortBy, sortOrder, currentPage, pageSize, statusFilter]);
```

### Database Schema (SCHEMA.md:148-149)

```sql
type TEXT NOT NULL,               -- 'income'|'expense'
category TEXT NOT NULL,           -- 'purchase'|'sale'|'shipping'|'packaging'|'fee'|'other'
```

### i18n Support

**Already exists**:
- `transaction.categories.purchase` / `sale` / `shipping` / `packaging` / `fee` / `other`
- `transaction.income` / `expense` (need to verify)

## Implementation Plan

### Phase 1: Backend Support (1.5h)

#### Step 1.1: Update FetchTransactionsOptions Interface
**File**: `app/src/02_modules/transaction/adapters/transactionDb.ts:48-57`

Add to interface:
```typescript
export interface FetchTransactionsOptions {
  startDate?: string;
  endDate?: string;
  sortBy?: 'date' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  statusFilter?: 'pending' | 'confirmed';
  typeFilter?: 'income' | 'expense';        // ← NEW
  categoryFilter?: TransactionCategory;     // ← NEW
}
```

#### Step 1.2: Update fetchTransactions Function
**File**: `app/src/02_modules/transaction/adapters/transactionDb.ts:59-102`

Add filter logic after line 84 (after status filter):
```typescript
// Type filter
if (options.typeFilter) {
  query += ' AND type = ?';
  params.push(options.typeFilter);
}

// Category filter
if (options.categoryFilter) {
  query += ' AND category = ?';
  params.push(options.categoryFilter);
}
```

#### Step 1.3: Update countTransactions Function
**File**: `app/src/02_modules/transaction/adapters/transactionDb.ts:108-137`

Add same filters to count query (after line 133):
```typescript
// Type filter
if (options.typeFilter) {
  query += ' AND type = ?';
  params.push(options.typeFilter);
}

// Category filter
if (options.categoryFilter) {
  query += ' AND category = ?';
  params.push(options.categoryFilter);
}
```

#### Step 1.4: Update countTransactions Options Type
**File**: `app/src/02_modules/transaction/adapters/transactionDb.ts:110`

```typescript
options: {
  startDate?: string;
  endDate?: string;
  statusFilter?: 'pending' | 'confirmed';
  typeFilter?: 'income' | 'expense';      // ← NEW
  categoryFilter?: TransactionCategory;   // ← NEW
} = {}
```

### Phase 2: Frontend UI (2.5h)

#### Step 2.1: Add Filter State Variables
**File**: `app/src/02_modules/transaction/views/TransactionView.tsx`

After line 70 (after statusFilter state):
```typescript
// Type filter state
const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

// Category filter state
const [categoryFilter, setCategoryFilter] = useState<'all' | TransactionCategory>('all');
```

#### Step 2.2: Update buildFetchOptions
**File**: `TransactionView.tsx:76-98`

Add filters (after line 94):
```typescript
// Type filter
if (typeFilter !== 'all') {
  options.typeFilter = typeFilter;
}

// Category filter
if (categoryFilter !== 'all') {
  options.categoryFilter = categoryFilter;
}
```

#### Step 2.3: Add Filter Change Handlers
After line 171 (after toggleSortOrder):
```typescript
// Handle type filter change
const handleTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  setTypeFilter(e.target.value as 'all' | 'income' | 'expense');
  setCurrentPage(1);
};

// Handle category filter change
const handleCategoryFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  setCategoryFilter(e.target.value as 'all' | TransactionCategory);
  setCurrentPage(1);
};
```

#### Step 2.4: Update Filter UI
**File**: `TransactionView.tsx:434-468`

Add new filter controls after the existing status filter (after line 467):
```tsx
<div className="control-group">
  <label className="control-label">{t('ledger.type')}:</label>
  <select
    className="select select--filter"
    value={typeFilter}
    onChange={handleTypeFilterChange}
  >
    <option value="all">{t('ledger.all')}</option>
    <option value="income">{t('transaction.income')}</option>
    <option value="expense">{t('transaction.expense')}</option>
  </select>
</div>

<div className="control-group">
  <label className="control-label">{t('ledger.category')}:</label>
  <select
    className="select select--filter"
    value={categoryFilter}
    onChange={handleCategoryFilterChange}
  >
    <option value="all">{t('ledger.all')}</option>
    <option value="purchase">{t('transaction.categories.purchase')}</option>
    <option value="sale">{t('transaction.categories.sale')}</option>
    <option value="shipping">{t('transaction.categories.shipping')}</option>
    <option value="packaging">{t('transaction.categories.packaging')}</option>
    <option value="fee">{t('transaction.categories.fee')}</option>
    <option value="other">{t('transaction.categories.other')}</option>
  </select>
</div>
```

#### Step 2.5: Update Dependencies
Update useEffect dependencies (line 121):
```typescript
}, [userId, buildFetchOptions, load]);
```

Add typeFilter and categoryFilter to buildFetchOptions dependencies (line 98):
```typescript
}, [activeFilter, startDate, endDate, sortBy, sortOrder, currentPage, pageSize, statusFilter, typeFilter, categoryFilter]);
```

### Phase 3: i18n Updates (0.5h)

#### Step 3.1: Verify/Add Missing Translations

**Files to check/update**:
- `app/src/i18n/locales/en.json`
- `app/src/i18n/locales/ja.json`
- `app/src/i18n/locales/zh.json`

**Required keys** (check if missing, add if needed):
```json
{
  "ledger": {
    "type": "Type",
    "category": "Category"
  },
  "transaction": {
    "income": "Income",
    "expense": "Expense"
  }
}
```

### Phase 4: Testing & Verification (1h)

#### Step 4.1: Manual Testing Checklist

- [ ] **SC-800**: Load transactions → Display in date desc order
- [ ] **SC-801**: Empty state → Show "No records"
- [ ] **SC-805**: Filter by type (income) → Only income shown
- [ ] **SC-805**: Filter by type (expense) → Only expense shown
- [ ] **SC-806**: Filter by category (purchase) → Only purchase shown
- [ ] **SC-806**: Filter by category (sale) → Only sale shown
- [ ] **SC-807**: Combined filters:
  - Type = income + Category = sale → Only income sales
  - Type = expense + Category = shipping → Only expense shipping
  - Type + Category + Date range → All filters apply
  - Type + Category + Status = pending → All filters apply
- [ ] **SC-820**: Income total → Correct sum (respects filters)
- [ ] **SC-821**: Expense total → Correct sum (respects filters)

#### Step 4.2: Edge Cases

- [ ] Filter with no results → Empty state shown
- [ ] Reset filters (select "all") → Full list restored
- [ ] Pagination works with filters → Correct total count
- [ ] Sorting works with filters → Order maintained
- [ ] Filter state persists during pagination → Filters not cleared
- [ ] Multiple filter changes → UI responsive, no lag

#### Step 4.3: Build Verification

```bash
cd app && npm run build
```

- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Build completes successfully

## Files Modified Summary

| File | Lines | Changes |
|------|-------|---------|
| `transactionDb.ts` | ~50 | Add typeFilter/categoryFilter to interface, queries |
| `TransactionView.tsx` | ~40 | Add filter state, handlers, UI controls |
| i18n files (3) | ~10 | Add missing translation keys |

**Total estimated lines**: ~100 lines

## Acceptance Criteria Checklist

From Issue #115:

- [x] Display transactions in descending date order (already working)
- [x] Show empty state when no transactions (already working)
- [ ] Filter by transaction type (income/expense) ← **THIS TASK**
- [ ] Filter by category (sale/purchase/shipping/etc) ← **THIS TASK**
- [x] Filter by date range (already working)
- [ ] Combined filters work correctly ← **TEST THIS**
- [x] Display income total (already working, but needs filter support)
- [x] Display expense total (already working, but needs filter support)
- [ ] All SC-800~807, SC-820~821 pass

## Design System Compliance

**Tokens used**:
- `--space-2` for filter control gaps
- `--text-sm` for filter labels
- `select` class from FORMS.md
- `control-group` / `control-label` existing patterns

**No new components** - reuse existing select/control patterns.

## Risk Assessment

**Low Risk** - This is a T1 task with:
- No new state management complexity
- No API/cloud changes
- Simple SQL WHERE clause additions
- Existing UI patterns

**Potential Issues**:
- Filter combinations might be slow on large datasets (mitigated by pagination)
- Summary totals need to respect ALL active filters

## Related Issues

- **Depends on**: None (read-only)
- **Blocks**: #116 (Transaction Confirmation needs filtered list)
- **Related**: MVP3_BATCH.md line 280

---

**Created**: 2026-01-11
**Last Updated**: 2026-01-11
**Status**: Ready for implementation
