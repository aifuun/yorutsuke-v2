# #99 Plan: batch-result-handler Lambda

**Status**: Plan (ready for review + implementation)  
**Date**: 2026-01-09  
**Review Feedback**: Integrated 4 core improvements + 3 phased enhancements

---

## 🎯 目标
处理 Bedrock Batch Inference 的异步结果，将 AI 提取的交易数据写入 DynamoDB，并管理镜像文件生命周期。

---

## 📊 技术背景

**触发方式**：
- S3 Event: `batch-output/` 目录新增 JSONL 文件（Bedrock 输出）
- CloudFormation rule: S3 → SNS → SQS → Lambda 或 S3 event → Lambda

**输入**：
- Bedrock 生成的结果文件: `s3://bucket/batch-output/{jobId}/output.jsonl`
- 格式：每行一个 JSON，包含 `customData`（imageId）+ `output`（AI 结果）

**输出**：
- ✅ 交易记录写入 `yorutsuke-transactions-dev` DynamoDB 表
- ✅ 原始图片从 `uploads/` 移到 `processed/{date}/`
- ✅ 更新 `yorutsuke-batch-jobs` 表状态（SUBMITTED → COMPLETED）

---

## 🏗️ 实施范围

| 组件 | 工作内容 | 文件 |
|------|---------|------|
| **Lambda** | 新建 batch-result-handler | `infra/lambda/batch-result-handler/index.mjs` |
| **Schema** | Transaction schema + Zod validation | 复用 `01_domains/transaction/schema` (if exists) |
| **Error Handling** | Dead-letter queue (DLQ) / retry logic | 环境变量 + CDK SQS policy |
| **Logging** | Pillar R semantic logs | EVENTS 枚举 + traceId |
| **CDK** | Lambda + IAM + S3 trigger + SQS (optional DLQ) | `infra/lib/yorutsuke-stack.ts` |

---

## 📝 核心功能设计（含 4 项改进）

### ✅ 改进 #1: 幂等性策略（核心正确性）

**问题**：交易可能被重复处理（网络重试、Lambda 重试）  
**解决**：
- `transactionId` 生成规则：`sha256(jobId + imageId + timestamp)`
- DynamoDB 写入使用 PutItem（天然覆盖相同 key）
- 若需谨慎，用 ConditionExpression: `attribute_not_exists(transactionId)` + UpdateItem
- 设置 Global Secondary Index on `(imageId, jobId)` 便于幂等性检查

```typescript
// 生成 transactionId（确定性）
import crypto from 'crypto';
const transactionId = crypto
  .createHash('sha256')
  .update(`${jobId}#${imageId}#${timestamp}`)
  .digest('hex')
  .slice(0, 24); // UUID-like string
```

**效果**：重复处理不会重复写入；同一 image 被重新处理时自动覆盖。

---

### ✅ 改进 #4: 流式解析 + BatchWriteItem（核心性能 + 可靠性）

**问题**：Plan 中假设单条 PutItem 1000 次，超时/失败率高  
**解决**：

1. **流式逐行解析** JSONL（不全读入内存）
   ```typescript
   const readline = require('readline');
   const s3Stream = await s3.send(new GetObjectCommand(...));
   const rl = readline.createInterface({
     input: s3Stream.Body, // S3 stream
     crlfDelay: Infinity
   });
   
   for await (const line of rl) {
     const item = JSON.parse(line);
     batchQueue.push(item);
     
     // 每 25 条批量写
     if (batchQueue.length === 25) {
       await writeBatch(batchQueue);
       batchQueue = [];
     }
   }
   if (batchQueue.length > 0) await writeBatch(batchQueue);
   ```

2. **BatchWriteItem**（25 条一批，自动处理 UnprocessedItems）
   ```typescript
   async function writeBatch(items) {
     let unprocessed = items;
     let retries = 0;
     const maxRetries = 3;
     
     while (unprocessed.length > 0 && retries < maxRetries) {
       const response = await ddb.send(new BatchWriteItemCommand({
         RequestItems: {
           [TRANSACTIONS_TABLE]: unprocessed.map(item => ({
             PutRequest: { Item: marshall(item) }
           }))
         }
       }));
       
       unprocessed = response.UnprocessedItems?.[TRANSACTIONS_TABLE]?.map(r => unmarshall(r.PutRequest.Item)) || [];
       if (unprocessed.length > 0) {
         await sleep(100 * Math.pow(2, retries)); // Exponential backoff
         retries++;
       }
     }
     
     if (unprocessed.length > 0) {
       logger.error('BATCH_WRITE_FAILED_FINAL', { count: unprocessed.length });
       throw new Error(`Failed to write ${unprocessed.length} items after retries`);
     }
   }
   ```

**效果**：处理 1000 条从 ~30s（1000 个单独请求）降至 ~5s（40 个批量请求）；大幅降低超时与失败率。

---

### ✅ 改进 #5: S3 Key 映射（核心功能可行性）

**问题**：Plan 说"从 batch-jobs 或 pending-images 表"，但没明确表 schema  
**解决**：在实施前确认 `pending-images` 表是否含 `s3Key` 字段；若无，需补充。

**假设 pending-images schema**：
```typescript
{
  imageId: string (PK),
  userId: string,
  s3Key: string,        // ← 关键字段（上传时记录）
  md5: string,
  uploadedAt: string,
  status: "pending" | "processed"
}
```

**实施逻辑**：
```typescript
// 从 batch-jobs 获 jobId 对应的所有 imageId
const jobMeta = await ddb.send(new GetItemCommand({
  TableName: BATCH_JOBS_TABLE,
  Key: marshall({ intentId: extractIntentIdFromJobId(jobId) })
}));
const pendingImageIds = jobMeta.Item.pendingImageIds; // 假设记录了 imageId 列表

