# Issue #89: Migrate Transaction Module to Service Pattern - Development Plan

**Status**: 📋 Plan Mode
**Branch**: `feature/89-migrate-transaction-service`
**Complexity**: T2 (Logic, state management)
**Affected Files**: 5+ files (Service, Store, Hooks, View)

---

## 📋 Overview

Migrate the `transaction` module from **Headless Hook pattern** (`useTransactionLogic.ts`) to **Service Pattern** (Service + Store + React hooks). This achieves:

- ✅ Framework-independent business logic (Pure TypeScript)
- ✅ Persistent global state (Zustand vanilla store)
- ✅ Testable without React environment
- ✅ Consistency with other modules (capture, sync, auth, settings)
- ✅ Compliance with ADR-001 (Service Pattern)
- ✅ Compliance with four-layer architecture (LAYERS.md)

---

## 🏗️ Architecture Context

### Relevant ADRs

| ADR | Title | Applies | Rationale |
|-----|-------|---------|-----------|
| **ADR-001** | Service Layer Pattern | ✅ MUST | Adopt pure TS services with Zustand vanilla stores |
| **ADR-012** | Zustand Selector Safety | ✅ MUST | Use primitive selectors to avoid infinite loops |
| **ADR-003** | React-Service Boundaries | ✅ MUST | View subscribes, never mutates directly |

**Key Decision**: Services manage global business state; React only subscribes via `useStore()`.

### Applicable Pillars

| Pillar | Name | Applies | What to Check |
|--------|------|---------|---------------|
| **L** | Headless | ✅ MUST | Logic in Service, not Hook |
| **D** | FSM | ✅ MUST | Use union type for status, not booleans |
| **E** | Orchestration | ✅ MUST | Service orchestrates adapter calls |
| **I** | Firewalls | ✅ MUST | No deep imports across modules |
| **J** | Locality | ✅ MUST | State lives in Service, near usage |

### Pattern Reference

**Current (Incorrect)**:
```
View
  └─ useTransactionLogic (Hook manages state)
      ├─ useState, useReducer (local state) ❌
      └─ Returns { state, actions } ❌
```

**Target (Correct)**:
```
View (TransactionView)
  ├─ useStore(transactionService.store) (Subscribe) ✅
  ├─ useTransactionState() hooks (Selectors) ✅
  └─ transactionService.method() (Call) ✅
      ↓
Service (transactionService.ts)
  ├─ init() (Initialize) ✅
  ├─ store (Zustand vanilla) ✅
  └─ Methods (loadTransactions, confirm, etc.) ✅
      ↓
Adapter (transactionApi.ts, transactionDb.ts)
  └─ I/O operations ✅
```

---

## 🔑 Key Functions/Classes

### 1. transactionStore.ts (NEW)

**Purpose**: Define FSM state and actions for transaction management.

```typescript
// State (Union type, not interface)
type TransactionStatus = 'idle' | 'loading' | 'saving' | 'error';

interface TransactionState {
  status: TransactionStatus;
  transactions: Transaction[];
  error: string | null;
  totalCount: number;
  filters: TransactionFilters;
}

interface TransactionActions {
  // Query operations
  setStatus: (status: TransactionStatus) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setTotalCount: (count: number) => void;
  setFilters: (filters: TransactionFilters) => void;
  setError: (error: string | null) => void;

  // Mutations
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: TransactionId, fields: UpdateTransactionFields) => void;
  removeTransaction: (id: TransactionId) => void;
  confirmTransaction: (id: TransactionId) => void;

  // Getters (for service layer)
  getTransactions: () => Transaction[];
  getStatus: () => TransactionStatus;
  getTotalCount: () => number;
}

// Create vanilla store
export const transactionStore = createStore<TransactionStore>((set, get) => ({
  // Initial state
  status: 'idle',
  transactions: [],
  error: null,
  totalCount: 0,
  filters: {},

  // Actions...
}));
```

**Tests**: 8 test cases
- [ ] setStatus updates correctly
- [ ] setTransactions replaces array
- [ ] addTransaction appends
- [ ] updateTransaction modifies in place
- [ ] removeTransaction filters out
- [ ] confirmTransaction updates status
- [ ] getters return correct values
- [ ] Error state persists across mutations

