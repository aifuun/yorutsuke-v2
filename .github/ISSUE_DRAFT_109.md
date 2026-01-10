# Issue #109: Transaction Management UX Improvements

**关联 MVP**: MVP4 - Transaction Management
**优先级**: P1
**复杂度**: T2 (Logic/State)
**前置依赖**: #108 (Cloud Sync完成)

## 概要

Issue #108 实现了基础的云端同步，但 Transaction 管理的用户体验还需要以下改进：
1. 附带图片预览（Confirm 流程需要查看原始发票）
2. 排序选项（处理时间/发票时间，正序/倒序）
3. 分页（每20条）
4. 梳理 Delete 流程（云端同步）
5. Confirm 后同步到云端

## 背景

当前状态（Issue #108 完成后）：
- ✅ Pull-only sync: 云端 → 本地
- ✅ Conflict resolution 策略
- ✅ Auto-sync 触发器
- ❌ Transaction 无图片关联显示
- ❌ 只能按发票日期降序排列
- ❌ 无分页，历史数据过多时性能差
- ❌ Delete 只删本地，不同步云端
- ❌ Confirm 只更新本地，不同步云端

## 验收标准

### 1. 图片预览与 Confirm 流程

**需求**:
- Transaction Card 显示缩略图（如果有 imageId）
- 点击缩略图打开 Lightbox 查看原图
- Confirm 按钮前置条件：用户查看过图片

**实现要点**:
- `Transaction.imageId` 已存在，需要：
  - 从 `images` 表获取 `compressed_path`（本地）或 `s3_key`（云端）
  - 如果本地文件存在 → 显示本地
  - 如果本地文件不存在 + 有 s3_key → 显示 S3 URL（需要生成 presigned URL）
  - 如果都不存在 → 显示占位符 "图片已删除"

**UI Mock**:
```
┌─────────────────────────────────────────────┐
│ [📷] KFC    2025-04-15    -¥1,200          │
│      [未确认]                                │
│                                             │
│      [查看发票] [确认] [删除]                 │
└─────────────────────────────────────────────┘
```

**Confirm 流程**:
1. 用户点击 "查看发票" → Lightbox 打开，显示原图
2. Lightbox 底部有 "确认" 按钮
3. 用户确认后 → 本地 `confirmedAt` 更新 + 同步到云端

**技术决策**:
- **问题**: 图片可能不存在（30天TTL，其他设备上传，guest→user迁移）
- **方案**:
  - 优先使用本地 `compressed_path`
  - 如果不存在 + 有 `s3_key` → 调用 presign Lambda 获取临时 URL
  - 如果都不存在 → 显示占位符，允许用户仍可 Confirm（基于金额/商户判断）

### 2. 排序选项

**需求**:
- 默认：按 **发票日期** 降序（最新的在上面）
- 可切换：
  - 发票日期 (transaction.date) 升序/降序
  - 处理时间 (transaction.createdAt) 升序/降序

**UI Mock**:
```
排序: [发票日期 ▼] [↓ 降序]
      [处理时间]     [↑ 升序]
```

**实现**:
- 在 `TransactionView` 添加排序控件
- `useTransactionLogic` 的 `load()` 接受 `sortBy` 和 `sortOrder` 参数
- SQL: `ORDER BY ${field} ${order}`

### 3. 分页

**需求**:
- 每页 20 条记录
- 底部显示页码导航
- URL query param 记录当前页（方便刷新后保持位置）

**UI Mock**:
```
┌─────────────────────────────────────────────┐
│ Showing 1-20 of 156 transactions            │
│                                             │
│ [1] [2] [3] ... [8] [下一页]                │
└─────────────────────────────────────────────┘
```

**实现**:
- 后端分页：`fetchTransactions(userId, { startDate, endDate, limit: 20, offset })`
- SQL: `LIMIT ? OFFSET ?`
- 前端：`useState<number>` 记录当前页
- 性能：加载时间从 O(n) 降到 O(20)

### 4. Delete 流程梳理

**当前行为**:
```typescript
// transactionDb.ts
export async function deleteTransaction(id: TransactionIdType): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM transactions WHERE id = ?', [id]);
}
```

