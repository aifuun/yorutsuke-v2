# Receipt Model Comparison Testing Guide

**Issue**: #143
**Branch**: `feature/receipt-model-comparison-test`
**Status**: Ready for deployment & testing
**Last Updated**: 2026-01-13

## Phase 7: Deploy & Test Multi-Model Comparison

This guide walks through deploying the multi-model receipt comparison feature and validating that all 4 models (Textract, Nova Mini/Pro, Claude Sonnet) work correctly.

## Architecture Recap

```
Upload Receipt → S3 triggers Lambda → Nova Mini (primary) + 4-model comparison
                                     ├─ Textract (AWS AnalyzeExpense)
                                     ├─ Nova Mini (Bedrock) ← already done
                                     ├─ Nova Pro (Bedrock)
                                     └─ Claude Sonnet (Bedrock)

Results stored in DynamoDB:
├─ Primary transaction data (from Nova Mini)
└─ modelComparison: { textract, nova_mini, nova_pro, claude_sonnet }
```

## Pre-Deployment Checklist

- [ ] Code review complete
- [ ] All 3 commits in feature branch
- [ ] No TypeScript/ESLint errors
- [ ] AWS credentials configured (`aws configure --profile dev`)
- [ ] S3 bucket exists: `yorutsuke-images-dev`
- [ ] DynamoDB table exists: `yorutsuke-transactions-dev`
- [ ] Lambda layers deployed
- [ ] Bedrock access enabled for all 3 models
- [ ] Textract API accessible in your region

## Deployment Steps

### Step 1: Deploy Lambda Shared Layer

```bash
cd infra

# Verify layer changes
cdk diff --profile dev | grep -A 5 "nodejs"

# Deploy layer only
cdk deploy --profile dev --require-approval never
```

**Expected output**: Layer deployed with new `model-analyzer.mjs`

```
✓ Deploy complete
  Outputs:
  SharedLayerArn = arn:aws:lambda:ap-northeast-1:...:layer:...
```

### Step 2: Deploy Lambda Functions

```bash
# Both instant-processor and batch-process will auto-update since they use the layer

cdk deploy --profile dev --require-approval never
```

**Expected**:
- `yorutsuke-instant-processor-dev` updated
- `yorutsuke-batch-process-dev` updated

### Step 3: Verify Deployment

```bash
# Check layer deployed correctly
aws lambda list-layers --profile dev | jq '.Layers[] | select(.LayerArn | contains("yorutsuke"))'

# Check Lambda has new layer version
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-dev \
  --profile dev | jq '.Layers'
```

## Test 1: Single Receipt (Instant Processor)

### Scenario: Upload receipt from 7-Eleven (convenience store)

**Goal**: Verify all 4 models successfully extract data

#### 1a. Prepare Test Receipt

```bash
# Use existing test asset or create new one
ls /private/tmp/yorutsuke-test/sample-receipts/

# Or use this path if available:
TEST_RECEIPT="/private/tmp/yorutsuke-test/lawson-receipt.webp"
```

#### 1b. Upload via App

1. Open Yorutsuke app
2. Click "Capture"
3. Select test receipt image (or drag-drop)
4. Wait for processing (should see sync indicator)

**What happens**:
1. Image uploaded to `s3://yorutsuke-images-dev/uploads/{userId}/{timestamp}.webp`
2. S3 trigger fires Lambda
3. Lambda runs 4 models in parallel:
   - ~500ms - Textract AnalyzeExpense
   - ~200ms - Nova Mini Bedrock
   - ~500ms - Nova Pro Bedrock
   - ~800ms - Claude Sonnet Bedrock
4. Total: ~1-2 seconds (parallel execution)
5. Transaction created with all 4 results

#### 1c. Check CloudWatch Logs

```bash
# Watch logs in real-time
aws logs tail /aws/lambda/yorutsuke-instant-processor-dev \
  --follow --profile dev

# Look for these events:
# - IMAGE_PROCESSING_STARTED
# - MODEL_COMPARISON_STARTED
# - MODEL_COMPLETED (x4)
# - IMAGE_PROCESSING_COMPLETED
```