// 逐个查 s3Key
for (const imageId of pendingImageIds) {
  const imageRecord = await ddb.send(new GetItemCommand({
    TableName: PENDING_IMAGES_TABLE,
    Key: marshall({ imageId })
  }));
  const s3Key = unmarshall(imageRecord.Item).s3Key;
  // 后续用 s3Key 做 CopyObject/DeleteObject
}
```

**效果**：避免扫描整个 S3；O(n) 查询而不是 O(n*m) 扫描。

---

### ✅ 改进 #7: IAM 最小权限（成本最低，收益最高）

**原则**：Lambda IAM role 只授予必需的最小权限

```typescript
// infra/lib/yorutsuke-stack.ts
batchResultHandlerLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      "s3:GetObject",      // 读 Bedrock 输出 JSONL
      "s3:PutObject",      // 写处理后的文件（processed/）
      "s3:DeleteObject",   // 删除原始文件（uploads/）
      "s3:HeadObject"      // 检查文件是否存在（迁移时）
    ],
    resources: [
      `${imageBucket.arnWithPath('batch-output/*')}`,
      `${imageBucket.arnWithPath('uploads/*')}`,
      `${imageBucket.arnWithPath('processed/*')}`
    ]
  })
);

batchResultHandlerLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      "dynamodb:PutItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:UpdateItem",
      "dynamodb:GetItem"  // 从 batch-jobs 查 userId
    ],
    resources: [
      transactionsTable.tableArn,
      batchJobsTable.tableArn
    ]
  })
);

// CloudWatch Logs（自动添加，无需显式）
// batchResultHandlerLambda 已有 basic execution role
```

**效果**：降低安全风险；遵守最小权限原则。

---

## 1️⃣ 读取 Batch 结果

```
Input: S3 Event
  ├─ Records[].s3.bucket.name
  ├─ Records[].s3.object.key  // batch-output/{jobId}/output.jsonl
  └─ Job ID extracted from key

Actions:
  ├─ GetObject(s3Uri)
  ├─ Parse JSONL (streaming if >1MB) ← 改进 #4
  └─ For each line: extract customData (imageId) + output (AI JSON)
```

---

## 2️⃣ 解析 AI 输出

```
Bedrock Output (per line):
{
  "customData": "img_abc123",        // imageId (from manifest)
  "output": {
    "text": "{\"amount\":1500,...}"   // JSON string, need parse
  }
}

