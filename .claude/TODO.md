# Session Tasks

Source of truth: GitHub Issues. This file tracks session breakdown.

## Current Focus

None - ready for `*issue pick <n>`

## Phase 0: Core Kernel ✅

| Issue | Title | Status |
|-------|-------|--------|
| #1 | EventBus | ✅ Complete |
| #2 | SQLite + Migrations | ✅ Complete |
| #3 | Network Status | ✅ Complete |

## Phase 1: Capture Pipeline

| Issue | Title | Status |
|-------|-------|--------|
| #4 | Tauri Drag & Drop | ✅ Complete |
| #5 | Image Compression | 🟡 Ready |
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
- #4 Tauri Drag & Drop verified (2025-12-29)
- #3 Network Status implemented (2025-12-29)
- #2 SQLite + Migrations implemented (2025-12-29)
- #1 EventBus implemented (2025-12-29)
- Created ROADMAP.md (2025-12-28)
- Created GitHub Issues #1-#7 (2025-12-28)
