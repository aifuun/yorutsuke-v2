# MVP3 - 智能批处理 (Multi-Mode + Admin Config)

> **目标**: 验证完整 AI 处理流程 + 可配置处理模式

## 变更概述 (2026-01-08)

| 项目 | 旧 | 新 |
|------|-----|-----|
| 处理模式 | 固定 Batch | **三种模式可选 (Instant/Batch/Hybrid)** |
| 触发条件 | 固定时间 (02:00 JST) | **模式依赖 + 手动触发 (见下方)** |
| API 类型 | ON_DEMAND | **Instant=On-Demand, Batch=Batch Inference (50% 折扣)** |
| Admin 配置 | 无 | **支持模式/阈值/间隔/LLM 选择** |

## ⚠️ AWS Batch Inference 限制

> **重要**: AWS Bedrock Batch Inference 要求 **最少 100 条记录** 才能创建 Job。
> 这决定了我们的处理模式设计。

| 限制 | 值 | 影响 |
|------|-----|------|
| 最小记录数 | 100 | Batch 模式阈值必须 >= 100 |
| 折扣 | 50% | Batch 比 On-Demand 便宜一半 |

## 处理模式 (Processing Mode)

### 三种模式对比

| 模式 | API | 最小张数 | 触发条件 | 成本 | 适用场景 |
|------|-----|----------|----------|------|----------|
| **Instant** | On-Demand | 1 | 每张立即处理 | 全价 | 初期/低量用户 |
| **Batch Only** | Batch | 100 | >= 100 张时触发 | **5折** | 高量用户 |
| **Hybrid** | 混合 | 1 | >= 100 用 Batch, 超时用 On-Demand | 混合 | 中量用户 |

### MVP3 初期策略

```
┌─────────────────────────────────────────────────────────────┐
│  MVP3 默认: Instant 模式                                     │
│                                                             │
│  理由:                                                       │
│  1. 用户少，简化实现                                          │
│  2. 无 100 张最低限制                                         │
│  3. 快速验证 OCR 准确度                                       │
│  4. 用户增长后再切换 Batch/Hybrid                             │
└─────────────────────────────────────────────────────────────┘
```

### 模式切换时机建议

| 阶段 | 日均图片量 | 推荐模式 |
|------|-----------|----------|
| 初期 | < 50 张/天 | Instant |
| 增长期 | 50-200 张/天 | Hybrid |
| 成熟期 | > 200 张/天 | Batch Only |

---

### 功能范围

| 功能 | 说明 | Issue | 状态 |
|------|------|-------|------|
| **处理模式** | Instant / Batch Only / Hybrid (Admin 可选) | #98, #100 | [ ] |
| **Admin 配置** | 模式/阈值/间隔/LLM 可在 Admin Panel 配置 | - | [ ] |
| Nova Lite OCR | AI 提取金额/商户/分类 | - | [x] |
| 晨报展示 | 昨日收支汇总 | #114 | [ ] |
| 交易列表 | 显示 AI 提取的交易 | #115 | [ ] |
| 确认/编辑 | 确认或修改交易 | #116 | [ ] |
| 历史日历 | 按日期查看历史 | #117 | [ ] |
| 分类统计 | 按分类汇总 | - | [ ] |

### 处理架构 (按模式)

#### Instant 模式 (MVP3 默认)

```
┌───────────────────────────────────────────────────────────────┐
│                      Instant Mode (On-Demand)                  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  S3 ObjectCreated                                             │
│       ↓                                                       │
│  ┌──────────────────────────┐                                │
│  │ instant-processor Lambda │                                │
│  │ - Read image from S3     │                                │
│  │ - Call Bedrock On-Demand │                                │
│  │ - Write to transactions  │                                │
│  │ - Move to processed/     │                                │
│  └──────────────────────────┘                                │
│                                                               │
│  ⏱️ 延迟: ~5-10 秒/张                                          │
│  💰 成本: 全价                                                 │
└───────────────────────────────────────────────────────────────┘
```

#### Batch Only 模式

