# Session Tasks

Source of truth: GitHub Issues. This file tracks session breakdown.

## Current Issue: #78 - Logging System Optimization

**Tier**: T2 (Tauri IPC + File System)
**Pillars**: R (Observability), N (Context), G (Traceability)

### Steps
- [x] Create `docs/LOGGING.md` design document
- [x] Implement Tauri `log_write` command
- [x] Implement log file rotation (7 days)
- [x] Integrate `logger.ts` with Tauri IPC
- [x] Add missing EVENTS constants
- [x] Fix inconsistent log calls in kernel files

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

## Phase 4: Backend APIs ✅

| Issue | Title | Status |
|-------|-------|--------|
| #15 | batch-process Lambda (Nova Lite OCR) | ✅ Complete |
| #16 | report Lambda (报告 API) | ✅ Complete |
| #17 | transactions Lambda (CRUD API) | ✅ Complete |
| #18 | config Lambda (配置 API) | ✅ Complete |
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

### Control Strategy Improvements (ARCHITECTURE.md)

Now tracked as GitHub Issues:

**P1 - Data Integrity**:
- [x] #24 Add `withTransaction()` wrapper to db.ts ✅
- [x] #25 Remove `processingRef`, use FSM `currentId` instead ✅

**P2 - Reliability**:
- [x] #27 Single quota checkpoint (documented as multi-layer defense) ✅
- [x] #26 Rename `emitSync` to `broadcast` (clarify semantics) ✅

**P3 - Robustness**: ✅ Complete
- [x] #28 Add Intent-ID for idempotency (Pillar Q) ✅
- [x] #29 ~~EventBus request-response~~ (关闭: 过度设计)

### Documentation Fixes

- [x] #20 DESIGN.md - App Shell sidebar design ✅
- [x] #21 CHANGELOG.md - Version history ✅
- [x] #22 REQUIREMENTS.md - Acceptance criteria ✅
- [x] #23 Update document dates ✅

**Deferred**:
- [ ] 批量确认: "Batch Confirm" 功能 - 等 v1 验证用户行为模式后再决定是否添加（风险：可能导致误确认 OCR 错误）
- [ ] Cloud Sync: 依赖后端 API

## Recently Completed

<!-- Format: Task (date) -->
- #50 Guest data claim on registration (2026-01-04)
- #51 Auto-refresh quota after tier change (2026-01-04)
- #28 Intent-ID for idempotency (Pillar Q) (2026-01-02)
- #20 DESIGN.md sidebar design (2026-01-02)
- #21 CHANGELOG.md version history (2026-01-02)
- #22 REQUIREMENTS.md acceptance criteria (2026-01-02)
- #23 Document dates updated (2026-01-02)
- #15 batch-process Lambda completed (2025-12-29)
- #16 report Lambda completed (2025-12-29)
- #17 transactions Lambda completed (2025-12-29)
- #18 config Lambda completed (2025-12-29)
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