### 2. transactionService.ts (REFACTOR)

**Purpose**: Pure TS orchestration class managing store + adapters.

```typescript
class TransactionService {
  private initialized = false;
  private userId: UserId | null = null;
  private cleanupSyncListener: (() => void) | null = null;

  store = transactionStore;

  async init(): Promise<void> {
    // Register global sync listener (once at app startup)
    this.cleanupSyncListener = on('transaction:confirmed', () => {
      this.loadTransactions();
    });
  }

  async setUser(userId: UserId | null): Promise<void> {
    this.userId = userId;
    if (userId) {
      await this.loadTransactions();
    }
  }

  async loadTransactions(options?: FetchTransactionsOptions): Promise<void> {
    // IO-First Pattern:
    // 1. Call adapter (get data)
    // 2. Update store (notify UI)
    // 3. Emit event (trigger sync)
  }

  async confirmTransaction(id: TransactionId): Promise<void> {
    // 1. Call adapter
    // 2. Update store
    // 3. Emit event
  }

  async removeTransaction(id: TransactionId): Promise<void> { ... }

  async updateTransaction(id: TransactionId, fields: UpdateTransactionFields): Promise<void> { ... }

  destroy(): void {
    // Cleanup listeners
  }
}

export const transactionService = new TransactionService();
```

**Tests**: 12 test cases
- [ ] init() registers listener once
- [ ] setUser() loads transactions
- [ ] loadTransactions() updates store with data
- [ ] loadTransactions() handles errors
- [ ] confirmTransaction() calls adapter + updates store
- [ ] removeTransaction() removes from store
- [ ] updateTransaction() modifies in store
- [ ] listener triggers on transaction:confirmed event
- [ ] destroy() cleanup happens
- [ ] Multiple users don't cross-contaminate
- [ ] Error state persists
- [ ] Concurrent operations handled (no race)

### 3. hooks/useTransactionState.ts (NEW)

**Purpose**: React bridge hooks for subscribing to store.

```typescript
// Simple subscription hooks
export function useTransactionStatus() {
  return useStore(transactionService.store, s => s.status);
}

export function useTransactions() {
  return useStore(transactionService.store, s => s.transactions);
}

export function useTransactionCount() {
  return useStore(transactionService.store, s => s.totalCount);
}

export function useTransactionError() {
  return useStore(transactionService.store, s => s.error);
}

export function useTransactionFilters() {
  return useStore(transactionService.store, s => s.filters);
}

// Computed hook (filtered + sorted transactions)
export function useFilteredTransactions() {
  const transactions = useStore(transactionService.store, s => s.transactions);
  const filters = useStore(transactionService.store, s => s.filters);

  return useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters]
  );
}
```

**Tests**: 6 test cases
- [ ] useTransactionStatus returns correct status
- [ ] useTransactions returns array
- [ ] useTransactionCount returns number
- [ ] useTransactionError returns string or null
- [ ] useTransactionFilters returns filter object
- [ ] useFilteredTransactions applies filters correctly
- [ ] Selectors don't cause infinite loops (primitive returns)

### 4. TransactionView.tsx (UPDATE)

**Purpose**: Update to use new Service pattern hooks.

**Changes**:
1. Replace `useTransactionLogic()` with individual hooks
2. Call `transactionService.method()` directly
3. Subscribe to individual state values (primitive selectors)

```typescript
export function TransactionView({ userId, onNavigate }: TransactionViewProps) {
  // Subscribe using individual primitive selectors
  const status = useTransactionStatus();
  const transactions = useTransactions();
  const filteredTransactions = useFilteredTransactions();
  const totalCount = useTransactionCount();
  const error = useTransactionError();

  // UI local state only
  const [sortBy, setSortBy] = useState<'date' | 'createdAt'>('createdAt');
  const [currentPage, setCurrentPage] = useState(1);

  // Call service methods directly
  const handleConfirm = (id: TransactionId) => {
    transactionService.confirmTransaction(id);
  };

  const handleRemove = async (id: TransactionId) => {
    await transactionService.removeTransaction(id);
  };

  // Existing rendering logic stays the same
}
```

