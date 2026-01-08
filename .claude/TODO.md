# Session Tasks

Source of truth: GitHub Issues. This file tracks session breakdown.

## Current Issue: #97 - instant-processor Lambda [MVP3]

**关联 MVP**: MVP3 - 批处理混合触发 (Instant 模式)
**优先级**: P1
**预估**: T2 (中等)
**开始时间**: 2026-01-08

### 子任务进度
- [x] 创建 `infra/lambda/instant-processor/index.ts` 基础框架 ✅
- [x] 实现 Bedrock (Nova Lite/Haiku) OCR 解析逻辑 ✅
- [x] 实现 DynamoDB 交易记录写入 (Schema 符合 Pillar A) ✅
- [x] 配置 S3 ObjectCreated 触发器 (CDK 更新) ✅
- [x] 处理幂等性 (使用从 S3 路径提取的 ImageId) ✅
- [x] 验证端到端流程 (S3 -> AI -> DB) ✅

Last completed: #97 - instant-processor Lambda

| Version | Phase | Status |
|---------|-------|--------|
| v0.1.0 | Phase 0-3 | ✅ Complete |
| v1.0.0 | Phase 4 (Backend) | ✅ Complete |
| MVP1 | Local Only | ✅ Verified 2026-01-07 |
| MVP2 | Cloud Upload | ✅ Verified 2026-01-08 |
| MVP3 | Hybrid Batch | 🔄 Active |

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
