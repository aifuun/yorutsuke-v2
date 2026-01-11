---
issue: 116
status: in-progress
tier: T2
estimated: 6h
---

# Issue #116: Transaction Confirmation: Confirm/Edit/Delete

## Overview

Implement transaction confirmation, editing, and deletion with local SQLite persistence. All operations are local-only (cloud sync deferred to MVP3.5).

**Branch**: `feature/116-transaction-confirmation`

## Acceptance Criteria

- [ ] Confirm transaction (set confirmedAt timestamp)
- [ ] Edit transaction fields (amount, category, description)
- [ ] Delete transaction with confirmation dialog
- [ ] Remove "Unconfirmed" badge after confirmation
- [ ] Local SQLite updates immediately
- [ ] All SC-810~811 pass

## Implementation Steps

### Phase 1: Backend - Service Layer (2h) ✅ COMPLETE
- [x] Read existing service files (transactionService.ts, transactionDb.ts)
- [x] `confirmTransaction(id)` - Already exists in service
- [x] Implement `updateTransaction(id, updates)` in adapter + service
- [x] `deleteTransaction(id)` - Already exists in service
- [x] Follow IO-First Pattern (DB write → store update → emit event)
- [x] Add error handling for all operations
- [x] Add `update` action to headless hook (useTransactionLogic.ts)

### Phase 2: Frontend - Modal Actions (3h) ✅ COMPLETE
- [x] Read ImageLightbox.tsx to understand current structure
- [x] Confirm button - **Already wired** via useTransactionLogic.confirm()
- [x] Delete button - **Already wired** via useTransactionLogic.remove()
- [x] Delete confirmation dialog - **Already implemented** (Tauri native dialog)
- [x] "Unconfirmed" badge - **Already removed on confirm** (TransactionCard line 539-541)
- [x] UI state updates - **Already reactive** (FSM reducer updates state)
- [x] **Edit functionality** - Added inline edit for amount/merchant/description/category/date when unconfirmed
  - Editable fields become inputs when transaction is unconfirmed
  - On Confirm, edits are saved AND transaction is confirmed (streamlined UX)

### Phase 3: Testing & Verification (1h)
- [ ] Test SC-810: Confirm transaction → confirmedAt set, badge removed
- [ ] Test SC-811: Delete transaction → confirmation dialog, then delete
- [ ] Test edit flow: Update amount/category/description
- [ ] Test error cases: DB write failure, invalid input
- [ ] Verify IO-First pattern (no race conditions)
- [ ] Build verification

## Technical Notes

### Service Pattern (IO-First)
```typescript
// ✅ CORRECT ORDER
async function confirmTransaction(id: TransactionId) {
  // 1. Write to SQLite first (IO)
  await transactionDb.confirmTransaction(id);

  // 2. Then update store (triggers UI)
  transactionStore.updateTransaction(id, { confirmedAt: new Date().toISOString() });

  // 3. Emit event for other modules
  emit('transaction:confirmed', { id });
}
```

### Files to Modify
- `app/src/02_modules/transaction/services/transactionService.ts` (add confirm/update/delete)
- `app/src/02_modules/transaction/adapters/transactionDb.ts` (DB operations)
- `app/src/02_modules/transaction/components/ImageLightbox.tsx` (wire buttons)
- `app/src/02_modules/transaction/views/TransactionView.tsx` (state updates)

### Key Design Decisions
- **Local-only**: No cloud sync in this issue (deferred to MVP3.5, Issue #108)
- **IO-First Pattern**: Critical for avoiding race conditions (see `.claude/rules/service-layer.md`)
- **Confirmation dialog**: Use existing ConfirmDialog component from components/
- **Edit UI**: Can be inline edit in modal or separate edit modal (TBD based on UX)

## Dependencies

- **Blocked by**: #115 (Transaction filters - completed ✅)
- **Enables**: #117 (Offline testing needs confirmation)

## Related

- MVP3_BATCH.md line 280
- `.claude/rules/service-layer.md` (IO-First Pattern)
- `docs/architecture/ADR/ADR-001.md` (Service Pattern)
