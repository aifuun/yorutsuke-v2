# Dynamic Model Configuration - Implementation Plan

**Issue**: #151 - Dynamic Model Configuration: Frontend Display & Adapter Alignment
**GitHub**: https://github.com/aifuun/yorutsuke-v2/issues/151
**Created**: 2026-01-18
**Status**: Ready for implementation (with comprehensive test design)

---

## Executive Summary

### Current State Analysis

**✅ What Already Works:**
- Lambda processors write `primaryModelId` + `primaryConfidence` to DynamoDB
- Admin panel has `/config` API endpoint and model selection UI (`Models.tsx`, `ModelSelection.tsx`)
- DynamoDB schema fully supports model metadata
- Configuration system stores model selection in Control Table

**❌ What Needs Fixing:**
- SQLite migration v9 documented model columns but never created them
- Frontend adapters map to wrong field names (`processing_model` instead of `primary_model_id`)
- Transaction UI doesn't display model information
- Frontend types use legacy field names

**Answer to User's Questions:**
1. **Is current system using single model?** → Yes, uses single `primaryModelId` per transaction (default: Nova Lite)
2. **Can admin panel configure models?** → Yes, infrastructure exists but frontend display is incomplete
3. **Are model + confidence recorded?** → Yes in cloud (DynamoDB), but local sync is broken

---

## Model Usage Summary

### Supported Models
- **Nova Lite** (`us.amazon.nova-lite-v1:0`) - Default, ~¥0.015/image
- **Nova Pro** (`us.amazon.nova-pro-v1:0`) - ~¥0.06/image
- **Azure DI** (`azure_di`) - Azure Document Intelligence
- **Comparison models**: Textract, Nova Mini (for A/B testing, optional)

### Processing Flow
```
Admin selects model → DynamoDB Control Table → Lambda reads config
→ Processes receipt with selected model → Writes primaryModelId + primaryConfidence
→ Should sync to local SQLite → Should display in Transaction UI ❌ BROKEN
```

---

## Implementation Plan

### Phase 1: Fix SQLite Schema (Migration v10)
**File**: `app/src/00_kernel/storage/migrations.ts`

**Changes:**
1. Update `CURRENT_VERSION = 10` (line 8)
2. Add migration call after line 68:
```typescript
if (version < 10) {
  await migration_v10(db);
  await setVersion(db, 10);
}
```
3. Add migration function after line 385:
```typescript
async function migration_v10(db: Database): Promise<void> {
  logger.info(EVENTS.DB_MIGRATION_APPLIED, {
    version: 10,
    name: 'add_model_metadata',
    phase: 'start'
  });

  await safeAddColumn(db, 'transactions', 'primary_model_id', 'TEXT');
  await safeAddColumn(db, 'transactions', 'primary_confidence', 'REAL');

  logger.info(EVENTS.DB_MIGRATION_APPLIED, { version: 10, phase: 'complete' });
}
```

**Rationale**: Creates actual SQLite columns (v9 only documented them, never created)

---

### Phase 2: Update Domain Types
**File**: `app/src/01_domains/transaction/types.ts`

**Changes**: Replace lines 36-38:
```typescript
// AI extraction metadata
confidence: number | null;         // [DEPRECATED: use primaryConfidence] 0-1 scale
rawText: string | null;
primaryModelId: string | null;     // e.g., 'us.amazon.nova-lite-v1:0', 'azure_di'
primaryConfidence: number | null;  // 0-100 confidence score (if available)
```

**Rationale**: Aligns with cloud schema, keeps deprecated field for transition

---

### Phase 3: Fix SQLite Adapter
**File**: `app/src/02_modules/transaction/adapters/transactionDb.ts`

**Changes (5 locations):**

1. **DbTransaction interface** (line 7-26): Add fields
```typescript
primary_model_id: string | null;
primary_confidence: number | null;
```

2. **mapDbToTransaction** (line 28-48): Add mapping
```typescript
primaryModelId: row.primary_model_id,
primaryConfidence: row.primary_confidence,
```

3. **saveTransaction INSERT** (line 207-230): Add columns
```sql
INSERT OR REPLACE INTO transactions
(..., primary_model_id, primary_confidence, ...)
VALUES (..., ?, ?, ...)
```

4. **upsertTransaction INSERT** (line 240-270): Same additions
5. **bulkUpsertTransactions INSERT** (line 424-458): Same additions

