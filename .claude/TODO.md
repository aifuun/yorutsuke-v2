# Session Tasks

Source of truth: GitHub Issues. This file tracks session breakdown.

## Current Focus: #5 - Image Compression (02_modules/capture)

Status: 🔄 IN PROGRESS

**Tier**: T2 (Logic)
**Pillars**: A, B, D, G, L, R

### Tasks
- [ ] Rust: 实现 `compress_image` 命令 (WebP 压缩)
- [ ] Rust: 实现 `get_image_hash` 命令 (MD5)
- [ ] TS: 完善 `adapters/imageIpc.ts` (超时、错误处理)
- [ ] TS: 创建 `headless/useImageProcessor.ts`
- [ ] TS: 集成到 capture 流程
- [ ] 验证 TypeScript 编译

## Milestones

| Version | Phase | Content | Status |
|---------|-------|---------|--------|
| v0.1.0 | Phase 0 | Core Kernel | ✅ Complete |
| v0.2.0 | Phase 1 | Capture Pipeline | 🟡 In Progress |
| v0.3.0 | Phase 2 | User Features | ⚪ Not Started |
| v1.0.0 | Phase 3 | Polish + Production | ⚪ Not Started |

## Phase 0: Core Kernel ✅ `v0.1.0`

| Issue | Title | Status |
|-------|-------|--------|
| #1 | EventBus | ✅ Complete |
| #2 | SQLite + Migrations | ✅ Complete |
| #3 | Network Status | ✅ Complete |

## Phase 1: Capture Pipeline `v0.2.0`

| Issue | Title | Status |
|-------|-------|--------|
| #4 | Tauri Drag & Drop | ✅ Complete |
| #5 | Image Compression | ✅ Complete |
| #6 | Upload Queue | 🟡 Ready (deps: #3 ✅) |
| #7 | Auth (Cognito) | 🟡 Ready |

## Backlog

Small tasks not worth an issue:

- [ ] Setup ESLint rules for Pillar compliance
- [ ] batch-process Lambda: 添加 `ConditionExpression: 'attribute_not_exists(id)'` 幂等检查 (Pillar Q)
- [ ] CaptureView: 显示"等待处理"计数 (已上传但未处理的图片数)

### Design Improvements (DESIGN.md)

**P1 - High Priority**:
- [ ] S03 右键菜单删除: Transactions 页面增加右键菜单支持 (Context Menu)，同时保留 swipe 作为触控板快捷方式
- [ ] 空状态设计: 定义 Dashboard/Report 的 Empty States 规范（首次使用、当日无数据场景）

**P2 - Medium Priority**:
- [ ] 断网状态反馈: Upload Queue 增加 `Offline` 状态指示器（"等待连接"图标），扩展现有 Status Indicators

**P3 - Low Priority**:
- [ ] 系统托盘: 将 Sync 状态移至系统托盘区，保持主界面简洁（Settings 保留在 UI 供用户查看 quota）

**Deferred**:
- [ ] 批量确认: "Batch Confirm" 功能 - 等 v1 验证用户行为模式后再决定是否添加（风险：可能导致误确认 OCR 错误）

## Recently Completed

<!-- Format: Task (date) -->
- #5 Image Compression completed (2025-12-29)
- #4 Tauri Drag & Drop verified (2025-12-29)
- #3 Network Status implemented (2025-12-29)
- #2 SQLite + Migrations implemented (2025-12-29)
- #1 EventBus implemented (2025-12-29)
- Created ROADMAP.md (2025-12-28)
- Created GitHub Issues #1-#7 (2025-12-28)