**Tests**: 8 test cases
- [ ] Component renders with idle status
- [ ] Component shows loading spinner when status='loading'
- [ ] Component renders transaction list when status='success'
- [ ] Component shows error message when status='error'
- [ ] Clicking confirm calls service method
- [ ] Clicking delete calls service method
- [ ] Filter/sort state managed locally
- [ ] No errors with null userId

---

## 🛠️ Implementation Steps

### Step 1: Create transactionStore.ts
- **Files**: `app/src/02_modules/transaction/stores/transactionStore.ts` (NEW)
- **Description**: Define Zustand vanilla store with FSM state and actions
- **Subtasks**:
  - [ ] Define TransactionState interface (status, transactions, error, totalCount, filters)
  - [ ] Define TransactionActions interface (setters, mutations, getters)
  - [ ] Create vanilla store with `createStore` from `zustand/vanilla`
  - [ ] Implement all action methods
  - [ ] Add JSDoc comments explaining each action
  - [ ] Write unit tests (8 test cases)
  - [ ] Verify no infinite loops (all returns are primitives)
- **Pillar concerns**: D (FSM), J (Locality)
- **Estimated LOC**: 150-200

### Step 2: Refactor transactionService.ts
- **Files**: `app/src/02_modules/transaction/services/transactionService.ts` (REFACTOR)
- **Description**: Convert from thin adapter to full orchestration service
- **Subtasks**:
  - [ ] Add class structure (init, setUser, destroy)
  - [ ] Import transactionStore
  - [ ] Implement IO-First pattern: adapter call → store update → event emit
  - [ ] Add listener cleanup in destroy()
  - [ ] Implement loadTransactions() with pagination support
  - [ ] Implement confirmTransaction() with event emission
  - [ ] Implement removeTransaction() with event emission
  - [ ] Implement updateTransaction() with event emission
  - [ ] Add error handling (setState with error)
  - [ ] Write unit tests (12 test cases)
  - [ ] Verify no race conditions (concurrent operations)
- **Pillar concerns**: E (Orchestration), L (Headless)
- **Estimated LOC**: 200-250
- **Dependencies**: Step 1 must complete first

### Step 3: Create hooks/useTransactionState.ts
- **Files**: `app/src/02_modules/transaction/hooks/useTransactionState.ts` (NEW)
- **Description**: React bridge hooks for subscribing to store
- **Subtasks**:
  - [ ] Create primitive selector hooks (status, transactions, count, error, filters)
  - [ ] Create computed hook for filtered transactions (with useMemo)
  - [ ] Use primitive selectors ONLY (prevent infinite loops)
  - [ ] Add JSDoc explaining when to use each hook
  - [ ] Write unit tests (6 test cases)
  - [ ] Verify no object/array selectors without useShallow
- **Pillar concerns**: L (Headless), ADR-012 (Selector Safety)
- **Estimated LOC**: 80-120
- **Dependencies**: Step 1 must complete first

### Step 4: Update TransactionView.tsx
- **Files**: `app/src/02_modules/transaction/views/TransactionView.tsx` (UPDATE)
- **Description**: Replace useTransactionLogic with new hooks
- **Subtasks**:
  - [ ] Remove `useTransactionLogic` import
  - [ ] Add imports for new selector hooks
  - [ ] Replace `const { state, ... } = useTransactionLogic()` with individual hooks
  - [ ] Update all state accesses to use new hooks
  - [ ] Replace `actions.confirm()` calls with `transactionService.confirmTransaction()`
  - [ ] Replace `actions.remove()` calls with `transactionService.removeTransaction()`
  - [ ] Replace `actions.update()` calls with `transactionService.updateTransaction()`
  - [ ] Verify existing filtering/sorting logic still works
  - [ ] Test all click handlers
  - [ ] Write integration tests (8 test cases)
- **Pillar concerns**: L (Headless), I (Firewalls)
- **Estimated LOC**: 10-20 changes (mostly deletions)
- **Dependencies**: Step 1-3 must complete first

