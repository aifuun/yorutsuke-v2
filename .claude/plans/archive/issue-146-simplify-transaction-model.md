# Issue #146: Simplify Transaction Model Fields

**Goal**: Remove multi-model comparison complexity, use single `processingModel` field

**Status**: Planning
**Created**: 2026-01-17
**Estimated**: 4-6 hours

---

## Problem Analysis

### Current Architecture (Overly Complex)

```typescript
// DynamoDB
{
  transactionId: "tx-123",
  modelComparison: {
    nova_mini: { confidence: 90, totalAmount: 150, ... },
    textract: null,
    claude_sonnet: null,
    comparisonTimestamp: "...",
    comparisonErrors: [...]
  }
}

// Frontend extracts "primary" from comparison
primaryModel = extractPrimaryModel(modelComparison) // "nova_mini"
```

**Problems**:
1. Multi-model comparison for A/B testing, but not used in production
2. Complex extraction logic to find "primary" model
3. Large DynamoDB records (multi-model results)
4. No clear trace of configured model

### Desired Architecture (Simple)

```typescript
// DynamoDB
{
  transactionId: "tx-123",
  processingModel: "us.amazon.nova-lite-v1:0",  // From admin config
  confidence: 0.9
}

// Frontend uses directly
tx.processingModel // "us.amazon.nova-lite-v1:0"
```

**Benefits**:
- 1:1 relationship: one transaction, one model
- Clear traceability: know exact model from admin config
- Smaller records, simpler code

---

## Implementation Plan

### Phase 1: Backend Schema (infra/)

#### File: `infra/lambda/shared-layer/nodejs/shared/schemas.mjs`

**Remove**:
```javascript
// DELETE these fields from TransactionSchema
modelComparison: ModelComparisonSchema.optional(),
comparisonStatus: z.enum(['pending', 'completed', 'failed']).optional(),
comparisonTimestamp: z.string().optional(),
comparisonErrors: z.array(...).optional(),
```

**Add**:
```javascript
// ADD to TransactionSchema
processingModel: z.string(), // e.g., 'us.amazon.nova-lite-v1:0'
confidence: z.number().min(0).max(1).optional(), // Already exists, ensure it's there
```

**Remove entire schemas**:
```javascript
// DELETE ModelResultSchema
// DELETE ModelComparisonSchema
```

#### File: `infra/lambda/instant-processor/index.mjs`

**Current logic** (lines ~200-350):
```javascript
// Multi-model comparison
const comparison = {
  nova_mini: await analyzeWithNova(imageBytes, 'mini'),
  textract: await analyzeWithTextract(imageBytes),
  // ...
};

transactionData = {
  ...
  modelComparison: comparison
};
```

**New logic**:
```javascript
// Single model processing
const modelId = config.modelId || 'us.amazon.nova-lite-v1:0';
const result = await analyzeWithModel(imageBytes, modelId);

transactionData = {
  ...
  processingModel: modelId,
  confidence: result.confidence / 100  // Convert 0-100 to 0-1
};
```

**Steps**:
1. Remove multi-model analyzer functions
2. Use single model from admin config
3. Save `processingModel` and `confidence` fields
4. Remove comparison logic

#### File: `docs/architecture/SCHEMA.md`

Update CloudTransaction interface:
```typescript
interface CloudTransaction {
  userId: string;
  transactionId: string;
  s3Key: string;
  amount: number;
  // ...
  processingModel: string;  // NEW: Model used for processing
  confidence: number;       // UPDATED: Direct confidence value
  // REMOVED: modelComparison, comparisonStatus, etc.
}
```

---

### Phase 2: Frontend Changes (app/src/)

#### File: `app/src/01_domains/transaction/types.ts`

**Change**:
```typescript
export interface Transaction {
  // ... existing fields

  // AI extraction metadata
  confidence: number | null;      // Keep
  rawText: string | null;          // Keep
  processingModel: string | null;  // RENAME from primaryModel
}
```

#### File: `app/src/02_modules/transaction/adapters/transactionApi.ts`

**Remove**:
```typescript
// DELETE ModelResultSchema
// DELETE ModelComparisonSchema
// DELETE extractPrimaryModel() function
```