**Expected log output**:
```json
{
  "level": "info",
  "event": "MODEL_COMPARISON_STARTED",
  "traceId": "trace-abc-123",
  "imageId": "uuid-1234"
}

{
  "level": "debug",
  "event": "MODEL_COMPLETED",
  "traceId": "trace-abc-123",
  "model": "textract"
}

{
  "level": "debug",
  "event": "MODEL_COMPLETED",
  "traceId": "trace-abc-123",
  "model": "nova_mini"
}

{
  "level": "debug",
  "event": "MODEL_COMPLETED",
  "traceId": "trace-abc-123",
  "model": "nova_pro"
}

{
  "level": "debug",
  "event": "MODEL_COMPLETED",
  "traceId": "trace-abc-123",
  "model": "claude_sonnet"
}

{
  "level": "info",
  "event": "MODEL_COMPARISON_COMPLETED",
  "traceId": "trace-abc-123",
  "status": "completed",
  "successCount": 4,
  "failureCount": 0
}
```

#### 1d. Query DynamoDB Transaction

```bash
# Get transaction by imageId
aws dynamodb get-item \
  --table-name yorutsuke-transactions-dev \
  --key '{"transactionId":{"S":"tx-uuid-1234"}}' \
  --profile dev | jq '.Item'
```

**Expected response**:
```json
{
  "transactionId": {"S": "tx-abc-123"},
  "userId": {"S": "device-xyz"},
  "imageId": {"S": "abc-123"},
  "amount": {"N": "1500"},
  "merchant": {"S": "セブン-イレブン (7-Eleven)"},
  "category": {"S": "food"},
  "date": {"S": "2026-01-13"},
  "status": {"S": "unconfirmed"},

  "modelComparison": {
    "M": {
      "textract": {
        "M": {
          "vendor": {"S": "7-ELEVEN STORE #1234"},
          "lineItems": {
            "L": [
              {"M": {"description": {"S": "Onigiri"}, "totalPrice": {"N": "150"}}}
            ]
          },
          "totalAmount": {"N": "1500"},
          "taxAmount": {"N": "120"},
          "taxRate": {"N": "8"}
        }
      },
      "nova_mini": {
        "M": {
          "vendor": {"S": "7-Eleven"},
          "totalAmount": {"N": "1500"},
          "confidence": {"N": "90"}
        }
      },
      "nova_pro": {
        "M": {
          "vendor": {"S": "セブン-イレブン (7-Eleven)"},
          "lineItems": {
            "L": [
              {"M": {"description": {"S": "弁当"}, "quantity": {"N": "1"}, "totalPrice": {"N": "1200"}},
              {"M": {"description": {"S": "飲料"}, "quantity": {"N": "1"}, "totalPrice": {"N": "150"}}
            ]
          },
          "totalAmount": {"N": "1500"},
          "confidence": {"N": "85"}
        }
      },
      "claude_sonnet": {
        "M": {
          "vendor": {"S": "セブン-イレブン"},
          "lineItems": {
            "L": [
              {"M": {"description": {"S": "おにぎり"}, "quantity": {"N": "1"}, "unitPrice": {"N": "130"}, "totalPrice": {"N": "130"}}}
            ]
          },
          "totalAmount": {"N": "1500"},
          "confidence": {"N": "92"}
        }
      }
    }
  },

  "comparisonStatus": {"S": "completed"},
  "comparisonTimestamp": {"S": "2026-01-13T10:30:00.000Z"},
  "comparisonErrors": {"NULL": true}
}
```

### Success Criteria for Test 1

✅ All 4 models returned results
✅ Each model normalized to ModelResultSchema
✅ No errors in comparisonErrors array
✅ comparisonStatus = "completed"
✅ CloudWatch logs show 4 MODEL_COMPLETED events
✅ Confidence scores present in Bedrock responses
✅ Merchant names populated (may vary across models)

---

## Test 2: Merchant Name Matching Accuracy

### Scenario: Upload 5 receipts from common merchants

**Goal**: Compare how each model handles merchant name extraction and matching

#### 2a. Create 5 Test Uploads

Upload receipts from:
1. **Lawson** (ローソン) - convenience store
2. **Ito-Yokado** (イトーヨーカドー) - supermarket
3. **Starbucks** (スターバックス) - cafe
4. **Unknown shop** (local merchant not in list) - should return "Unknown"
5. **Damaged receipt** (low quality image) - test error handling

#### 2b. Query All Transactions

```bash
# Get all transactions with model comparison (last 5)
aws dynamodb query \
  --table-name yorutsuke-transactions-dev \
  --index-name createdAtIndex \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid":{"S":"device-xyz"}}' \
  --scan-index-forward false \
  --limit 5 \
  --profile dev | jq '.Items[] | {imageId, merchant: .merchant.S, modelComparison: .modelComparison.M | keys}'
```