### Step 5: Delete headless/useTransactionLogic.ts
- **Files**: `app/src/02_modules/transaction/headless/useTransactionLogic.ts` (DELETE)
- **Description**: Remove old headless hook pattern
- **Subtasks**:
  - [ ] Verify no other files import useTransactionLogic
  - [ ] Check git grep for any remaining references
  - [ ] Delete file
  - [ ] Remove headless/index.ts if now empty
  - [ ] Update transaction/index.ts exports if needed
  - [ ] Run build to verify no import errors
- **Pillar concerns**: Cleanup
- **Estimated LOC**: -300 (deletion)
- **Dependencies**: Step 4 must complete first

### Step 6: Initialize Service in App.tsx
- **Files**: `app/src/App.tsx` (UPDATE)
- **Description**: Call transactionService.init() at app startup
- **Subtasks**:
  - [ ] Import transactionService
  - [ ] Add useEffect to call transactionService.init()
  - [ ] Add cleanup to call transactionService.destroy()
  - [ ] Verify initialization happens once per app lifetime
- **Pillar concerns**: ADR-001 (Service initialization)
- **Estimated LOC**: 10
- **Dependencies**: Step 2 must complete first

### Step 7: Run Full Test Suite
- **Files**: `app/` and `infra/` test directories
- **Description**: Verify all tests pass
- **Subtasks**:
  - [ ] Run: `npm test -- --testPathPattern=transaction`
  - [ ] Verify 0 errors in new tests
  - [ ] Run: `npm test` (all tests)
  - [ ] Verify existing tests still pass
  - [ ] Check coverage (target: >90% for service)
- **Pillar concerns**: Quality assurance
- **Estimated LOC**: N/A
- **Dependencies**: All previous steps

---

## 🧪 Test Cases

### Unit Tests: transactionStore.ts (8 cases)

| Test ID | Title | Given | When | Then |
|---------|-------|-------|------|------|
| **T1.1** | setStatus updates correctly | `status='idle'` | `setStatus('loading')` | `status='loading'` ✓ |
| **T1.2** | setTransactions replaces array | `transactions=[]` | `setTransactions([tx1, tx2])` | `transactions=[tx1, tx2]` ✓ |
| **T1.3** | addTransaction appends | `transactions=[tx1]` | `addTransaction(tx2)` | `transactions=[tx1, tx2]` ✓ |
| **T1.4** | updateTransaction modifies in place | `transactions=[{id: 'a', status: 'pending'}]` | `updateTransaction('a', {status: 'confirmed'})` | `status='confirmed'` ✓ |
| **T1.5** | removeTransaction filters out | `transactions=[tx1, tx2]` | `removeTransaction(tx1.id)` | `transactions=[tx2]` ✓ |
| **T1.6** | confirmTransaction updates status | `transactions=[{id: 'a', status: 'pending'}]` | `confirmTransaction('a')` | `status='confirmed', updatedAt=now` ✓ |
| **T1.7** | getters return correct values | `status='loading'` | `getStatus()` | returns `'loading'` ✓ |
| **T1.8** | setError persists across mutations | `error=null` | `setError('failed'), setStatus('error')` | `error='failed', status='error'` ✓ |

**Coverage**: 100% (all actions tested)

### Unit Tests: transactionService.ts (12 cases)

