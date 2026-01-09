# #99 开放问题确认 (Open Questions Resolved)

**日期**: 2026-01-09  
**来源**: [batch-result-handler-PLAN.md](#99-plan-batch-result-handler-lambda) 第 481-492 行  
**验证范围**: 代码库扫描 + 架构文档阅读

---

## 📋 问题清单

### ✅ 问题 #1: pending-images 表 schema

**原问题**: 是否已包含 `s3Key` 字段？若无，需在 presign/instant-processor 时补充。

**调查结果**:
- ✅ **已确认**: `s3Key` 字段存在且正常使用
- **来源**: 
  - [infra/lambda/presign/index.mjs](infra/lambda/presign/index.mjs#L280) - 生成 `key = uploads/{userId}/{timestamp}-{filename}`
  - [infra/lambda/instant-processor/index.mjs](infra/lambda/instant-processor/index.mjs#L42) - 从 S3 event 中提取 `key` 作为 `imageId`
- **Schema 定义**:
  ```typescript
  // 隐式 schema（在 presign Lambda 中）
  {
    imageId: string,           // 从 s3Key 提取: uploads/{userId}/{imageId}
    s3Key: string,             // "uploads/{userId}/{timestamp}-{filename}"
    userId: string,
    uploadedAt: string (ISO),
    status: "pending" | "processed"
  }
  ```

**实施建议**:
- ✅ 无需补充 `s3Key` - 现有代码已覆盖
- 但建议在 CDK 中显式定义 `pending-images` DynamoDB 表（当前为隐式，仅在 Lambda env var 中引用）
- **优先级**: LOW (非阻塞)

---

### ✅ 问题 #2: Bedrock 输出格式

**原问题**: 实际格式是 `batch-output/{jobId}/output.jsonl` 还是其他？是否压缩？

**调查结果**:
- ✅ **已确认**: Bedrock Batch Inference 输出格式
- **来源**: [infra/lambda/batch-orchestrator/index.mjs](infra/lambda/batch-orchestrator/index.mjs#L192-200)
  ```typescript
  const response = await bedrock.send(new CreateModelInvocationJobCommand({
    jobName,
    modelId,  
    inputDataConfig: {
      s3InputDataConfig: { s3Uri: manifestUri }
    },
    outputDataConfig: {
      s3OutputDataConfig: { s3Uri: `s3://${BUCKET_NAME}/batch-output/` }
    }
  }));
  ```

**实际输出格式**:
- **路径**: `s3://{BUCKET}/batch-output/{jobId}/output.jsonl`
- **格式**: JSONL (JSON Lines, 每行一个 JSON object)
- **内容** (每行一个):
  ```json
  {
    "customData": "imageId",
    "output": {
      "text": "{\"amount\":1500,...}"  // AI 结果 JSON 字符串
    }
  }
  ```
- **压缩**: ❌ 无压缩（纯文本 JSONL）

**实施建议**:
- ✅ 确认 Plan 中的流式解析逻辑正确
- 使用 readline 逐行读取 + JSON.parse 每行
- **示例代码** (已在 Plan 中给出):
  ```typescript
  const readline = require('readline');
  const rl = readline.createInterface({ input: s3Stream.Body });
  for await (const line of rl) {
    const item = JSON.parse(line);  // Parse JSONL
    const { customData: imageId, output } = item;
    // 处理 output
  }
  ```

**优先级**: CRITICAL (实施必需)

---

### ✅ 问题 #3: transaction 表 schema

**原问题**: `userId` 字段是否存在？如何从 jobId 获取 userId？

