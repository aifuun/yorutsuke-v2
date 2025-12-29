# Session Tasks

Source of truth: GitHub Issues. This file tracks session breakdown.

## Current Focus: v1.0.0 Complete

Status: ✅ PRODUCTION READY

All phases and issues completed. Next focus: Backlog items.

## Milestones

| Version | Phase | Content | Status |
|---------|-------|---------|--------|
| v0.1.0 | Phase 0 | Core Kernel | ✅ Complete |
| v0.2.0 | Phase 1 | Capture Pipeline | ✅ Complete |
| v0.3.0 | Phase 2 | User Features | ✅ Complete |
| v1.0.0 | Phase 3 | Polish + Production | ✅ Complete |

## Phase 0: Core Kernel ✅

| Issue | Title | Status |
|-------|-------|--------|
| #1 | EventBus | ✅ Complete |
| #2 | SQLite + Migrations | ✅ Complete |
| #3 | Network Status | ✅ Complete |

## Phase 1: Capture Pipeline ✅

| Issue | Title | Status |
|-------|-------|--------|
| #4 | Tauri Drag & Drop | ✅ Complete |
| #5 | Image Compression | ✅ Complete |
| #6 | Upload Queue | ✅ Complete |
| #7 | Auth (Cognito) | ✅ Complete |

## Phase 2: User Features ✅

| Issue | Title | Status |
|-------|-------|--------|
| #8 | Report Views | ✅ Complete |
| #9 | Transaction Management | ✅ Complete |
| #10 | Settings Module | ✅ Complete |

## Phase 3: Polish ✅

| Issue | Title | Status |
|-------|-------|--------|
| #11 | i18n | ✅ Complete |
| #12 | Error Recovery | ✅ Complete |

## Phase 4: Backend APIs 🚧

| Issue | Title | Status |
|-------|-------|--------|
| #15 | batch-process Lambda (Nova Lite OCR) | ⏳ Pending |
| #16 | report Lambda (报告 API) | ⏳ Pending |
| #17 | transactions Lambda (CRUD API) | ⏳ Pending |
| #18 | config Lambda (配置 API) | ⏳ Pending |
| #19 | quota Lambda (配额检查 API) | ✅ Complete |

## Backlog

Small tasks not worth an issue:

- [x] Setup ESLint rules for Pillar compliance
- [x] CaptureView: 显示"等待处理"计数 (awaitingProcessCount)

### Design Improvements (DESIGN.md)

**P1 - High Priority**:
- [x] S03 右键菜单删除: Context Menu 已实现
- [x] 空状态设计: EmptyState 组件 (first-use, no-data-today, no-results)

**P2 - Medium Priority**:
- [x] 断网状态反馈: Offline Indicator 已实现

**P3 - Low Priority**:
- [ ] 系统托盘: 需要 Tauri tray plugin，复杂度高，暂缓

**Deferred**:
- [ ] 批量确认: "Batch Confirm" 功能 - 等 v1 验证用户行为模式后再决定是否添加（风险：可能导致误确认 OCR 错误）
- [ ] Cloud Sync: 依赖后端 API

## Recently Completed

<!-- Format: Task (date) -->
- #19 quota Lambda completed (2025-12-29)
- Backend Lambda issues created #15-#19 (2025-12-29)
- Backlog tasks completed (2025-12-29)
  - ESLint rules for Pillar compliance
  - CaptureView awaiting process count
  - Context Menu for transactions (P1)
  - Offline Indicator (P2)
- Empty States design completed (2025-12-29)
- #14 Report History completed (2025-12-29)
- #13 Transaction Filters completed (2025-12-29)
- v1.0.0 Production Ready tagged (2025-12-29)
- #12 Error Recovery completed (2025-12-29)
- #11 i18n completed (2025-12-29)
- #10 Settings Module completed (2025-12-29)
- #9 Transaction Management completed (2025-12-29)
- #8 Report Views completed (2025-12-29)
- #7 Auth Module completed (2025-12-29)
- #6 Upload Queue completed (2025-12-29)
- #5 Image Compression completed (2025-12-29)
- #4 Tauri Drag & Drop completed (2025-12-29)
- #3 Network Status completed (2025-12-29)
- #2 SQLite + Migrations completed (2025-12-29)
- #1 EventBus completed (2025-12-29)