```
┌───────────────────────────────────────────────────────────────┐
│                      Batch Only Mode                           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  S3 ObjectCreated                                             │
│       ↓                                                       │
│  ┌──────────────────────────┐                                │
│  │ batch-counter Lambda     │                                │
│  │ - Count pending images   │                                │
│  │ - if count >= threshold  │  (100-500, Admin 配置)          │
│  │   → invoke orchestrator  │                                │
│  └──────────────┬───────────┘                                │
│                 ▼                                             │
│  ┌──────────────────────────┐                                │
│  │ batch-orchestrator Lambda│                                │
│  │ - Prepare manifest.jsonl │  (必须 >= 100 条)               │
│  │ - CreateModelInvocationJob│                               │
│  └──────────────┬───────────┘                                │
│                 ▼                                             │
│  ┌──────────────────────────┐                                │
│  │ Bedrock Batch Inference  │  50% 折扣                       │
│  └──────────────┬───────────┘                                │
│                 ▼                                             │
│  ┌──────────────────────────┐                                │
│  │ batch-result-handler     │                                │
│  └──────────────────────────┘                                │
│                                                               │
│  ⏱️ 延迟: 累积到阈值后处理                                      │
│  💰 成本: 5折                                                  │
└───────────────────────────────────────────────────────────────┘
```

#### Hybrid 模式

```
┌───────────────────────────────────────────────────────────────┐
│                      Hybrid Mode                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Trigger A: Image Count          Trigger B: Timeout           │
│  ┌────────────────────┐        ┌────────────────────┐        │
│  │ S3 ObjectCreated   │        │ EventBridge        │        │
│  │ ↓                  │        │ (configurable)     │        │
│  │ batch-counter      │        │ ↓                  │        │
│  │ if count >= 100    │        │ batch-counter      │        │
│  └─────────┬──────────┘        └─────────┬──────────┘        │
│            │                             │                    │
│            ▼                             ▼                    │
│  ┌────────────────────┐        ┌────────────────────┐        │
│  │ count >= 100?      │        │ count > 0 && < 100?│        │
│  │ → Batch Inference  │        │ → On-Demand        │        │
│  │   (5折)            │        │   (全价, 保证处理)  │        │
│  └────────────────────┘        └────────────────────┘        │
│                                                               │
│  💡 满 100 打折，不满 100 超时后全价处理，保证报告生成            │
└───────────────────────────────────────────────────────────────┘
```

### Admin 可配置项

| 配置项 | 默认值 | 范围 | 适用模式 | 说明 |
|--------|--------|------|----------|------|
| `processingMode` | `instant` | instant/batch/hybrid | 全局 | 处理模式 |
| `imageThreshold` | 100 | 100-500 | Batch/Hybrid | 累计触发张数 (AWS 要求 >= 100) |
| `timeoutMinutes` | 120 | 30-480 | Hybrid | 超时降级时间 (分钟) |
| `modelId` | `amazon.nova-lite-v1:0` | 见下方 | 全局 | LLM 选择 |

**处理模式说明**:

| 模式 | `imageThreshold` | `timeoutMinutes` |
|------|------------------|------------------|
| `instant` | ❌ 不使用 | ❌ 不使用 |
| `batch` | ✅ 必须 >= 100 | ❌ 不使用 |
| `hybrid` | ✅ 必须 >= 100 | ✅ 超时后降级到 On-Demand |

**可用 LLM**:
- `amazon.nova-lite-v1:0` - 推荐, 低成本
- `amazon.nova-pro-v1:0` - 高精度
- `anthropic.claude-3-haiku-20240307-v1:0` - 备选

### 测试场景

从 [FRONTEND.md](../tests/FRONTEND.md) 和 [BACKEND.md](../tests/BACKEND.md) 选取：

#### Backend: Processing Mode (SB-2xx)
| ID | 场景 | 预期 |
|----|------|------|
| SB-200 | **Instant 模式** | 上传后立即 On-Demand 处理 |
| SB-201 | **Batch 模式 - 阈值触发** | 上传第 100 张时触发 Batch Job |
| SB-202 | **Batch 模式 - 不足阈值** | 上传 50 张，等待，不触发 |
| SB-203 | **Hybrid - 满足阈值** | >= 100 张时用 Batch (5折) |
| SB-204 | **Hybrid - 超时降级** | < 100 张 + 超时 → On-Demand (全价) |
| SB-205 | **Config 读取** | Lambda 从 DynamoDB 读取当前模式 |
| SB-206 | **模式切换** | Admin 切换模式后下次处理生效 |
| SB-207 | **阈值校验** | 设置 < 100 时 API 返回 400 |
| SB-210 | 清晰收据 | 提取商户、金额、分类 |
| SB-211 | 模糊收据 | 低置信度 (<0.7) |
| SB-220 | 创建交易 | OCR 结果写入 DynamoDB |
| SB-221 | 去重 | 同图不创建重复交易 |
| SB-222 | 手动触发 | Admin Panel 手动触发成功 |