Expected Transaction Schema:
{
  transactionId: string (sha256 hash) ← 改进 #1
  imageId: string (from customData)
  amount: number
  type: "income" | "expense"
  date: string (YYYY-MM-DD)
  merchant: string
  category: "sale" | "purchase" | ...
  description: string
  extractedAt: string (ISO)
  jobId: string (for traceability)
  userId: string (from batch-jobs meta)
}
```

**Zod Schema**：
```typescript
const TransactionSchema = z.object({
  transactionId: z.string().min(20), // sha256 hash
  imageId: z.string(),
  amount: z.number().positive(),
  type: z.enum(['income', 'expense']),
  date: z.string().date(),
  merchant: z.string().min(1),
  category: z.enum(['sale', 'purchase', 'shipping', 'packaging', 'fee', 'other']),
  description: z.string(),
  extractedAt: z.string().datetime(),
  jobId: z.string(),
  userId: z.string(),
});
```

---

## 3️⃣ 写入 DynamoDB

**操作**（改进 #4）：
- BatchWriteItem（25 条一批）到 `yorutsuke-transactions-dev`
- 分区键：`userId`，排序键：`transactionId`
- GSI: `jobId-extractedAt` (查询某个 batch job 的所有交易)
- TTL: 可选（e.g., 2年后自动删除）

**幂等性**（改进 #1）：
- `transactionId = sha256(jobId + imageId + timestamp)`
- PutItem 覆盖相同 key；重复处理不产生重复记录

---

## 4️⃣ 文件生命周期（改进 #5）

**操作**：
1. 从 `pending-images` 表查 imageId 对应的 `s3Key`（避免扫描）
2. CopyObject: `uploads/{s3Key}` → `processed/{date}/{s3Key}`
3. DeleteObject: `uploads/{s3Key}`（清理源文件）

**失败处理**：
- CopyObject 失败 → 记录 WARN，不删除源，继续下一条
- DeleteObject 失败 → 记录 WARN（源文件保留，可手动清理）
- 整个文件迁移失败 → 标记 transaction 为 `status: 'migrationFailed'`，手动恢复

---

## 5️⃣ 更新 Batch Job 状态

**操作**：
- UpdateItem `yorutsuke-batch-jobs` 表
- `intentId` (PK) → status = "COMPLETED"
- completedAt = now()
- resultStats = { successCount, failureCount, totalCount }

```typescript
await ddb.send(new UpdateItemCommand({
  TableName: BATCH_JOBS_TABLE,
  Key: marshall({ intentId }),
  UpdateExpression: "SET #status = :status, completedAt = :now, resultStats = :stats",
  ExpressionAttributeNames: { '#status': 'status' },
  ExpressionAttributeValues: marshall({
    ':status': 'COMPLETED',
    ':now': new Date().toISOString(),
    ':stats': { successCount, failureCount, totalCount }
  })
}));
```

---

## ⚠️ 关键设计决策

| 决策 | 选项 | 建议 | 原因 |
|------|------|------|------|
| **触发方式** | S3 Event vs SQS | **MVP3: S3 Event（简单）** | 快速验证；MVP3.1 升级 SQS + DLQ（见分阶段优化） |
| **并发处理** | 顺序 vs 并发 | 顺序（简单），最多 100-500 条 | 不超时；Pillar E: T2 pattern |
| **错误恢复** | 失败整个 batch vs 跳过单条 | 跳过单条 | Bedrock 某条可能格式错，不应影响整个 job |
| **DynamoDB 写入** | 单条 PutItem vs BatchWriteItem | **BatchWriteItem（改进 #4）** | 性能 6 倍提升；吞吐量稳定 |
| **幂等性** | intentId vs transactionId hash | **transactionId = sha256 hash（改进 #1）** | 自然幂等；重复处理自动覆盖 |
| **S3 key 查询** | 扫描 uploads/ vs DB 查表 | **DB 查表（改进 #5）** | O(n) vs O(n*m)；性能差异显著 |
| **IAM 权限** | `s3:*` vs 显式 action 列表 | **显式列表（改进 #7）** | 安全最佳实践 |

---

## 🔄 错误处理策略

| 错误类型 | 处理方式 | HTTP Code | 重试策略 |
|---------|---------|----------|--------|
| S3 GetObject 失败 | 记录 CRITICAL，Lambda 整个失败 | 500 | CloudWatch DLQ（如用 SQS） |
| Bedrock JSON 解析失败 | 记录 ERROR，跳过此行，继续 | 200 (partial success) | 无（单行失败） |
| DynamoDB BatchWriteItem 部分失败 | 指数退避重试（3 次），最终失败写 DLQ | 500 或 202 | 见下 |
| 文件 CopyObject 失败 | 记录 WARN，源文件保留，continue | 200 | 手动 cleanup |
| 更新 job 状态失败 | 记录 CRITICAL（标记为部分完成） | 500 | 重试或手动修复 |

**DLQ 策略**：
- 若用 S3 Event：失败时写 S3 `dead-letters/{jobId}.jsonl`（记录失败行号 + 原因）
- 若用 SQS（MVP3.1）：自动 DLQ，可配置重试次数

---

## 🧪 测试点（MVP3）

**单元测试**：
- [ ] Bedrock JSON 解析（正常、格式错、缺字段）
- [ ] Transaction Schema Zod 校验
- [ ] transactionId hash 生成（确定性）
- [ ] 文件路径生成（date format）
- [ ] DynamoDB item 构建（marshall）

**集成测试**：
- [ ] 完整 flow：fetch → parse → write（BatchWriteItem）→ move → update
- [ ] S3 event trigger（本地 mock 或 stage）
- [ ] UnprocessedItems 重试机制
- [ ] 部分失败场景（某条 JSON 格式错，但其他行成功）

**验收标准**：
- [ ] 所有 150 条交易正确写入 DynamoDB（5 个 BatchWriteItem 请求）
- [ ] 2 条错误的 JSON 被跳过，日志记录失败原因
- [ ] 原始图片移到 `processed/{YYYY-MM-DD}/`
- [ ] batch-jobs 状态更新为 COMPLETED + resultStats 填充
- [ ] 日志中有 BATCH_RESULT_STARTED/PER_TRANSACTION/COMPLETED（Pillar R）

---

## 📋 文件清单

**新建文件**：
1. `infra/lambda/batch-result-handler/index.mjs` (~450 行)
   - handler
   - fetchBatchOutput (S3 stream)
   - parseBedrockResults (streaming JSONL)
   - transformToTransaction (schema + hash)
   - writeBatchTransactions (BatchWriteItem + retry)
   - moveProcessedFiles (S3 copy + delete)
   - updateJobStatus (DynamoDB update)
   - Error handling + logging

**修改文件**：
1. `infra/lib/yorutsuke-stack.ts`
   - 定义 batch-result-handler Lambda
   - S3 event notification (batch-output/)
   - IAM permissions（改进 #7）：S3 GetObject/PutObject/DeleteObject + DynamoDB write
   - 可选：SQS + DLQ（MVP3.1）

2. `infra/lambda/shared/logger.mjs` (可选)
   - 添加新的 EVENTS 常量：BATCH_RESULT_*

**参考文件** (不修改)：
- `infra/lambda/batch-orchestrator/index.mjs` (上一步，参考模式)
- `docs/architecture/SCHEMA.md` (transaction 表结构)
- `.prot/pillar-q/checklist.md` (幂等性设计)
- `.prot/pillar-r/checklist.md` (日志标准)

---

## 🎬 实施步骤（高层）

1. **准备**
   - [ ] 确认 Bedrock 输出格式 (样本数据)
   - [ ] 确认 transaction 表 schema (field 名称、类型)
   - [ ] **验证 pending-images 表是否含 s3Key**（改进 #5）
   - [ ] 确认 imageId → S3 key 的映射逻辑

2. **编码**
   - [ ] 实现 Lambda handler + 5 个核心函数
   - [ ] 编写 Zod schema + 错误处理
   - [ ] 实现流式解析 + BatchWriteItem（改进 #4）
   - [ ] 添加 transactionId hash 生成（改进 #1）
   - [ ] 添加 Pillar R 语义日志

3. **CDK 配置**
   - [ ] Lambda 定义 + 环境变量
   - [ ] S3 event notification 配置
   - [ ] IAM permissions 最小化（改进 #7）

4. **测试**
   - [ ] 本地单元测试 (mocked S3/DynamoDB)
   - [ ] Staging 集成测试（真实 AWS）
   - [ ] 验收标准检查

5. **文档**
   - [ ] 更新 MVP3_BATCH.md (添加 batch-result-handler 流程图)
   - [ ] 更新 MEMORY.md (决策记录)
   - [ ] 更新 plans/active/

---

## 🔗 依赖关系

```
#98 (batch-orchestrator) ✅
        ↓
        创建 manifest + 提交 Bedrock Batch Job
        ↓
        Bedrock 处理（异步，数小时）
        ↓