**Rationale**: Maps snake_case SQLite columns to camelCase domain objects

---

### Phase 4: Fix DynamoDB Adapter
**File**: `app/src/02_modules/transaction/adapters/transactionApi.ts`

**Changes (3 locations):**

1. **CloudTransactionSchema** (line 26-49): Add fields
```typescript
primaryModelId: z.string().optional().nullable(),
primaryConfidence: z.number().min(0).max(100).optional().nullable(),
```

2. **mapCloudToTransaction** (line 79-99): Add mapping
```typescript
primaryModelId: cloudTx.primaryModelId ?? null,
primaryConfidence: cloudTx.primaryConfidence ?? null,
```

3. **syncTransactions request** (line 241-259): Include in payload
```typescript
transactions: transactions.map(tx => ({
  ...,
  primaryModelId: tx.primaryModelId,
  primaryConfidence: tx.primaryConfidence,
}))
```

**Rationale**: Cloud schema already uses `primaryModelId`, just need to parse/serialize

---

### Phase 5: Add UI Display
**File**: `app/src/02_modules/transaction/views/TransactionView.tsx`

**Changes:**

1. Add helper function before `TransactionCard`:
```typescript
function formatModelName(modelId: string): string {
  const modelMap: Record<string, string> = {
    'us.amazon.nova-lite-v1:0': 'Nova Lite',
    'us.amazon.nova-mini-v1:0': 'Nova Mini',
    'us.amazon.nova-pro-v1:0': 'Nova Pro',
    'azure_di': 'Azure DI',
    'textract': 'Textract',
  };
  return modelMap[modelId] || modelId;
}
```

2. Update `TransactionCard` render (around line 550-560):
```typescript
{transaction.primaryModelId && (
  <span
    className="tag tag--model"
    title={`Processed by ${formatModelName(transaction.primaryModelId)}${
      transaction.primaryConfidence
        ? ` (${transaction.primaryConfidence}% confidence)`
        : ''
    }`}
  >
    🤖 {formatModelName(transaction.primaryModelId)}
    {transaction.primaryConfidence && (
      <span className="tag--confidence">
        {Math.round(transaction.primaryConfidence)}%
      </span>
    )}
  </span>
)}
```

**File**: `app/src/02_modules/transaction/views/ledger.css`

Add styles:
```css
.tag--model {
  background: var(--bg-panel);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.tag--confidence {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
}
```

**Rationale**: Subtle badge shows model + confidence without cluttering UI

---

### Phase 6: Update Documentation
**File**: `docs/architecture/SCHEMA.md`

**Changes** (line 149-187):
```sql
CREATE TABLE transactions (
  ...
  confidence REAL,                  -- [DEPRECATED] 0.0-1.0
  raw_text TEXT,
  primary_model_id TEXT,            -- v10: Model identifier
  primary_confidence REAL,          -- v10: 0-100 confidence score
  trace_id TEXT,                    -- v10: Distributed tracing
  ...
);
```

Add to schema version history:
```
- v10: Added `primary_model_id`, `primary_confidence`, `trace_id` (model metadata + tracing)
```

---

## Critical Files Summary

| File | Changes | Priority |
|------|---------|----------|
| `app/src/00_kernel/storage/migrations.ts` | Create migration v10 | 🔴 BLOCKER |
| `app/src/01_domains/transaction/types.ts` | Update domain types | 🟡 Medium |
| `app/src/02_modules/transaction/adapters/transactionDb.ts` | Fix SQLite adapter (5 changes) | 🔴 Critical |
| `app/src/02_modules/transaction/adapters/transactionApi.ts` | Fix DynamoDB adapter (3 changes) | 🔴 Critical |
| `app/src/02_modules/transaction/views/TransactionView.tsx` | Add UI display | 🟢 Low |
| `app/src/02_modules/transaction/views/ledger.css` | Add styles | 🟢 Low |
| `docs/architecture/SCHEMA.md` | Update documentation | 🟢 Low |

---

## Test Analysis & Design

### Current Test Coverage

**✅ Existing Tests:**
| File | Coverage | Test Count | Status |
|------|----------|------------|--------|
| `transactionApi.test.ts` | DynamoDB adapter | 8 test cases (TC-1.1 to TC-1.8) | ✅ Comprehensive |
| `syncService.test.ts` | Transaction sync logic | Multiple | ✅ Good |
| `syncService.integration.test.ts` | Integration tests | Multiple | ✅ Good |

