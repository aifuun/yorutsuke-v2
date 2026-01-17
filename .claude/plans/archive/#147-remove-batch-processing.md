# Issue #147: Remove Batch Processing Code, Archive Documentation

## Context

Currently using **Instant mode** only. Batch processing Lambda exists but is unused and adds maintenance burden. This task removes the code while preserving knowledge for future implementation.

## Plan

### Phase 1: Documentation (Archive Knowledge)
- [x] Read existing batch documentation (MVP3_BATCH.md, ADMIN_PANEL.md)
- [x] Read batch-process Lambda code to understand implementation
- [x] Create consolidated documentation in `docs/archive/BATCH_PROCESSING.md`
  - AWS Batch Inference requirements (100 image minimum, 50% discount)
  - Processing mode comparison table
  - Implementation notes from Lambda
  - Design decisions and trade-offs

### Phase 2: Code Removal
- [x] Remove `infra/lambda/batch-process/` folder
- [x] Remove BatchProcessLambda from CDK stack (`infra/lib/yorutsuke-stack.ts`)
- [x] Remove BatchProcessRule EventBridge cron from CDK
- [x] Remove BatchErrorAlarm and BatchInvocationAlarm CloudWatch alarms
- [x] Update admin stack to remove batchProcessLambdaName parameter
- [x] Update admin/batch Lambda to handle disabled mode gracefully
- [x] **Complete removal** of admin/batch and admin/batch-config Lambdas (Option A)
- [x] Move modelId from DynamoDB to environment variable
- [ ] MultiModelAnalyzer is still used by instant-processor (will be removed in Issue #146)

### Phase 3: Verification
- [x] Verify CDK diff shows clean removal
- [x] Both main and admin stacks show expected changes
- [x] Commit changes (2 commits)
- [x] Update GitHub PR (#148)
- [x] Push to remote

## Completion Summary

### Total Deletions
- **7 AWS resources** in main stack (BatchProcessLambda, EventBridge rule, CloudWatch alarms, etc.)
- **2 admin Lambdas** (batch status + batch config)
- **4 API endpoints** (/batch GET/POST, /batch/config GET/POST)
- **~700 lines of code** removed total

### Commits
1. `3d44143` - Initial batch-process Lambda removal + documentation archive
2. `a5e30e5` - Admin endpoints removal + modelId to environment variable

### Architecture Changes
**Before**: DynamoDB control table → instant-processor reads modelId dynamically
**After**: Environment variable MODEL_ID → instant-processor uses fixed value

### Benefits
- ✅ Simpler configuration management
- ✅ Fewer runtime dependencies (no control table read)
- ✅ Easier to change model (CDK redeploy vs. admin API call)
- ✅ Complete batch processing removal (no dead code)

### Future Re-implementation Path
All knowledge preserved in `docs/archive/BATCH_PROCESSING.md` including:
- AWS Batch Inference requirements and cost savings
- Implementation patterns and code examples
- When to reconsider (>100 images/day)

## Keep (Do NOT Remove)
- Control table (for future features like emergency stop)
- Instant-processor Lambda (currently active)
- Batch-orchestrator and batch-result-handler (for future batch mode)

## Files to Create/Modify

**Create:**
- `docs/archive/BATCH_PROCESSING.md` - Consolidated batch mode knowledge

**Modify:**
- `infra/lib/yorutsuke-stack.ts` - Remove BatchProcessLambda and cron rule
- `docs/product/ADMIN_PANEL.md` - Note batch UI is for future use

**Delete:**
- `infra/lambda/batch-process/` - Entire folder

## Success Criteria
- [ ] All batch processing code removed from infra
- [ ] Knowledge preserved in docs/archive/
- [ ] CDK diff shows clean removal (no batch Lambda or cron)
- [ ] Admin panel still compiles
- [ ] Related to #146 (single model approach)
