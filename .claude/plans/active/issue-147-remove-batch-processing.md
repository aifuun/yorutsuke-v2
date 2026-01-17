# Issue #147: Remove Batch Processing Code and Archive Documentation

**Status**: Planning (awaiting approval)
**Created**: 2026-01-17
**GitHub**: https://github.com/aifuun/yorutsuke-v2/issues/147

---

## Executive Summary

**Current State:**
- Project uses **Instant mode only** (confirmed in DynamoDB control table)
- `batch-process` Lambda exists but is **unused** and incompatible with Issue #146's simplified transaction model
- `MultiModelAnalyzer` is used by `batch-process` for testing 4 models in parallel (Textract, Nova Mini, Nova Pro, Claude Sonnet)
- Admin Panel UI and control table schema exist for future batch mode implementation
- EventBridge cron rule triggers batch-process daily (disabled in dev, enabled in prod)

**Goal:**
- Remove unused batch-process Lambda infrastructure
- Consolidate all batch knowledge into comprehensive documentation archive
- Preserve Admin Panel UI and control table (for future Batch/Hybrid modes)
- Ensure instant-processor continues working without disruption

**Estimated Time**: 4-6 hours

---

## Phase 1: Documentation Consolidation (2-3 hours)

### 1.1 Create Archive Document

**File**: `docs/archive/BATCH_PROCESSING_ARCHIVE.md`

**Content** (Complete reference for future implementation):
- Multi-model comparison system architecture
- Batch processing flow diagrams
- AWS Batch Inference constraints (100 image minimum, 50% discount)
- Complete code from batch-process/index.mjs with annotations
- Complete code from model-analyzer.mjs with usage notes
- Configuration schemas (batch_config, modelComparison)
- Admin Panel integration details
- Cost analysis (Instant vs Batch vs Hybrid)
- Migration notes (why removed, when to re-implement)
- Re-implementation checklist

### 1.2 Update Existing Documentation

**Files to update**:
1. `docs/dev/MVP3_BATCH.md` - Add deprecation notice at top
2. `docs/operations/ADMIN_PANEL.md` - Mark Batch/Hybrid as "(Future)"
3. `docs/architecture/SCHEMA.md` - Mark `modelComparison` field as archived

---

## Phase 2: Code Removal (1-2 hours)

### 2.1 CDK Stack Changes

**File**: `infra/lib/yorutsuke-stack.ts`

**Remove** (lines 282-503):
- ❌ `BatchProcessLambda` function definition
- ❌ `batch-orchestrator` Lambda
- ❌ `batch-result-handler` Lambda
- ❌ `BatchProcessRule` EventBridge cron
- ❌ S3 event notification for batch-output/ prefix
- ❌ IAM permissions for batch Lambdas

**Keep**:
- ✅ Control table (used by Admin Panel)
- ✅ instant-processor Lambda
- ✅ Inference Profile ARNs (used by instant-processor)
- ✅ Admin Panel batch config UI

### 2.2 Lambda Directory Removal

**Delete directories**:
- `infra/lambda/batch-process/`
- `infra/lambda/batch-orchestrator/`
- `infra/lambda/batch-result-handler/`
- `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs`

**Verification**: Confirmed instant-processor doesn't use MultiModelAnalyzer

### 2.3 Admin Panel Changes

**No code changes required** - UI preserved for future use

---

## Phase 3: Verification (1 hour)

### 3.1 Pre-Deployment

```bash
cd infra
npm run cdk -- diff --profile dev

# Expected removals:
# - Lambda: batch-process, batch-orchestrator, batch-result-handler
# - EventBridge Rule: batch-process
# - S3 Event: batch-output/ prefix
```

### 3.2 Post-Deployment

```bash
# 1. Verify Lambda removal
aws lambda list-functions --profile dev | grep batch
# Expected: No batch-related Lambdas

# 2. Verify control table still exists
aws dynamodb scan --table-name yorutsuke-control-dev --profile dev

# 3. Test instant-processor
# - Upload test receipt in app
# - Check CloudWatch logs for IMAGE_PROCESSING_COMPLETED
# - Verify transaction created in DynamoDB
```

### 3.3 Rollback Plan

```bash
# If instant mode breaks:
cd infra
cdk deploy --profile dev --rollback

# Or revert Git commit:
git revert HEAD
git push origin development
cdk deploy --profile dev
```

---

## Risk Assessment

### Medium Risk
1. **CDK Stack Removal**
   - Risk: Accidentally remove instant-processor dependencies
   - Mitigation: Careful review, keep Inference Profile ARNs
   - Detection: CDK diff shows unintended removals

2. **S3 Event Notification Conflict**
   - Risk: Removing batch-output/ affects uploads/ notification
   - Mitigation: CDK handles prefixes separately
   - Detection: instant-processor not triggering

### Low Risk
- Documentation reference breaks
- Admin Panel UI confusion (users try to enable Batch mode)

---

## Success Criteria

### Documentation
- [ ] `BATCH_PROCESSING_ARCHIVE.md` contains complete batch knowledge
- [ ] All code, flows, schemas documented for future re-implementation
- [ ] MVP3_BATCH.md has deprecation notice + archive link
- [ ] ADMIN_PANEL.md updated with "(Future)" labels
- [ ] SCHEMA.md marks `modelComparison` as archived feature

### Infrastructure
- [ ] batch-process Lambda removed from CDK stack
- [ ] batch-orchestrator Lambda removed
- [ ] batch-result-handler Lambda removed
- [ ] EventBridge cron rule removed
- [ ] S3 event notification for batch-output/ removed
- [ ] instant-processor remains functional
- [ ] Control table preserved (batch_config accessible)

### Verification
- [ ] CDK diff shows only expected removals
- [ ] CDK deploy succeeds without errors
- [ ] instant-processor triggers on S3 uploads/ events
- [ ] Test image uploads and processes successfully
- [ ] Transaction created with status='unconfirmed'
- [ ] No modelComparison field in new transactions
- [ ] CloudWatch Logs show IMAGE_PROCESSING_COMPLETED events
- [ ] Admin Panel still accessible (no code changes)

---

## Critical Files

1. **`infra/lib/yorutsuke-stack.ts`** - CDK stack changes (lines 282-503)
2. **`infra/lambda/batch-process/index.mjs`** - Code to archive before deletion
3. **`infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs`** - Multi-model logic
4. **`docs/dev/MVP3_BATCH.md`** - Update with deprecation notice
5. **`docs/architecture/SCHEMA.md`** - Mark modelComparison as archived

---

## Dependencies

- Phase 1 must complete before Phase 2 (preserve knowledge first)
- Phase 3 follows Phase 2 (verification after deployment)

---

**Next Step**: Awaiting user approval to proceed with implementation