**❌ Missing Tests:**
| Component | Missing Coverage | Priority |
|-----------|------------------|----------|
| `migrations.ts` | No migration tests | 🔴 Critical |
| `transactionDb.ts` | No SQLite adapter tests | 🔴 Critical |
| `TransactionView.tsx` | No UI component tests | 🟡 Medium |
| `formatModelName` | No helper function tests | 🟢 Low |

### Related Functions Analyzed

**Phase 1 (Migration v10):**
- `migration_v10()` - NEW function, needs tests
- `safeAddColumn()` - Existing (used by v8, v9), assumed tested via integration
- `getVersion()` / `setVersion()` - Core functions, assumed working

**Phase 3 (transactionDb.ts):**
- `mapDbToTransaction()` - Maps DB rows to domain objects, NO tests
- `saveTransaction()` - Inserts/updates single transaction, NO tests
- `upsertTransaction()` - Inserts/updates with conflict resolution, NO tests
- `bulkUpsertTransactions()` - Batch insert, NO tests

**Phase 4 (transactionApi.ts):**
- `fetchTransactions()` - ✅ Has 8 test cases (TC-1.1 to TC-1.8)
- `mapCloudToTransaction()` - Partially tested via TC-1.8, needs `primaryModelId` test
- `syncTransactions()` - Not directly tested (integration test exists)

**Phase 5 (UI):**
- `formatModelName()` - NEW function, needs tests
- `TransactionCard` - No component tests

---

## Test Design

### 1. Migration Tests (NEW)

**File**: `app/src/00_kernel/storage/migrations.test.ts`

**Test Cases:**

```typescript
describe('migration_v10', () => {
  it('TC-M10.1: Adds primary_model_id and primary_confidence columns', async () => {
    // Given: Fresh DB at v9
    const db = await createTestDb();
    await runMigrationsUpTo(db, 9);

    // When: Run migration v10
    await migration_v10(db);

    // Then: Columns exist
    const result = await db.select('PRAGMA table_info(transactions)');
    const columns = result.map((r: any) => r.name);
    expect(columns).toContain('primary_model_id');
    expect(columns).toContain('primary_confidence');
  });

  it('TC-M10.2: Migration is idempotent (safe to run twice)', async () => {
    // Given: DB already has v10 columns
    const db = await createTestDb();
    await runMigrationsUpTo(db, 10);

    // When: Run migration v10 again
    await migration_v10(db);

    // Then: No error, columns still exist
    const result = await db.select('PRAGMA table_info(transactions)');
    const columns = result.map((r: any) => r.name);
    expect(columns).toContain('primary_model_id');
    expect(columns).toContain('primary_confidence');
  });

  it('TC-M10.3: Existing transactions retain data after migration', async () => {
    // Given: v9 DB with existing transactions
    const db = await createTestDb();
    await runMigrationsUpTo(db, 9);
    await db.execute(`
      INSERT INTO transactions (id, user_id, amount, type, date, status)
      VALUES ('tx-1', 'user-1', 1000, 'expense', '2026-01-01', 'confirmed')
    `);

    // When: Run migration v10
    await migration_v10(db);

    // Then: Old data preserved, new columns NULL
    const result = await db.select('SELECT * FROM transactions WHERE id = ?', ['tx-1']);
    expect(result[0].id).toBe('tx-1');
    expect(result[0].amount).toBe(1000);
    expect(result[0].primary_model_id).toBeNull();
    expect(result[0].primary_confidence).toBeNull();
  });

  it('TC-M10.4: New transactions can write model metadata', async () => {
    // Given: v10 DB
    const db = await createTestDb();
    await runMigrationsUpTo(db, 10);

    // When: Insert transaction with model metadata
    await db.execute(`
      INSERT INTO transactions (id, user_id, amount, type, date, status, primary_model_id, primary_confidence)
      VALUES ('tx-2', 'user-1', 2000, 'income', '2026-01-02', 'confirmed', 'us.amazon.nova-lite-v1:0', 85.5)
    `);

    // Then: Model metadata stored correctly
    const result = await db.select('SELECT * FROM transactions WHERE id = ?', ['tx-2']);
    expect(result[0].primary_model_id).toBe('us.amazon.nova-lite-v1:0');
    expect(result[0].primary_confidence).toBe(85.5);
  });
});
```