**问题**:
- 只删除本地，不同步云端
- 云端数据下次 sync 会重新出现（"删不掉"）

**解决方案 1: 软删除（推荐）**
```typescript
// 本地标记为 deleted
UPDATE transactions SET status = 'deleted', updated_at = NOW() WHERE id = ?;

// 下次 sync 时推送到云端
PUT /transactions/{id}
{ status: 'deleted', updatedAt: '...' }

// 云端 DynamoDB 更新 status
// 其他设备 sync 时也会获取 status='deleted'，本地隐藏
```

**解决方案 2: 立即推送删除**
```typescript
// 删除时立即调用云端 API
await deleteTransactionApi(transactionId);
// 然后删除本地
await deleteTransaction(transactionId);
```

**技术决策**:
- **选择方案 1（软删除）**，原因：
  - 符合现有 pull-only sync 架构
  - 支持离线删除（标记后延迟同步）
  - 保留审计记录（云端 status='deleted' 可查历史）
  - 未来可支持 "撤销删除"

**实现步骤**:
1. Migration v8: 添加 `status` 列（已有，确认使用）
2. 修改 `deleteTransaction()` → 软删除：`UPDATE status = 'deleted'`
3. UI 过滤：`WHERE status != 'deleted'`
4. 新增 `pushLocalChanges()` 函数（MVP5: Bidirectional Sync）
5. Sync 策略更新：云端 `status='deleted'` 的交易在本地也标记为 deleted

### 5. Confirm 同步到云端

**当前行为**:
```typescript
// transactionDb.ts
export async function confirmTransaction(id: TransactionIdType): Promise<void> {
  const database = await getDb();
  await database.execute(
    'UPDATE transactions SET confirmed_at = ?, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), new Date().toISOString(), id],
  );
}
```

**问题**:
- Confirm 只更新本地
- 云端不知道用户已确认
- 其他设备 sync 后看到的仍是 unconfirmed

**解决方案**:
与 Delete 类似，使用 **软标记 + 延迟同步**：

```typescript
// Step 1: 本地更新
UPDATE transactions
SET confirmed_at = NOW(), updated_at = NOW()
WHERE id = ?;

// Step 2: 标记为 "需要推送"
// 方案 A: 添加 `dirty` 标志列
// 方案 B: 通过 conflict resolution 让云端 sync 时拉取本地更新

// Step 3: 下次 sync 时推送
if (localTx.updatedAt > cloudTx.updatedAt && localTx.confirmedAt) {
  await pushTransactionUpdate(localTx);
}
```

**MVP4 vs MVP5 边界**:
- **MVP4（本 Issue）**:
  - Confirm 本地生效 ✅
  - 标记为 "待同步"（添加 `dirty` flag）✅
  - UI 显示同步状态 ✅
- **MVP5（Bidirectional Sync）**:
  - 实现完整的 push API
  - Conflict resolution（双向）
  - Optimistic locking（version control）

**实现步骤（MVP4）**:
1. Migration v8: 添加 `dirty_sync` 列（boolean，标记需要推送）
2. `confirmTransaction()` 更新时设置 `dirty_sync = true`
3. UI 显示同步状态图标（⏳ 待同步 / ✅ 已同步）
4. 为 MVP5 预留接口：`pushLocalChanges()`

## 实现计划

### Phase 1: 图片预览（2h）
- [ ] 创建 `ImageService.getImageUrl(imageId)` - 返回本地路径或 S3 presigned URL
- [ ] `TransactionCard` 添加缩略图显示
- [ ] 实现 Lightbox 组件（react-image-lightbox 或自定义）
- [ ] Confirm 按钮逻辑：必须先查看图片（如果有 imageId）

### Phase 2: 排序与分页（1.5h）
- [ ] `TransactionView` 添加排序控件 UI
- [ ] `fetchTransactions()` 添加 `limit` 和 `offset` 参数
- [ ] 实现分页导航组件
- [ ] URL query param 同步（`?page=2&sort=date&order=desc`）

