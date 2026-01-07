# MVP3 - 夜间处理 (Batch + Report)

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

从 [FRONTEND.md](../tests/FRONTEND.md) 和 [BACKEND.md](../tests/BACKEND.md) 选取：

#### Backend: Batch Processing (SB-2xx)
| ID | 场景 | 预期 |
|----|------|------|
| SB-200 | 定时触发 | EventBridge 02:00 JST 触发 |
| SB-201 | 手动触发 | Lambda 直接调用成功 |
| SB-202 | 空队列 | 无 pending 图片时跳过 |
| SB-210 | 清晰收据 | 提取商户、金额、分类 |
| SB-211 | 模糊收据 | 低置信度 (<0.7) |
| SB-220 | 创建交易 | OCR 结果写入 DynamoDB |
| SB-221 | 去重 | 同图不创建重复交易 |

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

- [ ] 上传的收据被 AI 正确解析
- [ ] 晨报显示昨日汇总
- [ ] 可以确认/编辑/删除交易 (**本地确认，云端同步在 MVP3.5**)
- [ ] 历史日历可以查看过去 7 天
- [ ] 所有 SB-200~221 通过 (Backend Batch)
- [ ] 所有 SC-304~307 通过 (Offline CRUD)
- [ ] 所有 SC-800~821 通过 (Transaction/Ledger)
- [ ] 所有 SC-900~921 通过 (Dashboard)
- [ ] 所有 SC-930~934 通过 (Report History)

> **Note**: MVP3 中的确认/编辑/删除只写入本地 SQLite。云端同步（写入 DynamoDB）在 MVP3.5 实现。

### 依赖

- Lambda: `presign`, `batch`, `batch-process`
- S3: `yorutsuke-images-dev`
- DynamoDB: `yorutsuke-transactions-dev` (只读，AI 写入)
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
