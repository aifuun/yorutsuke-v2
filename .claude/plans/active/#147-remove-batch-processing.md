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
- [ ] MultiModelAnalyzer is still used by instant-processor (will be removed in Issue #146)

### Phase 3: Verification
- [x] Verify CDK diff shows clean removal
- [x] Admin batch endpoint returns "disabled" message gracefully
- [ ] Commit changes
- [ ] Update GitHub issue

## Keep (Do NOT Remove)
- Admin panel batch config UI (future use)
- Control table schema (processingMode field)
- Instant-processor Lambda (currently active)

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