**Update CloudTransactionSchema**:
```typescript
const CloudTransactionSchema = z.object({
  // ... existing fields
  processingModel: z.string().optional(),  // ADD
  confidence: z.number().optional(),       // ADD (if not exists)
  // REMOVE: modelComparison field
});
```

**Update mapCloudToTransaction()**:
```typescript
function mapCloudToTransaction(cloudTx: CloudTransaction): Transaction {
  return {
    // ... existing fields
    confidence: cloudTx.confidence ?? null,
    processingModel: cloudTx.processingModel ?? null,
    rawText: null,
  };
}
```

#### File: `app/src/02_modules/debug/views/DebugView.tsx`

**Update display**:
```tsx
// Change label
{tx.processingModel && (
  <div className="debug-tx-row">
    <span className="debug-tx-label">Processing Model:</span>
    <span className="debug-tx-value mono">{tx.processingModel}</span>
  </div>
)}
```

---

### Phase 3: Deployment & Verification

#### Step 1: Deploy Backend
```bash
cd infra
npm run deploy -- --profile dev
```

#### Step 2: Verify Lambda
```bash
# Upload test receipt
# Check CloudWatch logs for:
# - "processingModel": "us.amazon.nova-lite-v1:0"
# - "confidence": 0.9
```

#### Step 3: Verify DynamoDB
```bash
aws dynamodb scan --table-name yorutsuke-transactions-us-dev --limit 1 --profile dev | jq '.Items[0] | {processingModel, confidence, modelComparison}'

# Expected:
# {
#   "processingModel": "us.amazon.nova-lite-v1:0",
#   "confidence": 0.9,
#   "modelComparison": null  # Old records may have this
# }
```

#### Step 4: Test Frontend
```bash
cd app
npm run tauri dev

# In Debug panel:
# 1. Click "Fetch" in Latest Cloud Transactions
# 2. Verify displays:
#    - Processing Model: us.amazon.nova-lite-v1:0
#    - Confidence: 90.0%
```

---

## Backward Compatibility

### Old Records (before deployment)
```json
{
  "modelComparison": { "nova_mini": {...}, ... },
  "processingModel": null  // Missing
}
```

**Handling**: Frontend shows `processingModel: '-'` or `'unknown'`

### New Records (after deployment)
```json
{
  "processingModel": "us.amazon.nova-lite-v1:0",
  "confidence": 0.9,
  "modelComparison": null  // No longer populated
}
```

**Strategy**: No data migration needed. Old records gracefully degrade.

---

## Files Changed

### Backend (infra/)
- [ ] `lambda/shared-layer/nodejs/shared/schemas.mjs` (remove comparison schemas, add processingModel)
- [ ] `lambda/instant-processor/index.mjs` (remove multi-model logic, use single model)
- [ ] `docs/architecture/SCHEMA.md` (update CloudTransaction docs)

### Frontend (app/src/)
- [ ] `01_domains/transaction/types.ts` (rename primaryModel → processingModel)
- [ ] `02_modules/transaction/adapters/transactionApi.ts` (remove comparison logic)
- [ ] `02_modules/debug/views/DebugView.tsx` (update label)

---

## Testing Checklist

- [ ] Backend: Lambda deploys without errors
- [ ] Backend: New transactions have `processingModel` field
- [ ] Backend: `modelComparison` no longer populated
- [ ] Frontend: TypeScript compiles without errors
- [ ] Frontend: Debug panel displays `Processing Model`
- [ ] Frontend: Old transactions display gracefully (missing field)
- [ ] Integration: Upload receipt → Check DynamoDB → Verify in Debug panel

---

## Rollback Plan

If issues occur:
1. Revert backend schema (add back modelComparison)
2. Revert frontend code (restore extractPrimaryModel logic)
3. Redeploy Lambda

Git commits will be atomic for easy revert.

---

## Next Steps

1. Implement Phase 1 (Backend)
2. Deploy and verify
3. Implement Phase 2 (Frontend)
4. Test end-to-end
5. Update documentation
6. Close issue #146