#### Frontend: Dashboard (SC-9xx)
| ID | 场景 | 预期 |
|----|------|------|
| SC-900 | 加载仪表盘 | 显示今日汇总 |
| SC-901 | 空日期 | 无交易显示零值 |
| SC-902 | 收入显示 | 正确收入金额 |
| SC-903 | 支出显示 | 正确支出金额 |
| SC-904 | 净利润 | 净值 = 收入 - 支出 |
| SC-910 | 待确认数 | 正确显示待确认数量 |
| SC-920 | 队列空 | 显示"Ready"状态 |
| SC-921 | 队列活跃 | 显示数量和状态 |

#### Frontend: Transaction/Ledger (SC-8xx)
| ID | 场景 | 预期 |
|----|------|------|
| SC-800 | 加载交易 | 按日期降序显示 |
| SC-801 | 空状态 | 显示"无记录" |
| SC-805 | 按类型筛选 | 选择 income/expense | 只显示该类型 |
| SC-806 | 按分类筛选 | 选择 sale/purchase 等 | 只显示该分类 |
| SC-807 | 组合筛选 | 年+月+类型 | 全部正确应用 |
| SC-810 | 确认交易 | confirmedAt 设置，标签移除 |
| SC-811 | 删除交易 | 确认对话框后删除 |
| SC-820 | 收入合计 | 正确收入总和 |
| SC-821 | 支出合计 | 正确支出总和 |

#### Frontend: Report History (SC-9xx)
| ID | 场景 | 预期 |
|----|------|------|
| SC-930 | 日历视图 | 显示带交易指示的日历 |
| SC-931 | 选择历史日期 | 点击日历日期显示该日报告 |
| SC-932 | 月度汇总 | 点击月份头部显示月汇总 |
| SC-933 | 月份导航 | 点击前/后箭头切换月份 |
| SC-934 | 空日期 | 点击无交易日期显示空状态 |

#### Offline CRUD (SC-3xx, 从 MVP2 移入)
| ID | 场景 | 预期 |
|----|------|------|
| SC-304 | 离线查看交易 | 断网→打开 Ledger，本地交易显示 |
| SC-305 | 离线查看仪表盘 | 断网→打开 Dashboard，本地汇总显示 |
| SC-306 | 离线确认交易 | 断网→确认交易，本地 DB 更新，同步队列 |
| SC-307 | 离线删除交易 | 断网→删除交易，本地删除，同步队列 |

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

**Backend (Instant Mode)** - Tested 2026-01-09:
- [x] 上传的收据被 AI 正确解析 ✅ (2 张测试成功)
- [x] instant-processor Lambda 触发正常 ✅ (S3 event → Lambda)
- [x] Bedrock Nova Lite OCR 提取准确 ✅ (merchant, amount, date)
- [x] Transaction 写入 DynamoDB ✅ (2 条记录确认)
- [x] 图片移动到 processed/ ✅ (uploads/ 清空)
- [x] Quota 追踪正常 ✅ (今日 2/50)
- [x] 配置管理正常 ✅ (ConfigLambda + Control Table)
- [x] Admin Panel 可访问 ✅ (CloudFront + Cognito)
- [x] **SB-210: OCR 质量测试** ✅
  - Transaction 1 (ヤマト運輸): merchant ✅, amount ✅, category ✅, date ✅
  - Transaction 2 (KFC): merchant ✅, amount ✅, category ✅, date ✅
  - Accuracy: 2/2 = 100% (manual verification)
  - Note: Confidence scores not available (Bedrock Nova Lite limitation)
- [x] **SB-220: Admin Config 生效测试** ✅
  - Control Table has batch_config: ✅
  - Lambda reads modelId from config: ✅ (code verified: lines 84-98)
  - Processing uses configured model: ✅ (successful OCR)
- [ ] SB-203: Batch 模式 (跳过 - 需 100+ 张图片)

