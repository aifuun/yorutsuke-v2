# Feature Plan: #109 Transaction Management UX

| 项目 | 值 |
|------|-----|
| Issue | #109 |
| MVP | MVP4 |
| 复杂度 | T2 (Logic/State) |
| 预估 | 5h |
| 状态 | [x] 规划 / [x] 开发中 / [x] Review / [x] 完成 |

---

## 1. 目标

**做什么**: 改进 Transaction 管理的用户体验（图片预览、排序、分页、软删除）

**为什么**: #108 完成了云同步基础，但 UX 还需完善才能满足 MVP4 验收

**验收标准**:
- [x] Transaction Card 显示缩略图（本地优先，fallback S3）
- [x] 排序：发票日期/处理时间 × 升序/降序
- [x] 分页：每页 20 条，底部导航
- [x] 软删除：本地标记 status='deleted'，UI 隐藏
- [x] 测试通过 (92/92)

---

## 2. 实现方案

### 改动范围

| 文件 | 类型 | 改动 |
|------|------|------|
| `transaction/adapters/imageUrlService.ts` | 新增 | 获取图片 URL（本地/S3） |
| `transaction/views/TransactionView.tsx` | 修改 | 排序控件 + 分页 + 缩略图 |
| `transaction/adapters/transactionDb.ts` | 修改 | 软删除 + 分页查询 |
| `transaction/headless/useTransactionLogic.ts` | 修改 | 分页状态 + 排序参数 |
| `00_kernel/storage/migrations.ts` | 修改 | (无需 - status 列已存在) |

### 实现步骤

**Phase 1: 排序与分页** (~1.5h)
- [ ] `transactionDb.ts`: 添加 `limit`, `offset`, `sortBy`, `sortOrder` 参数
- [ ] `useTransactionLogic.ts`: 添加分页状态 (page, pageSize, total)
- [ ] `TransactionView.tsx`: 排序控件 UI
- [ ] `TransactionView.tsx`: 分页导航组件

**Phase 2: 软删除** (~1h)
- [ ] `transactionDb.ts`: 修改 `deleteTransaction()` → `UPDATE status = 'deleted'`
- [ ] `transactionDb.ts`: `fetchTransactions()` 添加 `WHERE status != 'deleted'`
- [ ] 确认云端同步策略（status='deleted' 的处理）

**Phase 3: 图片预览** (~1.5h)
- [ ] 创建 `imageUrlService.ts`: `getImageUrl(imageId)` 返回本地路径或 S3 URL
- [ ] `TransactionCard`: 添加缩略图显示
- [ ] 处理图片不存在场景（占位符）
- [ ] (可选) Lightbox 组件 - 如果时间允许

**Phase 4: 测试** (~1h)
- [ ] 单元测试：软删除、分页 SQL
- [ ] 集成测试：图片 URL 获取
- [ ] 手动测试：排序/分页/删除流程

---

## 3. 测试用例

### 单元测试
| Case | 输入 | 期望 |
|------|------|------|
| 分页第一页 | `limit=20, offset=0` | 返回前 20 条 |
| 分页第二页 | `limit=20, offset=20` | 返回 21-40 条 |
| 排序日期降序 | `sortBy='date', order='desc'` | 最新日期在前 |
| 软删除 | `deleteTransaction(id)` | status 变为 'deleted' |
| 过滤已删除 | `fetchTransactions()` | 不返回 status='deleted' |

### 场景测试
| ID | 场景 | 预期 |
|----|------|------|
| SC-109-01 | 切换排序方式 | 列表按新顺序重新加载 |
| SC-109-02 | 点击下一页 | 显示下一批 20 条 |
| SC-109-03 | 删除交易 | 从列表消失，不再显示 |
| SC-109-04 | 有图片的交易 | 显示缩略图 |
| SC-109-05 | 图片已删除 | 显示占位符 |

---

## 4. 风险 & 依赖

**风险**:
| 风险 | 级别 | 应对 |
|------|------|------|
| S3 presign 需要新 Lambda | 中 | 先显示本地，S3 作为 P2 |
| Lightbox 库选型 | 低 | 可用简单 modal 替代 |

**依赖**:
- [x] 前置 Issue: #108 (Cloud Sync)
- [ ] S3 presign Lambda (如需 S3 图片)

---

## 5. 实际交付

| 功能 | 原计划 | 实际交付 |
|------|--------|----------|
| 排序 + 分页 | 必须 | ✅ 实现 |
| 软删除 | 必须 | ✅ 实现 (status='deleted' + dirty_sync) |
| 本地图片缩略图 | 必须 | ✅ 实现 |
| Lightbox | 延迟 MVP5 | ✅ 提前实现 |
| dirty_sync 列 | 延迟 MVP5 | ✅ 提前实现 (migration v8) |
| S3 图片 presign | 延迟 MVP5 | ⏸️ 待实现 (需要 Lambda 扩展) |
| URL query param | 可选 | ⏸️ 内存状态 |

**超额交付**: Lightbox、dirty_sync 提前完成

---

## 6. 进度

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-01-09 | 规划完成 | 简化范围，聚焦核心功能 |
| 2026-01-10 | 开发完成 | 超额交付 Lightbox + dirty_sync |
| 2026-01-10 | Review 完成 | 修复 3 个测试问题，92/92 通过 |

---

*开发前确认*:
- [x] 方案已确认，无 open questions
- [x] 依赖已就绪 (#108 完成)
- [x] 测试用例覆盖完整
- [x] 范围已简化，聚焦 MVP4 核心