| Test ID | Title | Given | When | Then |
|---------|-------|-------|------|------|
| **T2.1** | init() registers listener once | Service not initialized | `service.init()` twice | Listener registered exactly once ✓ |
| **T2.2** | setUser() loads transactions | `userId='user-123'` | `setUser(userId)` | `store.status='loading'` then `'success'` ✓ |
| **T2.3** | loadTransactions() updates store | Mock adapter returns [tx1, tx2] | `loadTransactions()` | `store.transactions=[tx1, tx2]` ✓ |
| **T2.4** | loadTransactions() handles errors | Mock adapter throws | `loadTransactions()` | `store.status='error', error=message` ✓ |
| **T2.5** | confirmTransaction() calls adapter + updates store | `transactions=[{id: 'a'}]` | `confirmTransaction('a')` | Adapter called, `store.transactions[0].status='confirmed'` ✓ |
| **T2.6** | removeTransaction() removes from store | `transactions=[tx1, tx2]` | `removeTransaction(tx1.id)` | `store.transactions=[tx2]` ✓ |
| **T2.7** | updateTransaction() modifies in store | `transactions=[{id: 'a', amount: 100}]` | `updateTransaction('a', {amount: 200})` | `store.transactions[0].amount=200` ✓ |
| **T2.8** | Listener triggers on event | Event emitted: `transaction:confirmed` | Listener receives event | `loadTransactions()` called ✓ |
| **T2.9** | destroy() cleanup happens | Listeners registered | `destroy()` | All listeners unsubscribed ✓ |
| **T2.10** | Multiple users don't cross-contaminate | User A loads tx1, User B loads tx2 | Switch users | Store reflects User B's transactions ✓ |
| **T2.11** | Error state persists correctly | Error occurred | Another operation succeeds | Error cleared ✓ |
| **T2.12** | Concurrent operations handled (no race) | Two `loadTransactions()` called simultaneously | Both complete | Single consistent state ✓ |

**Coverage**: 100% (all service methods tested)

### Unit Tests: useTransactionState.ts (6 cases)

| Test ID | Title | Given | When | Then |
|---------|-------|-------|------|------|
| **T3.1** | useTransactionStatus returns correct status | `store.status='loading'` | Call hook | Returns `'loading'` ✓ |
| **T3.2** | useTransactions returns array | `store.transactions=[tx1, tx2]` | Call hook | Returns `[tx1, tx2]` ✓ |
| **T3.3** | useTransactionCount returns number | `store.totalCount=42` | Call hook | Returns `42` ✓ |
| **T3.4** | useTransactionError returns string or null | `store.error='failed'` | Call hook | Returns `'failed'` ✓ |
| **T3.5** | useTransactionFilters returns object | `store.filters={startDate: '2026-01-01'}` | Call hook | Returns filter object ✓ |
| **T3.6** | useFilteredTransactions applies filters correctly | `transactions=[income, expense]`, `filters={type: 'income'}` | Call hook | Returns only `[income]` ✓ |

**Coverage**: 100% (all hooks tested), No infinite loops (primitive selectors only)

### Integration Tests: TransactionView.tsx (8 cases)

| Test ID | Title | Given | When | Then |
|---------|-------|-------|------|------|
| **T4.1** | Renders idle state | Service initialized with idle | Component mounts | Shows "No transactions" ✓ |
| **T4.2** | Shows loading spinner | `service.store.status='loading'` | Component renders | Spinner visible ✓ |
| **T4.3** | Renders transaction list | `service.store.transactions=[tx1, tx2]` | Component renders | Both items visible ✓ |
| **T4.4** | Shows error message | `service.store.error='Failed to load'` | Component renders | Error text visible ✓ |
| **T4.5** | Confirm button calls service | Confirm button clicked on tx1 | User clicks | `transactionService.confirmTransaction(tx1.id)` called ✓ |
| **T4.6** | Delete button calls service | Delete button clicked on tx1 | User clicks | `transactionService.removeTransaction(tx1.id)` called ✓ |
| **T4.7** | Filter/sort state managed locally | Filter changed to 'confirmed' | User selects filter | View updates, service unaffected ✓ |
| **T4.8** | Handles null userId gracefully | `userId=null` | Component mounts | No errors, shows empty state ✓ |

**Coverage**: 100% (all user interactions tested)

### Coverage Matrix

| Acceptance Criterion | Test Cases | Status |
|----------------------|-----------|--------|
| Store manages state (FSM) | T1.1-T1.8 | ✅ |
| Service orchestrates adapters | T2.1-T2.12 | ✅ |
| Hooks provide React bridge | T3.1-T3.6 | ✅ |
| View uses new patterns | T4.1-T4.8 | ✅ |
| No headless hook dependency | All tests | ✅ |
| Four-layer architecture | All tests | ✅ |
| ADR-001 compliance | T2.1-T2.9, T4.5-T4.6 | ✅ |