### Phase 3: 软删除与 Confirm 同步（2h）
- [ ] Migration v8: `dirty_sync` 列
- [ ] 修改 `deleteTransaction()` → 软删除
- [ ] 修改 `confirmTransaction()` → 设置 dirty_sync
- [ ] UI 过滤：隐藏 `status='deleted'` 的交易
- [ ] UI 显示同步状态（Pending/Synced）

### Phase 4: 测试与文档（1h）
- [ ] 单元测试：软删除、分页、排序
- [ ] 集成测试：图片加载失败场景
- [ ] 更新 MEMORY.md 和 SCHEMA.md
- [ ] 更新 `.claude/plans/active/#109.md`

**总时长**: ~6.5h

## 文件清单

### 新增文件
- `app/src/02_modules/transaction/services/imageService.ts` - 图片 URL 获取
- `app/src/02_modules/transaction/components/ImageLightbox.tsx` - Lightbox 组件
- `app/src/02_modules/transaction/components/Pagination.tsx` - 分页导航
- `app/src/00_kernel/storage/migrations.ts` (migration v8) - dirty_sync 列

### 修改文件
- `app/src/02_modules/transaction/views/TransactionView.tsx` - 排序控件 + 分页
- `app/src/02_modules/transaction/adapters/transactionDb.ts` - 软删除 + dirty_sync
- `app/src/02_modules/transaction/headless/useTransactionLogic.ts` - 分页状态
- `app/src/02_modules/transaction/services/syncService.ts` - 软删除同步策略
- `docs/architecture/SCHEMA.md` - 更新 dirty_sync 列说明

## 测试场景

### SC-109-01: 图片预览
- Given: Transaction 有 imageId，本地文件存在
- When: 点击缩略图
- Then: Lightbox 打开，显示本地图片

### SC-109-02: 图片缺失
- Given: Transaction 有 imageId，本地文件不存在，s3_key 存在
- When: 点击缩略图
- Then: 调用 presign Lambda，显示 S3 图片

### SC-109-03: 图片完全缺失
- Given: Transaction 无 imageId 或 s3_key 不存在
- When: 查看 Transaction Card
- Then: 显示占位符 "图片已删除"，仍可 Confirm

### SC-109-04: 排序切换
- Given: 当前按发票日期降序
- When: 切换到 "处理时间升序"
- Then: 列表重新加载，按 createdAt ASC 排序

### SC-109-05: 分页导航
- Given: 共 156 条记录
- When: 点击 "第 3 页"
- Then: URL 变为 `?page=3`，显示 41-60 条记录

### SC-109-06: 软删除
- Given: 删除一条交易
- When: 本地标记 status='deleted'
- Then: 列表中不再显示该交易，下次 sync 推送到云端

### SC-109-07: Confirm 同步
- Given: Confirm 一条交易
- When: 本地更新 confirmed_at，设置 dirty_sync=true
- Then: UI 显示 "⏳ 待同步"，MVP5 时推送到云端

## 技术决策记录

### 为什么选择软删除？
1. **离线支持**: 用户离线时删除，标记后延迟同步
2. **审计记录**: 保留删除历史，符合会计规范
3. **架构一致性**: 符合现有 pull-only sync 模式
4. **可撤销**: 未来可支持 "撤销删除" 功能

### 为什么分页用 SQL LIMIT/OFFSET？
1. **性能**: 前端只加载 20 条，内存占用低
2. **扩展性**: 支持 10,000+ 条历史记录
3. **用户体验**: 加载速度快，响应及时

### 为什么图片优先本地？
1. **速度**: 本地文件读取比 S3 presigned URL 快
2. **离线**: 即使断网也能查看本地缓存的图片
3. **成本**: 减少 S3 GET 请求（presigned URL 生成无费用，但 GET 有费用）

## Blockers

- 无（#108 已完成，云端同步基础已就绪）

## 相关文档

- Issue #108: Cloud Sync for Transactions
- `.claude/plans/active/#108-cloud-sync.md`
- `docs/architecture/SCHEMA.md` - Transaction 表结构
- MVP5 规划: Bidirectional Sync（双向同步完整实现）
