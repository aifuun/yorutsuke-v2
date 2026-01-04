# MVP Plan

> Incremental testing plan for manual verification

**Version**: 1.1.0
**Last Updated**: 2026-01-04

## Overview

逐步验证产品功能，从最小可测试单元开始，每个 MVP 阶段都可独立手动测试。

```
MVP1 (Local) → MVP2 (Upload) → MVP3 (Batch) → MVP3.5 (Sync) → MVP4 (Auth)
   纯本地         上传云端        夜间处理        确认回写        完整认证
```

### 数据流向

```
MVP1-2: 本地 ────────────────────────────► 云端 (图片上传)
MVP3:   本地 ◄──────────────────────────── 云端 (AI 结果拉取)
MVP3.5: 本地 ────────────────────────────► 云端 (确认回写)
MVP4:   本地 ◄──────────────────────────► 云端 (完整双向)
```

---

## MVP1 - 纯本地 (Local Only)

> **目标**: 验证本地捕获流程，无需任何后端

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| 拖放图片 | Drag & drop 到应用窗口 | [ ] |
| 图片压缩 | JPEG/PNG → WebP (<500KB) | [ ] |
| 队列显示 | 显示 pending/compressed 状态 | [ ] |
| 本地存储 | SQLite 存储图片元数据 | [ ] |
| 重复检测 | MD5 去重 | [ ] |
| 缩略图 | 显示压缩后预览 | [ ] |

### 测试场景

从 [TEST_SCENARIOS.md](./TEST_SCENARIOS.md) 选取：

| ID | 场景 | 预期 |
|----|------|------|
| SC-001 | 单张图片拖放 | 压缩成功，状态 compressed |
| SC-002 | 多张图片拖放 | 顺序处理 |
| SC-003 | 大图 (>5MB) | 压缩到 <500KB |
| SC-010 | 有效格式 (JPG/PNG/HEIC) | 全部接受 |
| SC-011 | 无效格式 (.txt/.pdf) | 拒绝并提示 |
| SC-020 | 同文件两次 | 第二次检测为重复 |
| SC-021 | 相同内容不同名 | MD5 检测为重复 |

### 环境配置

```bash
# Mock 模式 - 跳过所有网络请求
cd app
cp .env.mock .env.local
npm run tauri dev
```

### 验收标准

- [ ] 拖放 10 张不同图片，全部压缩成功
- [ ] 拖放重复图片，正确检测并跳过
- [ ] 重启应用后，队列状态从 SQLite 恢复
- [ ] 无网络环境下正常工作

### 依赖

- 无后端依赖
- Mock 模式启用

---

## MVP2 - 上传云端 (Upload)

> **目标**: 验证图片上传到 S3

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| Presigned URL | 从 Lambda 获取上传 URL | [ ] |
| S3 上传 | 上传 WebP 到 S3 | [ ] |
| 网络状态 | 显示 online/offline | [ ] |
| 上传重试 | 失败自动重试 (最多 3 次) | [ ] |
| 离线队列 | 离线时暂停，恢复后继续 | [ ] |
| Quota 显示 | 显示今日使用量/限额 | [ ] |

### 测试场景

| ID | 场景 | 预期 |
|----|------|------|
| SC-300 | 离线启动 | 本地功能正常 |
| SC-301 | 上传中断网 | 暂停并显示 offline |
| SC-302 | 恢复网络 | 自动继续上传 |
| SC-312 | 上传失败重试 | 自动重试最多 3 次 |
| SC-313 | 永久失败 | 状态 failed，可手动重试 |
| SC-420 | URL 过期 | 获取新 URL 重试 |

### 环境配置

```bash
# 需要部署 presign Lambda
cd infra
cdk deploy YorutsukePresignStack --profile dev

# 配置 Lambda URL
cd app
echo "VITE_LAMBDA_PRESIGN_URL=https://xxx.lambda-url.ap-northeast-1.on.aws" >> .env.local
npm run tauri dev
```

### 验收标准

- [ ] 上传 5 张图片到 S3，全部成功
- [ ] 断网后上传暂停，恢复后自动继续
- [ ] 上传失败后自动重试
- [ ] Quota 正确显示 (used/limit)

### 依赖

- Lambda: `presign`
- S3: `yorutsuke-images-dev`

---

## MVP3 - 夜间处理 (Batch + Report)

> **目标**: 验证完整 AI 处理流程

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| 批处理触发 | 02:00 JST 自动运行 | [ ] |
| Nova Lite OCR | AI 提取金额/商户/分类 | [ ] |
| 晨报展示 | 昨日收支汇总 | [ ] |
| 交易列表 | 显示 AI 提取的交易 | [ ] |
| 确认/编辑 | 确认或修改交易 | [ ] |
| 历史日历 | 按日期查看历史 | [ ] |
| 分类统计 | 按分类汇总 | [ ] |