#99 (batch-result-handler) ← **当前**
        ↓
        处理 Bedrock 输出
        ↓
#100 (EventBridge rules for hybrid)
        ↓
#99 后 可选：#102, #103...
```

---

## ✨ Pillar 对齐

- **Pillar B** (Airlock): S3 event JSON parse + Bedrock output JSON parse (Zod schema)
- **Pillar E** (Orchestration): T2 pattern (adapters + headless logic)
- **Pillar F** (Concurrency): BatchWriteItem 自动处理并发；transactionId 幂等（无竞态）
- **Pillar O** (Async): 长期异步操作的完成处理（S3 event trigger）
- **Pillar Q** (Idempotency): transactionId 基于 jobId+imageId 确定性生成，重复处理自动覆盖
- **Pillar R** (Observability): 所有步骤加语义日志 + traceId

---

## 📌 开放问题（需确认）

1. **pending-images 表 schema**：是否已包含 `s3Key` 字段？若无，需在 presign/instant-processor 时补充。
2. **Bedrock 输出格式**：实际格式是 `batch-output/{jobId}/output.jsonl` 还是其他？是否压缩？
3. **transaction 表 schema**：`userId` 字段是否存在？如何从 jobId 获取 userId？
4. **错误恢复**：失败交易存 `failed-transactions` 表还是 S3？
5. **TTL**：Transaction 记录多久后自动清理？
6. **Timezone**：日期处理用 UTC 还是 JST（`processed/2026-01-09/`）？

---

## 🚀 分阶段优化（MVP3.x）

### 🟡 改进 #2: trace/intentId 传播（MVP3.1）

**目的**：完整追踪每笔交易的全生命周期  
**实施**：
- manifest 中添加 `intentId`（修改 #98）
- batch-result-handler 读 jobId → batch-jobs 表查 intentId
- 每个 transaction 记录 `intentId` + `traceId`（从 jobId 推导或 lambda context）
- CloudWatch Logs 按 `intentId` 检索全链路日志

**成本**：低（改动 2 个 Lambda）  
**收益**：高（可观测性 + 调试）  
**优先级**：验证阶段后立即加

---

### 🟡 改进 #3: S3 Event → SQS + DLQ（MVP3.1）

**目的**：更稳健的失败重试与监控  
**变更**：
```
S3 batch-output/ event
  ↓
