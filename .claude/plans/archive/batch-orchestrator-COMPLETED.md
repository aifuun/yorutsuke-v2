# batch-orchestrator Lambda 实现完成

## 概览

✅ #98 - MVP3 批处理编排器实现完成

## 实现内容

### 1. 核心功能
- ✅ **Manifest 生成**: 从 S3 读取待处理图片，生成 JSONL 格式（AWS Bedrock Batch 要求）
- ✅ **Bedrock Job 提交**: 调用 CreateModelInvocationJob API 提交异步处理任务
- ✅ **元数据记录**: 将 Job 信息存储到 DynamoDB `batch-jobs` 表（包括 jobId, 图片数, modelId）
- ✅ **错误处理**: Try-catch + Zod 验证 + 详细日志

### 2. 技术细节

#### 输入格式
```json
{
  "pendingImageIds": ["img-001", "img-002", ...],  // >= 100 张
  "modelId": "amazon.nova-lite-v1:0",
  "userId": "user-123",
  "batchJobThreshold": 100
}
```

#### Manifest JSONL 格式（AWS Bedrock 标准）
```jsonl
{"modelId":"amazon.nova-lite-v1:0","input":{"text":"prompt","image":{"format":"jpeg","source":{"bytes":"base64..."}}},"customData":"img-001"}
```

#### 输出格式
```json
{
  "jobId": "AKIAIOSFODNN7EXAMPLE",
  "status": "SUBMITTED",
  "imageCount": 150,
  "estimatedCost": 0.05625,  // ¥0.375/1000 images
  "message": "Batch Job ... submitted successfully"
}
```

### 3. AWS 权限配置

#### IAM Permissions
- `bedrock:CreateModelInvocationJob` – 创建批处理任务
- `bedrock:GetModelInvocationJob` – 查询任务状态
- S3 读写权限（读 images，写 manifest.jsonl）
- DynamoDB `yorutsuke-batch-jobs` 表的读写权限

#### DynamoDB 表
- 表名：`yorutsuke-batch-jobs-{env}`
- 分区键：`jobId`
- TTL：7 天自动过期
- 按需计费

### 4. 代码位置

```
infra/lambda/batch-orchestrator/
├── index.mjs           (293 行，包含完整实现)
└── [package.json]      (复用 shared-layer 依赖)

infra/lib/yorutsuke-stack.ts
├── BatchOrchestratorLambda 定义 (L332-351)
├── IAM 权限配置 (L353-362)
├── DynamoDB batch-jobs 表 (L365-373)
└── 权限绑定 (L374)
```

### 5. 集成点

```
batch-counter Lambda (#97 已完成)
    ↓ invoke(jobRequest)
batch-orchestrator Lambda (当前 ✅)
    ↓ CreateModelInvocationJob
AWS Bedrock Batch Inference (异步，50% 折扣)
    ↓ JobCompleted Event
batch-result-handler Lambda (#99 待做)
    ↓ GetModelInvocationJob + ProcessResults
DynamoDB transactions table
```

### 6. 验收清单

- ✅ 代码编译无误（`npm run build` 成功）
- ✅ Zod schema 验证完整
- ✅ 错误处理覆盖（验证错误、AWS API 错误、超时）
- ✅ CloudWatch 日志集成（EVENTS.BATCH_STARTED/COMPLETED/FAILED）
- ✅ CDK 配置完整（Lambda + IAM + DynamoDB）
- ✅ 类型安全（TypeScript 编译通过）

## 下一步

- **#99**: batch-result-handler Lambda（处理 Batch Job 完成事件）
- **#100**: CDK EventBridge 规则（触发 batch-counter）
- **#104**: 端到端测试（Hybrid 批处理流程验证）

## 关键指标

| 指标 | 值 |
|------|-----|
| 代码行数 | 293 |
| Lambda 超时 | 5 分钟 |
| Lambda 内存 | 512 MB |
| DynamoDB 计费 | 按需 |
| Bedrock 成本 | ~¥0.375/1000 images (Nova Lite Batch) |
| 最小图片数 | 100 张（AWS 要求） |

---

**Status**: ✅ 完成，已编译验证，准备好集成后续 Lambda