---

### 2. transactionDb Adapter Tests (NEW)

**File**: `app/src/02_modules/transaction/adapters/transactionDb.test.ts`

**Test Cases:**

```typescript
describe('transactionDb', () => {
  describe('mapDbToTransaction', () => {
    it('TC-DB.1: Maps snake_case DB columns to camelCase domain fields', () => {
      // Given: DB row with model metadata
      const dbRow: DbTransaction = {
        id: 'tx-1',
        user_id: 'user-1',
        amount: 1000,
        type: 'expense',
        date: '2026-01-01',
        status: 'confirmed',
        primary_model_id: 'us.amazon.nova-lite-v1:0',
        primary_confidence: 85.5,
        // ... other fields
      };

      // When: Map to domain object
      const transaction = mapDbToTransaction(dbRow);

      // Then: Fields mapped correctly
      expect(transaction.primaryModelId).toBe('us.amazon.nova-lite-v1:0');
      expect(transaction.primaryConfidence).toBe(85.5);
    });

    it('TC-DB.2: Handles NULL model metadata gracefully', () => {
      // Given: DB row without model metadata
      const dbRow: DbTransaction = {
        // ... standard fields
        primary_model_id: null,
        primary_confidence: null,
      };

      // When: Map to domain object
      const transaction = mapDbToTransaction(dbRow);

      // Then: NULL preserved
      expect(transaction.primaryModelId).toBeNull();
      expect(transaction.primaryConfidence).toBeNull();
    });
  });

  describe('saveTransaction', () => {
    it('TC-DB.3: Saves transaction with model metadata', async () => {
      // Given: Transaction with model metadata
      const tx: Transaction = {
        id: TransactionId('tx-1'),
        userId: UserId('user-1'),
        amount: 1000,
        type: 'expense',
        date: '2026-01-01',
        status: 'confirmed',
        primaryModelId: 'us.amazon.nova-lite-v1:0',
        primaryConfidence: 85.5,
        // ... other fields
      };

      // When: Save to DB
      await saveTransaction(tx);

      // Then: Model metadata stored
      const result = await db.select(
        'SELECT primary_model_id, primary_confidence FROM transactions WHERE id = ?',
        ['tx-1']
      );
      expect(result[0].primary_model_id).toBe('us.amazon.nova-lite-v1:0');
      expect(result[0].primary_confidence).toBe(85.5);
    });

    it('TC-DB.4: Saves transaction without model metadata (NULL)', async () => {
      // Given: Transaction without model metadata (old format)
      const tx: Transaction = {
        // ... standard fields
        primaryModelId: null,
        primaryConfidence: null,
      };

      // When: Save to DB
      await saveTransaction(tx);

      // Then: NULL stored correctly
      const result = await db.select(
        'SELECT primary_model_id, primary_confidence FROM transactions WHERE id = ?',
        ['tx-1']
      );
      expect(result[0].primary_model_id).toBeNull();
      expect(result[0].primary_confidence).toBeNull();
    });
  });

  describe('bulkUpsertTransactions', () => {
    it('TC-DB.5: Bulk inserts transactions with model metadata', async () => {
      // Given: Multiple transactions with mixed model metadata
      const transactions: Transaction[] = [
        { id: 'tx-1', primaryModelId: 'us.amazon.nova-lite-v1:0', primaryConfidence: 85.5, /* ... */ },
        { id: 'tx-2', primaryModelId: 'azure_di', primaryConfidence: 92.3, /* ... */ },
        { id: 'tx-3', primaryModelId: null, primaryConfidence: null, /* ... */ },
      ];

      // When: Bulk upsert
      await bulkUpsertTransactions(transactions);

      // Then: All transactions stored with correct model metadata
      const results = await db.select('SELECT id, primary_model_id, primary_confidence FROM transactions ORDER BY id');
      expect(results[0].primary_model_id).toBe('us.amazon.nova-lite-v1:0');
      expect(results[1].primary_model_id).toBe('azure_di');
      expect(results[2].primary_model_id).toBeNull();
    });
  });
});
```

---

### 3. transactionApi Tests (EXTEND EXISTING)

**File**: `app/src/02_modules/transaction/adapters/transactionApi.test.ts`