SNS Topic (optional)
  ↓
SQS Queue
  ↓
Lambda (batch-result-handler)
  ↓ [if fails]
SQS DLQ
```

**成本**：中（CDK 配置 + Lambda event source mapping + SQS 文档）  
**收益**：中（失败重试 + 死信队列可见性）  
**优先级**：上线前必须有；验证阶段可用 S3 Event 快速测试

**实施清单**：
- [ ] CDK 中定义 SQS Queue + DLQ
- [ ] S3 event 改为发送到 SNS → SQS
- [ ] Lambda 改为 SQS EventSourceMapping（而不是 S3 event）
- [ ] CloudWatch 告警：DLQ depth > 0

---

### 🟡 改进 #6: CloudWatch 指标 + 告警（MVP3.1）

**指标**：
- `BatchResult/SuccessCount` (sum/batch)
- `BatchResult/FailureCount` (sum/batch)
- `BatchResult/ProcessingTime` (histogram)
- `BatchResult/DLQDepth` (gauge)

**告警**：
- FailureCount / TotalCount > 5% → 告警
- ProcessingTime > 60s → 告警
- DLQDepth > 0 → 告警

**成本**：低（CloudWatch custom metrics + SNS notification）  
**收益**：中（运维可见性）  
**优先级**：MVP3 上线前必须有；现阶段可暂缺

**实施清单**：
- [ ] Lambda 中调用 `cloudwatch.putMetricData()`
- [ ] CDK 定义 CloudWatch Alarms
- [ ] 配置 SNS topic 与告警接收人

---

## 未来优化（不做）

❌ **改进 #8: Step Functions 拆 chunk**  
- 理由：MVP3 预期 <500 条/批，单 Lambda 可处理；过度设计
- 未来考虑：日均交易 >10K 时重新评估

---

## 📊 概括

| 改进项 | 实施阶段 | 优先级 | 成本 | 收益 |
|--------|---------|--------|------|------|
| #1 幂等性 | MVP3 | 🔴 高 | 低 | 高 |
| #4 流式 + 批量 | MVP3 | 🔴 高 | 中 | 高 |
| #5 S3 key 映射 | MVP3 | 🔴 高 | 低 | 高 |
| #7 IAM 最小权限 | MVP3 | 🔴 高 | 低 | 高 |
| #2 trace 传播 | MVP3.1 | 🟡 中 | 低 | 中 |
| #3 SQS DLQ | MVP3.1 | 🟡 中 | 中 | 中 |
| #6 告警 | MVP3.1 | 🟡 中 | 低 | 中 |

