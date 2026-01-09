# Session Tasks

Source of truth: GitHub Issues. This file tracks session breakdown.

## Current Issue: #98 COMPLETED ✅

### Completed: #98 - batch-orchestrator Lambda

**Completion Time**: 2026-01-09 (~1.5 hours)

**What was done**:
1. Created batch-orchestrator Lambda (293 lines)
2. Implemented manifest.jsonl generation from pending images
3. Integrated Bedrock CreateModelInvocationJob API
4. Added DynamoDB batch-jobs table for job tracking
5. Implemented error handling + Zod validation
6. Updated CDK stack with Lambda + IAM permissions
7. Verified TypeScript compilation

**Files created**:
- `infra/lambda/batch-orchestrator/index.mjs`
- `.claude/batch-orchestrator-COMPLETED.md` (implementation summary)

**Files modified**:
- `infra/lib/yorutsuke-stack.ts` (+ Lambda definition + IAM + DynamoDB table)

**Next Issue**: #99 - batch-result-handler Lambda

---

Last completed: #102 - Admin Panel Batch Settings
Last completed: #101 - Admin Config API
Last completed: #97 - instant-processor Lambda

| Version | Phase | Status |
|---------|-------|--------|
| v0.1.0 | Phase 0-3 | ✅ Complete |
| v1.0.0 | Phase 4 (Backend) | ✅ Complete |
| MVP1 | Local Only | ✅ Verified 2026-01-07 |
| MVP2 | Cloud Upload | ✅ Verified 2026-01-08 |
| MVP3 | Hybrid Batch | 🔄 Active (#98 ✅, #99 next) |

## Backlog

### Deferred
- [ ] 系统托盘: Tauri tray plugin (复杂度高)
- [ ] 批量确认: 等 v1 验证用户行为模式
- [ ] Cloud Sync: 依赖后端 API 完成

## Recently Completed

- MVP3 Multi-Mode 架构文档更新 (2026-01-08)
  - 三种处理模式: Instant/Batch/Hybrid
  - imageThreshold 范围改为 100-500 (AWS 要求)
  - MVP3 默认 Instant 模式
- #96 MVP3 文档更新阶段完成 (2026-01-08)
- MVP3 Issue 创建 + 文档规格更新 (2026-01-08)
- #101 Presigned URL 真实集成 + SC-300~303 通过 (2026-01-08)
- Queue 3-column layout fix + MVP1 verified (2026-01-07)
- #87 CSS Design System Consolidation (2026-01-07)
- #85 File picker implementation (2026-01-07)
- #78 Logging system optimization (2026-01-05)
- #50 Guest data claim on registration (2026-01-04)

---
*Full history: `.claude/archive/2026-01-TODO-archive.md`*