**Total**: 34 test cases covering all acceptance criteria (100% coverage)

---

## 🚨 Technical Decisions

| Decision | Chosen | Alternative | Rationale |
|----------|--------|-------------|-----------|
| **Store Framework** | Zustand vanilla | Redux, Context | Lightweight, zero React deps in service layer |
| **Service Initialization** | `init()` + `App.tsx` useEffect | Auto-init on import | Explicit control, clear lifecycle |
| **Selector Pattern** | Primitive selectors | Object selectors + useShallow | Avoid Zustand infinite loop pitfall (ADR-012) |
| **Error State** | `error: string \| null` | Boolean `isError` flag | FSM pattern (Pillar D), clearer semantics |
| **Status Type** | Union type | Enum | Better tree-shaking, clearer contracts |

---

## ⚠️ Risk Assessment

| Risk | Level | Mitigation |
|------|-------|-----------|
| **Infinite loops in selectors** | 🔴 HIGH | Use only primitive selectors, test thoroughly (T3.1-T3.6) |
| **Race conditions** | 🟡 MEDIUM | Add Mutex pattern if needed, test concurrent ops (T2.12) |
| **State migration loss** | 🟡 MEDIUM | Comprehensive tests before deleting old hook (T1-T4) |
| **Breaking TransactionView** | 🟡 MEDIUM | Keep existing rendering logic, only change state access |
| **Service init forgetting** | 🟡 MEDIUM | Update checklist to verify `transactionService.init()` added |

---

## 📝 Deployment Notes

### Breaking Changes
- ✅ **NONE**: Old hook exists during transition, no breaking changes for users

### Migration Path
1. Step 1-3: Add new service/store/hooks (backwards compatible)
2. Step 4: Update TransactionView to use new hooks (both old & new work)
3. Step 5: Delete old hook (clean up)
4. Step 6: Initialize service in App (production ready)
5. Step 7: Test & verify (confidence)

### Testing Before Merge
```bash
# Run transaction tests
npm test -- --testPathPattern=transaction

# Run all tests
npm test

# Build check
npm run build
```

### Backwards Compatibility
- Existing code continues to work until old hook is deleted
- No database migrations needed
- No API changes needed

---

## ✅ Success Criteria

**Implementation is complete when:**

- [ ] transactionStore.ts created with all actions
- [ ] transactionService.ts refactored with init() + methods
- [ ] useTransactionState.ts hooks created
- [ ] TransactionView.tsx updated to use new hooks
- [ ] headless/useTransactionLogic.ts deleted
- [ ] App.tsx initializes transactionService
- [ ] All 34 tests passing (8 + 12 + 6 + 8)
- [ ] No TypeScript errors (`npm run build` succeeds)
- [ ] No infinite loops detected (primitive selectors only)
- [ ] PR reviewed and approved

---

## 📌 Dependencies

- ✅ Can start immediately (no external dependencies)
- ✅ Each step depends only on previous steps
- ✅ No conflicts with other issues

---

## 🔗 References

- **ADR-001**: Service Layer Pattern
- **ADR-003**: React-Service Boundaries
- **ADR-012**: Zustand Selector Safety
- **docs/architecture/LAYERS.md**: Four-layer architecture
- **docs/architecture/SERVICE_PATTERN_MIGRATION.md**: Migration guide
- **.prot/pillar-*/**: AI_DEV_PROT v15 pillars

---

## 📊 Effort Estimate

| Step | Files | LOC | Time |
|------|-------|-----|------|
| 1. Store | 1 | +150 | 30 min |
| 2. Service | 1 | +250 | 45 min |
| 3. Hooks | 1 | +100 | 20 min |
| 4. View | 1 | ±10 | 20 min |
| 5. Cleanup | 1 | -300 | 5 min |
| 6. Init | 1 | +10 | 5 min |
| 7. Tests | - | +500 | 60 min |
| **Total** | **7 files** | **~700** | **~3 hours** |

---

**Next Step**: Review this plan, approve, then run `*approve` to begin implementation.