### 测试场景

| ID | 场景 | 预期 |
|----|------|------|
| - | 上传 5 张收据 | S3 存储成功 |
| - | 等待批处理 | 02:00 JST 处理 |
| - | 查看晨报 | 显示提取的交易 |
| - | 确认交易 | 标记为已确认 |
| - | 编辑金额 | 修改并保存 |
| - | 删除错误项 | 从列表移除 |

### 环境配置

```bash
# 部署完整后端
cd infra
cdk deploy --all --profile dev

# 手动触发批处理 (测试用)
aws lambda invoke \
  --function-name yorutsuke-batch-dev \
  --profile dev \
  /tmp/out.json
```

### 验收标准

- [ ] 上传的收据被 AI 正确解析
- [ ] 晨报显示昨日汇总
- [ ] 可以确认/编辑/删除交易
- [ ] 历史日历可以查看过去 7 天

### 依赖

- Lambda: `presign`, `batch`, `batch-process`
- S3: `yorutsuke-images-dev`
- DynamoDB: `yorutsuke-transactions-dev`
- Bedrock: Nova Lite

---

## MVP3.5 - 确认回写 (Cloud Sync)

> **目标**: 验证用户确认的交易同步到云端，支持数据恢复

### 背景

```
当前问题：
- 图片已上传到 S3 ✓
- AI 结果存在 DynamoDB ✓
- 用户确认只存本地 SQLite ✗ ← 设备丢失 = 数据丢失

解决方案：
- 确认交易时同步到 DynamoDB
- 新设备登录时可恢复已确认交易
```

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| 确认回写 | 确认交易时同步到 DynamoDB | [ ] |
| 编辑回写 | 修改金额/分类后同步 | [ ] |
| 删除回写 | 删除交易时同步 | [ ] |
| 离线队列 | 离线时暂存，恢复后同步 | [ ] |
| 数据恢复 | 新设备登录拉取已确认交易 | [ ] |
| 冲突处理 | Last-Write-Wins 策略 | [ ] |

### 数据流

```
确认交易时：
┌─────────────────┐                  ┌─────────────────┐
│ 用户点击确认     │                  │ DynamoDB        │
│       ↓         │                  │                 │
│ SQLite 更新     │ ──── POST ────► │ transactions/   │
│ confirmedAt     │   /confirm       │   confirmedAt   │
│                 │                  │   amount (修改) │
└─────────────────┘                  └─────────────────┘

新设备恢复时：
┌─────────────────┐                  ┌─────────────────┐
│ 登录成功        │                  │ DynamoDB        │
│       ↓         │  ◄─── GET ────  │                 │
│ 检测云端数据     │   /confirmed     │ 已确认交易列表   │
│       ↓         │                  │                 │
│ 提示恢复？      │                  │                 │
│       ↓         │                  │                 │
│ 写入 SQLite     │                  │                 │
└─────────────────┘                  └─────────────────┘
```

### API 设计

```typescript
// POST /transactions/confirm
{
  transactionId: string;
  confirmedAt: string;
  amount?: number;      // 用户修改后的金额
  category?: string;    // 用户修改后的分类
  description?: string; // 用户修改后的描述
}

// GET /transactions/confirmed?userId=xxx
{
  transactions: Transaction[];
  lastSyncAt: string;
}

// DELETE /transactions/{id}
// 标记为已删除，不物理删除
```

### 测试场景

| ID | 场景 | 预期 |
|----|------|------|
| SC-800 | 确认交易 | 本地+云端都更新 |
| SC-801 | 修改后确认 | 修改内容同步到云端 |
| SC-802 | 删除交易 | 云端标记删除 |
| SC-803 | 离线确认 | 恢复网络后自动同步 |
| SC-804 | 新设备登录 | 提示恢复云端数据 |
| SC-805 | 恢复数据 | 已确认交易写入本地 |
| SC-806 | 冲突处理 | 较新的记录覆盖旧的 |

### 环境配置

```bash
# 需要新增 Lambda: transactions-sync
cd infra
cdk deploy YorutsukeTransactionSyncStack --profile dev

# 配置 Sync API
cd app
echo "VITE_LAMBDA_SYNC_URL=https://xxx.lambda-url.ap-northeast-1.on.aws" >> .env.local
npm run tauri dev
```

### 验收标准

- [ ] 确认交易后 DynamoDB 有记录
- [ ] 修改交易后云端数据更新
- [ ] 删除交易后云端标记删除
- [ ] 离线确认，恢复后自动同步
- [ ] 新设备登录可恢复已确认交易
- [ ] 本地和云端数据一致

### 依赖

- Lambda: `transactions-sync` (新增)
- DynamoDB: `yorutsuke-transactions-dev`
- 需要先完成 MVP3

### 实现要点

