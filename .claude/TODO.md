# Session Tasks

Source of truth: GitHub Issues. This file tracks session breakdown.

## Current Issue: #101 - Presigned URL 真实集成 [MVP2]

**关联 MVP**: MVP2 - 云端上传验证
**优先级**: P1
**预估**: T2 (中等)
**开始时间**: 2026-01-07

### 子任务进度
- [x] 配置环境变量 `VITE_LAMBDA_PRESIGN_URL`
- [x] 移除 Mock 逻辑，保留离线检测
- [x] 实现真实 fetch 调用 (修复: 使用 @tauri-apps/plugin-http)
- [x] 添加 Zod 响应验证
- [x] 实现错误分类与重试逻辑
- [x] 测试 SC-300~303 场景 ✅ 2026-01-08

## Milestones

| Version | Phase | Status |
|---------|-------|--------|
| v0.1.0 | Phase 0-3 | ✅ Complete |
| v1.0.0 | Phase 4 (Backend) | ✅ Complete |
| MVP1 | Local Only | ✅ Verified 2026-01-07 |
| MVP2 | Cloud Upload | 🔄 In Progress |

## Backlog

### Deferred
- [ ] 系统托盘: Tauri tray plugin (复杂度高)
- [ ] 批量确认: 等 v1 验证用户行为模式
- [ ] Cloud Sync: 依赖后端 API 完成

## Recently Completed

- Queue 3-column layout fix + MVP1 verified (2026-01-07)
- #87 CSS Design System Consolidation (2026-01-07)
- #85 File picker implementation (2026-01-07)
- #78 Logging system optimization (2026-01-05)
- #50 Guest data claim on registration (2026-01-04)

---
*Full history: `.claude/archive/2026-01-TODO-archive.md`*