**New Test Cases (add to existing file):**

```typescript
describe('fetchTransactions', () => {
  // ... existing TC-1.1 to TC-1.8 ...

  it('TC-1.9: Maps primaryModelId and primaryConfidence from cloud', async () => {
    // Given: Cloud response with model metadata
    const mockResponse = {
      transactions: [
        {
          userId: 'user-123',
          transactionId: 'tx-1',
          imageId: 'img-1',
          amount: 1000,
          type: 'expense',
          date: '2026-01-01',
          merchant: 'Test Merchant',
          category: 'shopping',
          status: 'confirmed',
          createdAt: '2026-01-01T10:00:00Z',
          updatedAt: '2026-01-01T10:00:00Z',
          version: 1,
          primaryModelId: 'us.amazon.nova-lite-v1:0',
          primaryConfidence: 85.5,
        },
      ],
      nextCursor: null,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    // When: Fetch transactions
    const result = await fetchTransactions(testUserId);

    // Then: Model metadata mapped correctly
    expect(result).toHaveLength(1);
    expect(result[0].primaryModelId).toBe('us.amazon.nova-lite-v1:0');
    expect(result[0].primaryConfidence).toBe(85.5);
  });

  it('TC-1.10: Handles missing model metadata from cloud (backward compatibility)', async () => {
    // Given: Cloud response WITHOUT model metadata (old format)
    const mockResponse = {
      transactions: [
        {
          // ... standard fields WITHOUT primaryModelId/primaryConfidence
        },
      ],
      nextCursor: null,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    // When: Fetch transactions
    const result = await fetchTransactions(testUserId);

    // Then: No error, model fields are NULL
    expect(result[0].primaryModelId).toBeNull();
    expect(result[0].primaryConfidence).toBeNull();
  });

  it('TC-1.11: Rejects invalid confidence values (Zod validation)', async () => {
    // Given: Cloud response with invalid confidence (-5 or 150)
    const mockResponse = {
      transactions: [
        {
          // ... standard fields
          primaryModelId: 'us.amazon.nova-lite-v1:0',
          primaryConfidence: 150, // Invalid! Must be 0-100
        },
      ],
      nextCursor: null,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    // When: Fetch transactions
    // Then: Zod throws validation error
    await expect(fetchTransactions(testUserId)).rejects.toThrow(/Invalid transaction response/);
  });
});
```

---

### 4. UI Helper Function Tests (NEW)

**File**: `app/src/02_modules/transaction/views/formatModelName.test.ts`

**Test Cases:**

```typescript
describe('formatModelName', () => {
  it('TC-UI.1: Formats Nova Lite model ID', () => {
    expect(formatModelName('us.amazon.nova-lite-v1:0')).toBe('Nova Lite');
  });

  it('TC-UI.2: Formats Azure DI model ID', () => {
    expect(formatModelName('azure_di')).toBe('Azure DI');
  });

  it('TC-UI.3: Returns raw ID for unknown model', () => {
    expect(formatModelName('unknown-model-123')).toBe('unknown-model-123');
  });

  it('TC-UI.4: Formats all supported models', () => {
    const models = [
      ['us.amazon.nova-lite-v1:0', 'Nova Lite'],
      ['us.amazon.nova-mini-v1:0', 'Nova Mini'],
      ['us.amazon.nova-pro-v1:0', 'Nova Pro'],
      ['azure_di', 'Azure DI'],
      ['textract', 'Textract'],
    ];

    models.forEach(([input, expected]) => {
      expect(formatModelName(input)).toBe(expected);
    });
  });
});
```

---

### Test Implementation Order

**Priority 1 (Must Have Before Merge):**
1. Migration tests (`migrations.test.ts`) - TC-M10.1 to TC-M10.4
2. transactionDb tests (`transactionDb.test.ts`) - TC-DB.1 to TC-DB.5

**Priority 2 (Should Have):**
3. Extend transactionApi tests - TC-1.9 to TC-1.11

**Priority 3 (Nice to Have):**
4. UI helper tests (`formatModelName.test.ts`) - TC-UI.1 to TC-UI.4
5. Component tests for `TransactionCard` (optional, visual testing preferred)

---

## Testing Strategy

### Manual Test Scenarios