#### 2c. Compare Results

Create comparison table:

```
Receipt  | Textract Merchant    | Nova Mini           | Nova Pro            | Claude              | Match?
---------|----------------------|---------------------|---------------------|---------------------|-------
Lawson   | LAWSON STORE #5678   | ローソン (Lawson)    | ローソン (Lawson)    | Lawson              | ✓ 3/4
Ito-Yoka | ITO-YOKADO #1234     | イト-ヨーカドー     | イトーヨーカドー     | Ito-Yokado          | ✓ 3/4
Starbks  | STARBUCKS COFFEE #99 | Starbucks           | スターバックス       | Starbucks Coffee    | ✓ 3/4
Unknown  | LOCAL SHOP ABC       | Unknown             | Unknown             | Unknown             | ✓ All return Unknown
Damaged  | [recognition failed] | [parsing error]     | 金額のみ抽出        | [low confidence]    | Graceful error
```

### Success Criteria for Test 2

✅ At least 3/4 models extract correct merchant name for known stores
✅ Unknown merchant consistently returns "Unknown" across models
✅ Failed models don't block transaction creation (graceful degradation)
✅ CloudWatch shows MODEL_FAILED for damaged receipt
✅ comparisonErrors populated with model-specific failures
✅ App still shows transaction even with partial model failures

---

## Test 3: Lineitem Extraction Comparison

### Scenario: Upload receipt with 5+ items

**Goal**: Compare structured lineitem extraction across models

#### 3a. Use Multi-Item Receipt

```bash
# Find test receipt with multiple items
TEST_RECEIPT="/private/tmp/yorutsuke-test/receipt-5items.webp"
```

#### 3b. Extract Lineitem Data

```bash
aws dynamodb get-item \
  --table-name yorutsuke-transactions-dev \
  --key '{"transactionId":{"S":"tx-multiitem"}}' \
  --profile dev | jq '.Item.modelComparison.M | to_entries[] | {model: .key, items: .value.M.lineItems.L | length}'
```

**Expected comparison**:

```
Model              | Items Found | Accuracy | Notes
------------------|-------------|----------|------------------
Textract           | 5           | High     | Structured JSON
Nova Mini          | 2-3         | Medium   | Simplified items only
Nova Pro           | 4-5         | High     | Complete lineItems
Claude Sonnet      | 5           | Highest  | Most detailed descriptions
```

### Success Criteria for Test 3

✅ Nova Pro and Claude extract 4+ items
✅ Textract extracts all items with quantities/prices
✅ lineItems array populated in modelComparison
✅ Each item has description, quantity, unitPrice, totalPrice fields
✅ Line totals sum correctly per model
✅ All models capture subtotal, tax, total correctly

---

## Test 4: Error Scenarios

### Scenario A: Textract Access Denied

**Setup**:
```bash
# Temporarily remove Textract permissions (then restore)
aws iam detach-role-policy \
  --role-name yorutsuke-instant-processor-role-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess \
  --profile dev
```

**Expected**:
- Textract fails with "AccessDeniedException"
- Other 3 models succeed
- comparisonErrors contains: `{model: "textract", error: "AccessDeniedException"}`
- Transaction still created with 3/4 model results
- comparisonStatus = "completed" (not "failed")

**Cleanup**:
```bash
# Restore permissions
aws iam attach-role-policy \
  --role-name yorutsuke-instant-processor-role-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess \
  --profile dev
```

### Scenario B: Malformed Image

**Setup**: Upload corrupted/blank image

**Expected**:
- All 4 models return error
- CloudWatch shows 4 MODEL_FAILED events
- comparisonStatus = "failed"
- comparisonErrors has 4 entries
- Transaction created with status = "needs_review"
- validationErrors populated

### Scenario C: Timeout

**Setup**: Use very large image (5MB+)

**Expected**:
- Some models timeout (Lambda 15min limit)
- Partial results in modelComparison
- comparisonErrors includes timeout entries
- Transaction eventually created

### Success Criteria for Test 4

✅ All error scenarios handled gracefully
✅ No crashes or unhandled exceptions
✅ comparisonErrors properly populated per model
✅ App continues functioning with partial data
✅ CloudWatch shows detailed error messages
✅ Failed models don't block transaction creation