**Frontend (Local-First)** - Pending:
- [ ] 晨报显示昨日汇总 (#114)
- [ ] 可以确认/编辑/删除交易 (#116) (**本地确认，云端同步在 MVP3.5**)
- [ ] 历史日历可以查看过去 7 天 (#117)
- [ ] 所有 SC-304~307 通过 (Offline CRUD) (#118)
- [ ] 所有 SC-800~821 通过 (Transaction/Ledger) (#115)
- [ ] 所有 SC-900~921 通过 (Dashboard) (#114)
- [ ] 所有 SC-930~934 通过 (Report History) (#117)

**Test Summary**:
- **Tested**: 2026-01-09
- **Images Processed**: 2 (ヤマト運輸 ¥1,500, KFC ¥1,950)
- **Processing Time**: ~1.1-1.7s per image
- **Lambda Functions**: 8/8 deployed ✅
- **DynamoDB Tables**: 5/5 created ✅
- **S3 Buckets**: 2/2 configured ✅
- **S3 Event Notifications**: uploads/ ✅, batch-output/ ✅

**Known Limitations**:
- Batch mode requires 100+ images (AWS Bedrock Batch Inference minimum)
- Transaction viewing requires cloud sync (Issue #108) or Admin Panel (Issue #107)

> **Note**: MVP3 中的确认/编辑/删除只写入本地 SQLite。云端同步（写入 DynamoDB）在 MVP3.5 实现。

### 依赖

**Lambda Functions** (按模式):

| Lambda | Instant | Batch | Hybrid | 说明 |
|--------|---------|-------|--------|------|
| `presign` | ✅ | ✅ | ✅ | S3 上传签名 |
| `instant-processor` | ✅ | ❌ | ✅ | On-Demand 处理 (新增) |
| `batch-counter` | ❌ | ✅ | ✅ | 图片计数 + 阈值检测 (新增) |
| `batch-orchestrator` | ❌ | ✅ | ✅ | Batch Job 编排 (新增) |
| `batch-result-handler` | ❌ | ✅ | ✅ | 结果处理 (新增) |
| `admin/batch-config` | ✅ | ✅ | ✅ | Admin 配置 API (新增) |

**AWS Resources**:
- S3: `yorutsuke-images-dev` (uploads/, processed/, batch-input/, batch-output/)
- DynamoDB: `yorutsuke-transactions-dev` (AI 写入)
- DynamoDB: `yorutsuke-control-dev` (batch_config 存储)
- DynamoDB: `yorutsuke-batch-jobs-dev` (Job 状态跟踪, 新增)
- Bedrock: Nova Lite (Cross-region Inference Profile, Batch API)

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

从 [FRONTEND.md](../tests/FRONTEND.md) Section 15 选取：

#### 15.1 Confirmation Sync
| ID | 场景 | 预期 |
|----|------|------|
| SC-1500 | 确认同步到云端 | DynamoDB 有 confirmedAt |
| SC-1501 | 修改后同步 | 云端有更新后的金额 |
| SC-1502 | 删除同步到云端 | 云端标记为已删除 |
| SC-1503 | 离线确认入队 | 同步队列，显示 pending |
| SC-1504 | 恢复网络后处理 | 队列中的同步完成 |

#### 15.2 Data Recovery
| ID | 场景 | 预期 |
|----|------|------|
| SC-1510 | 新设备检测 | 显示"发现云端数据" |
| SC-1511 | 恢复确认数据 | 已确认交易恢复到 SQLite |
| SC-1512 | 拒绝恢复 | 从头开始，云端数据不变 |
| SC-1513 | 合并恢复 | 本地+云端合并，无重复 |

#### 15.3 Conflict Resolution
| ID | 场景 | 预期 |
|----|------|------|
| SC-1520 | 最后写入优先 | 两设备编辑，新时间戳覆盖 |
| SC-1521 | 离线冲突 | 离线编辑→同步→冲突，新版本生效 |

### 环境配置

```bash
# 需要新增 Lambda: transactions-sync
cd infra
cdk deploy YorutsukeTransactionSyncStack --profile dev

# 配置 Sync API
cd app
echo "VITE_LAMBDA_SYNC_URL=https://xxx.lambda-url.us-east-1.on.aws" >> .env.local
npm run tauri dev
```

### 验收标准

- [ ] 确认交易后 DynamoDB 有记录
- [ ] 修改交易后云端数据更新
- [ ] 删除交易后云端标记删除
- [ ] 离线确认，恢复后自动同步
- [ ] 新设备登录可恢复已确认交易
- [ ] 本地和云端数据一致
- [ ] 所有 SC-1500~1504 通过 (Confirmation Sync)
- [ ] 所有 SC-1510~1513 通过 (Data Recovery)
- [ ] 所有 SC-1520~1521 通过 (Conflict Resolution)

### 依赖

- Lambda: `transactions-sync` (新增)
- DynamoDB: `yorutsuke-transactions-dev` (读写)
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
