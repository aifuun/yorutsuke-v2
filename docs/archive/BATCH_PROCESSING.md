# Batch Processing - Archived Design

> **Status**: Archived (2026-01-17)
> **Reason**: Using Instant mode only. Batch mode removed to reduce complexity and align with single-model approach (Issue #146).
> **Future**: This document preserves design knowledge for potential re-implementation when user volume justifies batch discounts.

---

## Overview

Yorutsuke v2 was designed with **three configurable processing modes**: Instant, Batch, and Hybrid. This allowed flexibility in balancing cost vs. latency based on user volume and business needs.

### Processing Modes

| Mode | API | Min Images | Trigger | Cost | Latency | Use Case |
|------|-----|------------|---------|------|---------|----------|
| **Instant** | On-Demand | 1 | Every upload | Full price | ~5-10s/image | Low volume, immediate feedback |
| **Batch** | Batch Inference | 100 | Threshold/scheduled | **50% discount** | Hours | High volume, cost-sensitive |
| **Hybrid** | Mixed | 1 | Smart switching | Mixed | Variable | Medium volume, balanced |

### Why Removed (2026-01)

**Current situation**:
- Only using Instant mode (confirmed in DynamoDB control table)
- Batch Lambda exists but unused (~300 lines)
- Conflicts with Issue #146 (single-model simplification)
- Adds maintenance burden for zero active usage

**Decision**: Archive code, preserve knowledge, re-implement when needed.

---

## AWS Bedrock Batch Inference

### Key Constraints

| Constraint | Value | Impact |
|------------|-------|--------|
| **Minimum records** | 100 | Can't batch fewer than 100 images |
| **Discount** | 50% | Half the cost of On-Demand |
| **Latency** | Hours | Not suitable for real-time needs |
| **API** | CreateModelInvocationJob | Different from On-Demand InvokeModel |

### When to Use Batch Mode

**Volume thresholds**:
```
< 50 images/day     → Instant mode (no wait, simple)
50-200 images/day   → Hybrid mode (batch when possible, instant fallback)
> 200 images/day    → Batch mode (maximize cost savings)
```

**Cost example** (assuming ¥0.015/image with Nova Lite):
- 500 images/day × Instant = ¥7.5/day
- 500 images/day × Batch = ¥3.75/day (**¥3.75 saved**)

---

## Architecture

### Instant Mode (Currently Active)

```
┌────────────────────────────────────────────────────┐
│  S3 ObjectCreated Event                            │
│       ↓                                            │
│  ┌──────────────────────────┐                     │
│  │ instant-processor Lambda │                     │
│  │ - Read image from S3     │                     │
│  │ - Call Bedrock On-Demand │                     │
│  │ - Write to transactions  │                     │
│  │ - Move to processed/     │                     │
│  └──────────────────────────┘                     │
│                                                    │
│  ⏱️ Latency: ~5-10s per image                      │
│  💰 Cost: Full price                               │
└────────────────────────────────────────────────────┘
```

### Batch Mode (Archived)

```
┌────────────────────────────────────────────────────┐
│  S3 ObjectCreated Event                            │
│       ↓                                            │
│  ┌──────────────────────────┐                     │
│  │ batch-counter Lambda     │                     │
│  │ - Count pending images   │                     │
│  │ - if count >= threshold  │  (100-500)          │
│  │   → invoke orchestrator  │                     │
│  └──────────────┬───────────┘                     │
│                 ▼                                  │
│  ┌──────────────────────────┐                     │
│  │ batch-orchestrator       │                     │
│  │ - Prepare manifest.jsonl │  (>= 100 records)   │
│  │ - CreateModelInvocationJob│                    │
│  └──────────────┬───────────┘                     │
│                 ▼                                  │
│  ┌──────────────────────────┐                     │
│  │ Bedrock Batch Inference  │  50% discount       │
│  └──────────────┬───────────┘                     │
│                 ▼                                  │
│  ┌──────────────────────────┐                     │
│  │ batch-result-handler     │                     │
│  │ - Parse batch output     │                     │
│  │ - Write transactions     │                     │
│  │ - Move to processed/     │                     │
│  └──────────────────────────┘                     │
│                                                    │
│  ⏱️ Latency: Hours (accumulation + processing)     │
│  💰 Cost: 50% of On-Demand                         │
└────────────────────────────────────────────────────┘
```

### Hybrid Mode (Archived)

**Smart switching logic**:
```typescript
if (pendingImageCount >= 100) {
  // Use Batch Inference (50% discount)
  await createBatchJob(pendingImages);
} else if (timeElapsed > timeoutMinutes) {
  // Timeout fallback: Process remaining images with On-Demand
  for (const image of pendingImages) {
    await processInstant(image);
  }
}
```

**Triggers**:
1. **Image count trigger**: S3 ObjectCreated → batch-counter checks count
2. **Timeout trigger**: EventBridge cron (configurable interval) → batch-counter checks elapsed time

**Example scenario**:
- User uploads 80 images throughout the day
- Timeout set to 2 hours (120 minutes)
- At 02:00 JST (timeout), only 80 images pending
- Hybrid mode processes all 80 with On-Demand (fallback)
- **Benefit**: Guaranteed morning report, no data loss

---

## Admin Configuration

### Control Table Schema

```typescript
{
  configId: 'batch_config',
  processingMode: 'instant' | 'batch' | 'hybrid',
  imageThreshold: number,      // 100-500 (Batch/Hybrid only)
  timeoutMinutes: number,       // 30-480 (Hybrid only)
  modelId: string,              // e.g., 'us.amazon.nova-lite-v1:0'
  updatedAt: string
}
```

### Mode-Specific Settings

| Mode | imageThreshold | timeoutMinutes | Notes |
|------|----------------|----------------|-------|
| `instant` | ❌ Not used | ❌ Not used | Process immediately |
| `batch` | ✅ Required (>= 100) | ❌ Not used | Wait for threshold |
| `hybrid` | ✅ Required (>= 100) | ✅ Required | Threshold or timeout |

---

## Implementation Details

### Removed Files (2026-01-17)

```
infra/lambda/batch-process/
└── index.mjs                 # Batch processor Lambda (~350 lines)

infra/lib/yorutsuke-stack.ts
├── batchProcessLambda        # Lambda function construct
└── batchRule                 # EventBridge cron rule
```

### Key Code Patterns (Preserved)

**Multi-image processing loop**:
```javascript
for (const image of images) {
  const result = await processImage(image, ocrPrompt);

  if (result.success) {
    results.processed++;
  } else {
    results.failed++;
    results.errors.push({ key: result.key, error: result.error });
  }

  // Safety: Exit before Lambda timeout
  if (Date.now() - startTime > 4 * 60 * 1000) {
    logger.warn('BATCH_TIMEOUT_APPROACHING');
    break;
  }
}
```

**Merchant list caching** (performance optimization):
```javascript
let cachedMerchantList = null;

async function loadMerchantList() {
  if (cachedMerchantList) {
    return cachedMerchantList; // Reuse across invocations
  }

  const response = await s3.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: 'merchants/common-merchants.json',
  }));

  cachedMerchantList = JSON.parse(await response.Body.transformToString());
  return cachedMerchantList;
}
```

**OCR prompt (business-focused categories)**:
```javascript
function buildOCRPrompt(merchantList) {
  return `レシート解析AIです。以下の情報を抽出してJSON形式で返してください。

必須フィールド:
- amount: 金額（数値、円単位）
- type: "income" または "expense"
- date: 日付（YYYY-MM-DD形式）
- merchant: 店舗名または取引先名
- category: カテゴリ（以下から选择）
  - sale: 売上
  - purchase: 仕入れ
  - shipping: 送料
  - packaging: 梱包材
  - fee: 手数料
  - other: その他
- description: 取引の説明

既知の店舗リスト: ${merchantList.join(', ')}

JSON形式で返してください。マークダウンのコードブロックは使わないでください。`;
}
```

---

## Multi-Model Comparison (Also Archived)

### Background

Batch processor included **MultiModelAnalyzer** for A/B testing:
- Textract (AWS document analysis)
- Nova Mini (fast, low-cost)
- Nova Pro (high accuracy)
- Claude Sonnet (best quality)

**Purpose**: Compare accuracy across models to choose the best primary model.

### Why Removed

1. **Issue #146**: Simplified to single-model approach
2. **Complexity**: ~200 lines of comparison logic unused in production
3. **Cost**: Running 4 models in parallel = 4x processing cost
4. **Decision made**: Nova Lite is sufficient for MVP

### Code Location (Archived)

- `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs` (may still exist for instant-processor)
- Used in batch-process/index.mjs lines 7, 12, 196-212

**Note**: Issue #146 will remove this from instant-processor as well.

---

## Testing Scenarios

### Batch Mode Tests (Not Implemented)

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| SB-201 | Upload 100 images | Batch job triggered | Not tested (removed) |
| SB-202 | Upload 50 images | No batch job (wait) | Not tested (removed) |
| SB-203 | Hybrid: 100+ images | Use Batch (50% off) | Not tested (removed) |
| SB-204 | Hybrid: Timeout | Use On-Demand fallback | Not tested (removed) |
| SB-205 | Config read | Lambda reads processingMode | ✅ Verified with Instant |
| SB-206 | Mode switch | Admin changes mode, next processing uses new mode | Not tested (removed) |
| SB-207 | Threshold validation | Setting < 100 returns 400 error | Not tested (removed) |

---

## Deployment Commands (Archived)

**Deploy batch stack** (no longer needed):
```bash
cd infra
cdk deploy --all --profile dev

# Manually trigger batch process (testing)
aws lambda invoke \
  --function-name yorutsuke-batch-process-us-dev \
  --profile dev \
  /tmp/out.json
```

**Check batch processing logs** (if re-implemented):
```bash
aws logs tail /aws/lambda/yorutsuke-batch-process-us-dev --follow --profile dev
```

---

## Re-Implementation Checklist

If batch mode is needed in the future:

### Prerequisites
- [ ] Daily image uploads consistently > 100/day
- [ ] Cost analysis shows meaningful savings (> ¥1000/month)
- [ ] Users accept delayed processing (hours vs. seconds)

### Implementation Steps
1. [ ] **Restore Lambda code** - Reference this doc + git history
2. [ ] **Add CDK resources** - BatchProcessLambda + EventBridge cron
3. [ ] **Update Admin Panel** - Enable batch config UI (already exists, just disabled)
4. [ ] **Test with 100+ images** - Verify AWS Batch Inference API
5. [ ] **Monitor cost savings** - Compare before/after
6. [ ] **Update documentation** - Move from archive to active docs

### Design Decisions to Revisit
- [ ] Should we use MultiModelAnalyzer again, or stick with single model?
- [ ] Optimal threshold (100 vs. 200 vs. 500)?
- [ ] Hybrid timeout value (2h vs. 6h vs. 12h)?
- [ ] Admin Panel: Should processingMode be global or per-user?

---

## Related Issues

- **Issue #146**: Simplify transaction model (remove multi-model comparison)
- **Issue #147**: Remove batch processing code (this archive)
- **MVP3_BATCH.md**: Original batch processing design (archived)

---

## References

- **AWS Bedrock Batch Inference**: https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html
- **Minimum 100 records**: Official AWS documentation
- **50% discount**: AWS pricing page (Bedrock On-Demand vs. Batch)
- **Git history**: See commit before Issue #147 for full code

---

**Document Version**: 1.0
**Last Updated**: 2026-01-17
**Archived By**: Issue #147
**Review Recommended**: When daily uploads exceed 100 images/day