---

## Performance Metrics to Capture

### Test 5: Performance Analysis

```bash
# Extract timing data from CloudWatch logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-dev \
  --filter-pattern '"MODEL_COMPARISON_COMPLETED"' \
  --profile dev | jq '.events[] | .message | fromjson | {imageId, status, successCount, failureCount}'

# Calculate average duration
# (comparisonTimestamp - createdAt) ÷ 1000 = seconds
```

**Capture metrics**:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Total comparison time | < 3s | ? | ✓/✗ |
| Textract latency | < 1s | ? | ✓/✗ |
| Nova Mini latency | < 300ms | ? | ✓/✗ |
| Nova Pro latency | < 800ms | ? | ✓/✗ |
| Claude latency | < 1.5s | ? | ✓/✗ |
| Success rate (all 4) | > 95% | ? | ✓/✗ |
| Partial success (3/4) | > 99% | ? | ✓/✗ |
| Lambda invocation time | < 5s total | ? | ✓/✗ |
| DynamoDB write latency | < 500ms | ? | ✓/✗ |

---

## Final Validation Checklist

Before marking complete:

### Code Quality
- [ ] No TypeScript errors
- [ ] No uncaught promise rejections
- [ ] All models normalize correctly
- [ ] Error handling comprehensive
- [ ] Logging complete and semantic

### Functionality
- [ ] All 4 models invoked per receipt
- [ ] Results stored in modelComparison
- [ ] Nova Mini result still primary (backward compatible)
- [ ] Failed models don't block transaction creation
- [ ] Partial failures handled gracefully

### Data Integrity
- [ ] ModelResultSchema validation passes
- [ ] TransactionSchema accepts new fields
- [ ] No data loss or corruption
- [ ] DynamoDB write succeeds with large comparison objects

### Observability
- [ ] CloudWatch logs show all model events
- [ ] traceId links all steps together
- [ ] comparisonStatus accurate
- [ ] comparisonErrors complete and accurate
- [ ] App shows sync success despite multiple model calls

### Performance
- [ ] Comparison doesn't exceed Lambda timeout
- [ ] Parallel execution working (Promise.allSettled)
- [ ] No memory issues with base64 images
- [ ] S3 copy/verify/write sequence correct

### User Experience
- [ ] App remains responsive during processing
- [ ] Sync indicator shows progress
- [ ] No UI errors or crashes
- [ ] Transaction appears with correct primary data
- [ ] All 4 models' results queryable from app

---

## Rollback Plan

If comparison feature causes issues:

### Option 1: Remove comparison (keep primary data)

```bash
# Edit instant-processor/index.mjs:
# Comment out analyzer call (lines 195-214)
# Keep transactionData as-is (falls back to Nova Mini only)

git add infra/lambda/instant-processor/index.mjs
git commit -m "fix: disable multi-model comparison temporarily"
cdk deploy --profile dev
```

### Option 2: Full rollback to previous commit

```bash
git checkout HEAD~2  # Before multi-model commits
cdk deploy --profile dev
```

### Option 3: Revert feature branch

```bash
git checkout development
git reset --hard HEAD~3  # Remove 3 commits
git push origin development --force
```

---

## Success Definition

**Phase 7 Complete when**:

1. ✅ All 4 models invoked successfully in 95%+ of uploads
2. ✅ Comparison results stored and queryable in DynamoDB
3. ✅ No failures or regressions in existing functionality
4. ✅ CloudWatch logs show clean model performance
5. ✅ App remains stable with new data structure
6. ✅ All error scenarios handled gracefully
7. ✅ Performance acceptable (< 3s total comparison time)
8. ✅ Feature branch ready to merge to development

---

## Next Steps (Post-Deployment)

1. **Data Analysis**: Compare model accuracy metrics
   - Which model performs best per receipt type?
   - Confidence scores alignment?
   - Lineitem extraction quality?

2. **Optimization**: Fine-tune based on results
   - Adjust prompts for better extraction
   - Evaluate cost vs quality per model
   - Consider model fallback strategy

3. **Frontend Integration**: Display comparison results
   - User can see all 4 models' extracted data
   - Compare side-by-side
   - Override with model of choice

4. **Production Rollout**: If successful
   - Apply to production environment
   - Monitor costs and latency
   - Implement model selection UI

---

**Created**: 2026-01-13
**Status**: Ready for testing
**Contact**: Woo (developer)