**✅ Scenario 1: New Transaction (Happy Path)**
1. Upload receipt via Capture
2. Wait for processing (instant mode)
3. Sync transactions from cloud
4. Verify Ledger shows model badge with name
5. Check SQLite: `SELECT primary_model_id FROM transactions LIMIT 1;`

**✅ Scenario 2: Backward Compatibility**
1. Query old transaction (created before this change)
2. Verify UI renders without error
3. Confirm no badge shown (graceful degradation)

**✅ Scenario 3: Different Models**
1. Admin Panel: Switch model to Azure DI
2. Upload receipt
3. Verify badge shows "Azure DI" + confidence %
4. Admin Panel: Switch back to Nova Lite
5. Upload another receipt
6. Verify badge shows "Nova Lite"

**✅ Scenario 4: Cloud Sync Round-Trip**
1. Device A: Create transaction
2. Sync to cloud (verify DynamoDB has `primaryModelId`)
3. Device B: Sync from cloud
4. Verify Device B shows model badge correctly

---

## Verification Checklist

**Before marking complete:**

### Functionality
- [ ] SQLite migration v10 runs successfully on fresh DB
- [ ] Existing users' DBs migrate without error
- [ ] New transactions display model badge in Ledger
- [ ] Old transactions render without crash
- [ ] Azure DI transactions show confidence %
- [ ] Nova transactions show model name (no confidence)
- [ ] Cloud sync preserves model metadata
- [ ] SCHEMA.md accurately reflects v10 changes
- [ ] No Zod validation errors in logs
- [ ] No null pointer exceptions in UI

### Tests
- [ ] **Migration tests**: TC-M10.1 to TC-M10.4 pass
- [ ] **transactionDb tests**: TC-DB.1 to TC-DB.5 pass
- [ ] **transactionApi tests**: TC-1.9 to TC-1.11 pass
- [ ] **UI helper tests**: TC-UI.1 to TC-UI.4 pass (optional)
- [ ] All existing tests still pass (`npm test`)
- [ ] No new test failures introduced

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Migration fails on existing DBs | High | `safeAddColumn` is idempotent (catches "column exists") |
| Zod breaks on old cloud data | Medium | Schema uses `.optional().nullable()` |
| UI crashes on unknown model ID | Medium | `formatModelName` returns raw ID as fallback |
| Sync conflicts with legacy fields | Low | Keep deprecated `confidence` during transition |

---

## Implementation Order

**Recommended sequence (minimizes breakage):**

### Phase A: Core Implementation (2-3 hours)
1. **Migration v10** → enables columns (🔴 BLOCKER)
2. **Domain types** → type definitions
3. **transactionDb.ts** → local data first (5 changes)
4. **transactionApi.ts** → cloud sync second (3 changes)
5. **TransactionView.tsx + CSS** → UI display
6. **SCHEMA.md** → documentation

### Phase B: Test Implementation (1-2 hours)
7. **Migration tests** → `migrations.test.ts` (TC-M10.1 to TC-M10.4)
8. **transactionDb tests** → `transactionDb.test.ts` (TC-DB.1 to TC-DB.5)
9. **Extend transactionApi tests** → Add TC-1.9 to TC-1.11
10. **UI helper tests** (optional) → `formatModelName.test.ts` (TC-UI.1 to TC-UI.4)

**Total estimated time**: 3-5 hours (implementation + tests)

---

## Success Criteria

### Functional Requirements
✅ New transactions display model name in Ledger
✅ Azure DI shows confidence percentage
✅ Nova shows model name (no confidence data from Nova models)
✅ Old transactions render without error
✅ Admin panel model changes take effect immediately

### Technical Requirements
✅ SQLite v10 migration creates model columns
✅ Adapters correctly map snake_case ↔ camelCase
✅ Zod validates both old and new transaction formats
✅ No runtime errors in console
✅ Pillar B (Airlock) enforced at all boundaries

---

## Related Documentation

- **Architecture**: `docs/architecture/SCHEMA.md` (transaction schema)
- **Admin Panel**: `admin/src/components/Models.tsx` (model selection UI)
- **Lambda Config**: `infra/lambda/admin/model-config/index.mjs` (config API)
- **Processing**: `infra/lambda/instant-processor/index.mjs` (model invocation)
- **ADR**: Consider creating ADR if this becomes part of long-term architecture

---

**Plan Status**: Ready for implementation
**Next Step**: Execute phases 1-6 in sequence