**调查结果**:
- ✅ **已确认**: transactions 表 schema 完整定义
- **来源**: [docs/architecture/SCHEMA.md](docs/architecture/SCHEMA.md#cloud-tables-dynamodb)

**DynamoDB transactions 表 schema**:
```typescript
interface CloudTransaction {
  userId: string;              // PK (Partition Key)
  transactionId: string;       // SK (Sort Key)
  s3Key: string;               // 原始图片 S3 路径
  amount: number | null;
  merchant: string | null;
  category: string | null;
  receiptDate: string | null;
  aiConfidence: number | null;
  aiResult: object | null;     // 完整 AI 响应
  status: string;              // 'uploaded'|'processing'|'processed'|'failed'|'skipped'
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
}
```

**如何获取 userId?**
- ✅ **从 batch-jobs 表查询**:
  ```typescript
  // 1. batch-orchestrator 将 userId 记录在 batch-jobs 表中
  // infra/lambda/batch-orchestrator/index.mjs: recordJobMetadata()
  const jobData = {
    intentId,     // PK
    jobId,        // GSI key
    userId,       // ← 这里存储了 userId
    status: "SUBMITTED",
    pendingImageCount: imageCount,
    ...
  };
  
  // 2. batch-result-handler 通过 jobId 查询 userId
  // 使用 jobIdIndex GSI
  const jobRecord = await ddb.send(new QueryCommand({
    TableName: BATCH_JOBS_TABLE,
    IndexName: "jobIdIndex",
    KeyConditionExpression: "jobId = :jobId",
    ExpressionAttributeValues: marshall({ ':jobId': jobId })
  }));
  const { userId } = unmarshall(jobRecord.Items[0]);
  ```

**实施建议**:
- ✅ userId 可从 batch-jobs 表通过 jobId GSI 查询
- 建议在 batch-result-handler 早期步骤获取 userId
- **代码已给出** (在 Plan 改进 #5 中)

**优先级**: CRITICAL (实施必需)

---

### ✅ 问题 #4: 错误恢复策略

**原问题**: 失败交易存 `failed-transactions` 表还是 S3？

**调查结果**:
- ❌ **不存在** `failed-transactions` 表定义
- ⚠️ **需要决策**: 错误处理策略
- **参考**: [batch-result-handler-PLAN.md](batch-result-handler-PLAN.md#错误处理策略) 第 320-345 行

**现有错误处理模式**:

**Instant-processor 的错误处理** (参考):
```typescript
// infra/lambda/instant-processor/index.mjs (L150)
try {
    // ... OCR processing
} catch (zodError) {
    logger.error(EVENTS.AIRLOCK_BREACH, { userId, imageId, error: zodError.message });
    continue;  // 跳过单条，继续下一条
}
```

**建议方案**:
| 错误类型 | 处理方式 | 存储位置 | 优先级 |
|--------|---------|---------|--------|
| S3 GetObject 失败 | 整个 Lambda 失败，DLQ 重试 | CloudWatch DLQ | MVP3.1 (SQS DLQ) |
| Bedrock JSON 格式错 | 跳过单条，记录 WARN，继续 | CloudWatch Logs | MVP3 |
| DynamoDB 写入失败 | 指数退避重试（3 次），最后失败 | CloudWatch DLQ | MVP3 |
| 文件迁移失败 | 记录失败，源文件保留 | S3 `dead-letters/` + CloudWatch | MVP3.1 |

**实施建议**:
- ✅ **MVP3**: 仅用 CloudWatch Logs 记录，不创建额外表
- ✅ **MVP3.1**: 添加 SQS DLQ (自动队列，不需创建 `failed-transactions` 表)
- 失败交易可写 S3 `dead-letters/{jobId}/{timestamp}.jsonl` (备份)

**优先级**: MEDIUM (MVP3 可暂缺，MVP3.1 添加)

---

### ✅ 问题 #5: TTL 策略

**原问题**: Transaction 记录多久后自动清理？

**调查结果**:
- ✅ **已定义**: TTL 配置存在
- **来源**: [infra/lib/yorutsuke-stack.ts](infra/lib/yorutsuke-stack.ts#L52)
  ```typescript
  const transactionsTable = new dynamodb.Table(this, "TransactionsTable", {
    tableName: `yorutsuke-transactions-${env}`,
    timeToLiveAttribute: "ttl",  // ← TTL 已启用
  });
  ```

**TTL 值**:
- **Guest 用户**: 60 天后自动删除
- **Account 用户**: 无 TTL（永久保留）
- **Batch-jobs 表**: 7 天 TTL (用于清理临时数据)
- **Batch-output/**: 30 天 lifecycle (S3 bucket 配置)

**代码验证**:
```javascript
// instant-processor: Guest TTL
const GUEST_TTL_DAYS = 60;
function getGuestTTL() {
    return Math.floor(Date.now() / 1000) + GUEST_TTL_DAYS * 24 * 60 * 60;
}

// batch-orchestrator: Batch-jobs TTL
ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
```

**实施建议**:
- ✅ 无需额外配置 - TTL 已在 CDK 中启用
- batch-result-handler 应遵循相同 TTL 逻辑:
  ```typescript
  const ttl = isGuestUser(userId) 
    ? Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60  // 60 days
    : Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year
  
  // 写入时添加 ttl 字段
  const transaction = {
    userId,
    transactionId,
    ttl,  // ← DynamoDB 自动清理
    ...
  };
  ```

**优先级**: MEDIUM (可选，推荐加)

---

### ✅ 问题 #6: Timezone 处理

**原问题**: 日期处理用 UTC 还是 JST（`processed/2026-01-09/`）？

**调查结果**:
- ✅ **已确定**: JST (UTC+9) 用于日期分组
- **来源**: [infra/lambda/presign/index.mjs](infra/lambda/presign/index.mjs#L50-57)
  ```typescript
  function getJSTDate() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);  // YYYY-MM-DD
  }
  ```

**Timezone 一致性**:
| 组件 | Timezone | 目的 |
|------|----------|------|
| presign Lambda | JST | 配额日期切换 (00:00 JST) |
| 文件路径 | JST | `uploads/{userId}/2026-01-09/...` |
| batch-orchestrator | UTC | Manifest timestamp |
| instant-processor | UTC | Transaction createdAt |
| batch-result-handler | 应用 JST | 文件迁移路径 `processed/2026-01-09/` |

**实施建议**:
- ✅ 使用 JST 作为日期分组基准（与 presign 保持一致）
- 使用 UTC 作为时间戳（ISO 8601）
- batch-result-handler 实施:
  ```typescript
  function getJSTDate() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);  // YYYY-MM-DD (JST-based)
  }
  
  // 文件迁移
  const destKey = `processed/${getJSTDate()}/${imageName}`;
  await s3.send(new CopyObjectCommand({
    Bucket: BUCKET_NAME,
    CopySource: `${BUCKET_NAME}/${sourceKey}`,
    Key: destKey,
  }));
  ```

**优先级**: LOW (可选，代码示例已给出)

---

## 🎯 实施优先级总结

| # | 问题 | 状态 | MVP3 需要 | 优先级 | 决策 |
|---|------|------|----------|--------|------|
| 1 | pending-images s3Key | ✅ 已存在 | ❌ 无 | LOW | 无需补充 |
| 2 | Bedrock 输出格式 | ✅ 已确认 | ✅ 必需 | 🔴 CRITICAL | JSONL + 流式解析 |
| 3 | transaction userId | ✅ 已确认 | ✅ 必需 | 🔴 CRITICAL | 通过 jobId GSI 查询 |
| 4 | 错误恢复 | ⚠️ 需决策 | ⚠️ 部分 | 🟡 MEDIUM | CloudWatch + SQS DLQ (MVP3.1) |
| 5 | TTL 策略 | ✅ 已定义 | ❌ 可选 | 🟡 MEDIUM | Guest=60天，Account=永久 |
| 6 | Timezone | ✅ 已定义 | ❌ 可选 | 🟢 LOW | 用 JST 作为日期分组 |

---

## 📝 结论

### ✅ 已解决的问题 (5/6)
- 问题 #1-3, #5-6 已在现有代码库中完整定义
- 无阻塞实施的技术障碍

### ⚠️ 需要决策的问题 (1/6)
- 问题 #4 (错误恢复): 建议按 Plan 中的分阶段方案
  - MVP3: CloudWatch Logs 记录
  - MVP3.1: SQS DLQ + CloudWatch 告警

### 🚀 实施准备

**立即可进行**:
- ✅ 编码 batch-result-handler Lambda (所有信息完整)
- ✅ 集成 4 core improvements (改进 #1, #4, #5, #7)
- ✅ 单元 + 集成测试

**待后续验证**:
- ⚠️ Bedrock 实际输出格式 (可用 stage 环境测试)
- ⚠️ batch-jobs 表的 userId 查询性能 (可用预期负载测试)

---

## 🔗 参考文档

| 文档 | 路径 | 用途 |
|------|------|------|
| SCHEMA.md | [docs/architecture/SCHEMA.md](docs/architecture/SCHEMA.md) | 完整数据模型定义 |
| batch-orchestrator | [infra/lambda/batch-orchestrator/index.mjs](infra/lambda/batch-orchestrator/index.mjs) | Bedrock 输出格式参考 |
| presign Lambda | [infra/lambda/presign/index.mjs](infra/lambda/presign/index.mjs) | s3Key/imageId 生成逻辑 |
| CDK Stack | [infra/lib/yorutsuke-stack.ts](infra/lib/yorutsuke-stack.ts) | TTL/表定义 |
| MVP3 Plan | [batch-result-handler-PLAN.md](batch-result-handler-PLAN.md) | 完整实施计划 |