```typescript
// 1. 确认时同步 (异步，不阻塞 UI)
const confirm = async (id: TransactionId) => {
  await confirmTransaction(id);  // 本地
  dispatch({ type: 'CONFIRM_SUCCESS', id });

  // 异步同步到云端
  syncToCloud(id).catch(queueForRetry);
};

// 2. 离线队列
interface SyncQueue {
  pending: Array<{
    action: 'confirm' | 'update' | 'delete';
    transactionId: string;
    data: Partial<Transaction>;
    queuedAt: string;
  }>;
}

// 3. 恢复流程
const onLogin = async (userId: UserId) => {
  const cloudData = await fetchConfirmedTransactions(userId);
  if (cloudData.length > 0) {
    const shouldRestore = await askUser('检测到云端数据，是否恢复？');
    if (shouldRestore) {
      await mergeToLocal(cloudData);
    }
  }
};
```

---

## MVP4 - 完整认证 (Full Auth)

> **目标**: 验证用户系统和配额管理

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| Guest 模式 | 无需登录即可使用 | [ ] |
| 注册流程 | Email + 验证码 | [ ] |
| 登录/登出 | Cognito 认证 | [ ] |
| Guest 数据迁移 | 登录后认领 Guest 数据 | [ ] |
| Tier 配额 | guest/free/basic/pro 限额 | [ ] |
| Token 刷新 | 自动刷新过期 Token | [ ] |
| 设置持久化 | 主题/语言/通知 | [ ] |

### 测试场景

| ID | 场景 | 预期 |
|----|------|------|
| SC-100 | Guest 默认配额 | limit=10, tier=guest |
| SC-101 | Guest 过期警告 | 显示剩余天数 |
| SC-103 | Guest 达到限额 | 阻止上传，提示注册 |
| SC-200 | 注册流程 | Guest → Register → Verify → Login |
| SC-201 | 登录认领数据 | Guest 的图片迁移到新账户 |
| SC-600 | 登录成功 | 显示用户信息 |
| SC-602 | 登出 | 清除 Token，返回 Guest |

### 环境配置

```bash
# 部署认证栈
cd infra
cdk deploy YorutsukeAuthStack --profile dev

# 配置 Auth API
cd app
echo "VITE_AUTH_API_URL=https://xxx.execute-api.ap-northeast-1.amazonaws.com/prod" >> .env.local
npm run tauri dev
```

### 验收标准

- [ ] Guest 用户可以使用基本功能
- [ ] 注册 → 验证 → 登录流程完整
- [ ] Guest 数据正确迁移到注册账户
- [ ] 不同 Tier 配额正确显示和限制
- [ ] 设置修改后重启仍保留

### 依赖

- Cognito: User Pool
- Lambda: `auth-*`
- 完整后端部署

---

## 进度追踪

| MVP | 目标 | 开始日期 | 完成日期 | 状态 |
|-----|------|----------|----------|------|
| MVP1 | 纯本地 | - | - | [ ] 未开始 |
| MVP2 | 上传云端 | - | - | [ ] 未开始 |
| MVP3 | 夜间处理 | - | - | [ ] 未开始 |
| MVP3.5 | 确认回写 | - | - | [ ] 未开始 |
| MVP4 | 完整认证 | - | - | [ ] 未开始 |

---

## 测试检查表

每个 MVP 完成后更新：

### MVP1 检查表
- [ ] 所有 SC-001~004 通过
- [ ] 所有 SC-010~013 通过
- [ ] 所有 SC-020~023 通过
- [ ] 截图/录屏存档

### MVP2 检查表
- [ ] 所有 SC-300~313 通过
- [ ] 所有 SC-420~422 通过
- [ ] S3 验证有上传文件
- [ ] 截图/录屏存档

### MVP3 检查表
- [ ] 批处理成功运行
- [ ] AI 提取结果正确
- [ ] 晨报显示正常
- [ ] 交易管理正常
- [ ] 截图/录屏存档

### MVP3.5 检查表
- [ ] 所有 SC-800~806 通过
- [ ] DynamoDB 有确认记录
- [ ] 离线同步队列正常
- [ ] 新设备恢复成功
- [ ] 截图/录屏存档

### MVP4 检查表
- [ ] 所有 SC-100~131 通过
- [ ] 所有 SC-200~222 通过
- [ ] 所有 SC-600~603 通过
- [ ] Cognito 用户创建成功
- [ ] 截图/录屏存档

---

## 问题记录

在测试过程中发现的问题记录到 GitHub Issues，格式：

```
标题: [MVPx] 简短描述
标签: bug, mvp1/mvp2/mvp3/mvp4
内容:
- 测试场景 ID
- 复现步骤
- 预期 vs 实际
- 截图/日志
```

---

## References

- [REQUIREMENTS.md](./REQUIREMENTS.md) - 功能需求
- [TEST_SCENARIOS.md](./TEST_SCENARIOS.md) - 测试场景详情
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 技术架构
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南
