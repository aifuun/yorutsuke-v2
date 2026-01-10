# Session Tasks

Source of truth: GitHub Issues. This file tracks session breakdown.

## Current Session

### Completed Issue: #109 [Transaction Management UX Improvements] ✅

**完成时间**: 2026-01-10
**状态**: 已完成 | Type: T2 (Logic/State) | MVP4

**完成内容**:
- [x] Phase 1: Image Preview & Lightbox
  - imageService.ts: 图片 URL 解析（local > S3 > missing）
  - ImageLightbox.tsx: 全屏查看 + ESC/点击外部关闭
  - TransactionCard: 48x48 缩略图 + 点击打开 lightbox
  - Lightbox 内置确认按钮
- [x] Phase 2: Sorting & Pagination
  - transactionDb.ts: 扩展 fetchTransactions 支持 sortBy/sortOrder/limit/offset
  - countTransactions(): 分页总数查询
  - Pagination.tsx: 分页组件（20条/页）
  - TransactionView: 排序控制（Invoice Date / Processing Time）
- [x] Phase 3: Soft Delete & Sync
  - Migration v8: 添加 dirty_sync 列（INTEGER DEFAULT 0）
  - deleteTransaction(): 软删除（status='deleted', dirty_sync=1）
  - confirmTransaction(): 标记 dirty_sync=1
  - fetchTransactions/countTransactions: 过滤 deleted 状态
- [x] Phase 4: Documentation
  - SCHEMA.md: 更新 transactions 表 schema（v8 变更）
- [x] 所有 55 个测试通过
- [x] 手动测试指南已提供（/tmp/test-109.md）

**关键技术决策**:
- Soft delete over hard delete: 离线支持、审计跟踪、撤销能力
- SQL LIMIT/OFFSET 分页: 性能优化（O(n) → O(20)）
- Local file priority: 速度、离线、成本
- dirty_sync flag: MVP4→MVP5 过渡准备
- S3 presigned GET URL: 延迟到 MVP5

**下一步**: Issue #109 已完成，可执行 `*next` 或关闭 Issue

---

### Deferred Issue: #104 [MVP3: End-to-end batch testing]

**状态**: Frontend 测试未完成
- Frontend 测试 (SC-304~307, 800~821, 900~934) remaining
- Can resume later after #108

---

## Progress Summary

| Version | Phase | Status |
|---------|-------|--------|
| v0.1.0 | Phase 0-3 | ✅ Complete |
| v1.0.0 | Phase 4 (Backend) | ✅ Complete |
| MVP1 | Local Only | ✅ Verified 2026-01-07 |
| MVP2 | Cloud Upload | ✅ Verified 2026-01-08 |
| MVP3 | Hybrid Batch | 🔄 In Progress |

### MVP3 Completed Issues
- #97 instant-processor Lambda
- #98 batch-orchestrator Lambda + Pillar Review
- #99 batch-result-handler Lambda
- #101 Admin Config API
- #102 Admin Panel Batch Settings

### Next Steps
- #99 verification and integration testing
- MVP3 end-to-end verification

## Backlog

### Deferred
- [ ] 系统托盘: Tauri tray plugin (复杂度高)
- [ ] 批量确认: 等 v1 验证用户行为模式
- [ ] Cloud Sync: 依赖后端 API 完成

## Recently Completed

- **#109** Transaction Management UX Improvements (2026-01-10)
  - Image preview, lightbox, sorting, pagination, soft delete
  - Migration v8: dirty_sync column
  - All 55 tests passing
- **#108** Cloud Sync for Transactions (2026-01-09)
  - Pull-only sync architecture
  - Migration v6/v7: status/version, remove FK constraint
  - Conflict resolution with 4-rule strategy
- Workflow documentation restructure (2026-01-09)
  - Two-Step Planning structure
  - Template organization
  - INBOX.md → QUICK-NOTES.md rename
- MVP3 Multi-Mode architecture docs (2026-01-08)
- #101 Presigned URL integration (2026-01-08)
- Queue 3-column layout fix + MVP1 verified (2026-01-07)

---
*Full history: `.claude/plans/archive/`*
