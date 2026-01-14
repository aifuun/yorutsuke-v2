# Lambda 本地优先开发规则

> **原则**: Lambda 代码如果能在本地测试，先在 `experiments/` 目录测试成功，再移植到 Lambda。
> **好处**: 节省部署时间，快速迭代，避免 Lambda 容冷启动和权限问题

## 工作流

```
新功能 → 本地测试 ✅ → Lambda 移植 → 端到端测试
  ↑
  └─ 如果失败，改代码回到本地测试
```

## Rule 1: 按模块分离

### Lambda 代码结构

```
infra/lambda/
├── shared-layer/nodejs/shared/
│   ├── model-analyzer.mjs          ← 核心业务逻辑
│   ├── transaction-processor.mjs    ← 核心业务逻辑
│   └── index.mjs                    ← 导出
├── instant-processor/
│   └── index.mjs                    ← 仅 AWS SDK 操作
└── batch-processor/
    └── index.mjs                    ← 仅 AWS SDK 操作
```

### Experiments 目录结构（完全镜像）

```
experiments/
├── model-analyzer/
│   ├── test-azure-di.js             ← 测试 Azure DI
│   ├── test-bedrock.js              ← 测试 Bedrock
│   ├── test-textract.js             ← 测试 Textract
│   └── test-multi-model.js          ← 完整多模型测试
├── transaction-processor/
│   ├── test-local.js                ← 本地测试
│   └── test-with-mock-db.js
└── integration/
    ├── test-end-to-end.js           ← 从本地 DB 开始
    └── mock-s3-lambda.js            ← 模拟 S3 + Lambda
```

## Rule 2: 三层分离

### Layer 1: 纯业务逻辑（可完全本地化）

```typescript
// shared-layer/nodejs/shared/model-analyzer.mjs
export async function analyzeReceipt({ imageBase64, imageFormat, traceId }) {
  // ✅ 不依赖 AWS SDK
  // ✅ 可在任何环境运行
  // ✅ 返回标准化结果
  const results = await Promise.allSettled([
    analyzeTextract(imageBase64, imageFormat, traceId),
    analyzeNovaMini(imageBase64, imageFormat, traceId),
    analyzeNovaProBedrock(imageBase64, imageFormat, traceId),
  ]);
  return normalizeResults(results);
}
```

**本地测试**:
```bash
node experiments/model-analyzer/test-multi-model.js
# ✅ 所有模型都工作
# 输出: { textract: {...}, nova_mini: {...}, nova_pro: {...} }
```

### Layer 2: AWS 适配层（需要 Lambda 环境）

```typescript
// instant-processor/index.mjs
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { analyzeReceipt } from "../shared-layer/model-analyzer.mjs";

export async function handler(event) {
  // ✅ 仅处理 AWS 操作
  const s3Client = new S3Client({ region: "us-east-1" });
  const imageBase64 = await getImageFromS3(s3Client, event.Records[0].s3.bucket.name);

  // ✅ 调用已测试的业务逻辑
  const result = await analyzeReceipt({
    imageBase64,
    imageFormat: "jpeg",
    traceId: event.traceId,
  });

  // ✅ 存储结果
  await saveResult(result);
}
```

**不在 Lambda 测试这层** → 直接 deploy 即可

### Layer 3: 端到端集成（本地 mock + Lambda）

```bash
# experiments/integration/test-end-to-end.js
# 1. 模拟 S3 事件
# 2. 调用本地 handler 代码
# 3. 验证是否调用了正确的 AWS API
```

## Rule 3: 测试清单

### 本地测试清单 ✅

在 `experiments/` 中测试以下内容：

- [ ] SDK 连接是否成功（环境变量配置对吗）
- [ ] 单个模型是否返回正确的结果格式
- [ ] 多个模型并行运行是否工作
- [ ] 错误处理是否正确（网络超时、API 限制等）
- [ ] 结果标准化是否符合 Schema
- [ ] 日志是否清晰（包含 traceId）

### Lambda 部署前清单 ✅

- [ ] 所有本地测试都通过了吗？
- [ ] Layer 代码有改动吗？→ 需要发布新 Layer 版本
- [ ] 环境变量在 Lambda 中配置了吗？
- [ ] IAM 角色有必要权限吗？

### Lambda 部署后清单 ✅

- [ ] CloudWatch 日志显示正确的 traceId 吗？
- [ ] 模型结果的格式是否和本地测试一致？
- [ ] 是否有冷启动延迟？（第一次调用通常慢 5-10 秒）

## 示例：新增 Azure Document Intelligence 支持

### Step 1: 本地开发 (30 分钟)

```bash
cd experiments/model-analyzer
cat > test-azure-di.js << 'EOF'
import { DocumentIntelligenceClient, AzureKeyCredential } from "@azure/ai-document-intelligence";

const client = new DocumentIntelligenceClient(
  process.env.AZURE_DI_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_DI_API_KEY)
);

const imageUrl = "https://example.com/receipt.jpg";
const poller = await client.beginAnalyzeDocument("prebuilt-invoice", { urlSource: imageUrl });
const result = await poller.pollUntilDone();

console.log(JSON.stringify(normalizeAzureResult(result), null, 2));
EOF

# 设置环境变量
export AZURE_DI_ENDPOINT="https://rj0088.cognitiveservices.azure.com/"
export AZURE_DI_API_KEY="your-key-here"

# 运行测试
node test-azure-di.js
# ✅ 成功: { vendor: "...", totalAmount: 123, ... }
# ❌ 失败: 修改代码重试
```

### Step 2: 集成到 shared-layer (15 分钟)

```typescript
// shared-layer/nodejs/shared/model-analyzer.mjs
export async function analyzeAzureDI(imageUrl, traceId) {
  const client = new DocumentIntelligenceClient(
    process.env.AZURE_DI_ENDPOINT,
    new AzureKeyCredential(process.env.AZURE_DI_API_KEY)
  );

  const poller = await client.beginAnalyzeDocument("prebuilt-invoice", { urlSource: imageUrl });
  const result = await poller.pollUntilDone();

  logger.debug("AZURE_RESULT", { traceId, vendor: result.vendor });
  return normalizeAzureResult(result);
}

// 修改主函数
export async function analyzeReceipt({ imageBase64, imageFormat, s3Key, traceId }) {
  const results = await Promise.allSettled([
    analyzeTextract(...),
    analyzeNovaMini(...),
    analyzeNovaProBedrock(...),
    analyzeAzureDI(s3Key, traceId),  // ← 新增
  ]);

  return normalizeResults(results);
}
```

### Step 3: Lambda 部署 (2 分钟)

```bash
# 发布新 Layer 版本（自动使用 git 当前状态）
cd infra && npm run layer:publish

# CDK 部署
npm run deploy
```

## 常见错误

### ❌ 错误 1: 跳过本地测试，直接 push 到 Lambda

```bash
# 坏做法
git commit -m "Add Azure support"
npm run deploy
# ❌ Lambda 启动失败，需要 10 分钟调试
```

### ✅ 正确做法

```bash
# 好做法
node experiments/model-analyzer/test-azure-di.js  # 本地验证（1 分钟）
git commit -m "Add Azure support"
npm run deploy  # 再部署（2 分钟）
```

### ❌ 错误 2: 环境变量不一致

```bash
# 本地测试用了 `.env`
export AZURE_DI_API_KEY="local-key"

# Lambda 用了不同的密钥
# ❌ 本地成功，Lambda 失败
```

### ✅ 正确做法

```bash
# 本地测试用真实的环境变量（和 Lambda 一样）
export AZURE_DI_ENDPOINT=$(aws secretsmanager get-secret-value --secret-id yorutsuke/azure-di-endpoint)
export AZURE_DI_API_KEY=$(aws secretsmanager get-secret-value --secret-id yorutsuke/azure-di-key)

node test-azure-di.js  # 用真实凭证测试
```

## 参考

- `.claude/rules/lambda-layer-deployment.md` - Layer 部署
- `.claude/rules/secrets.md` - 环境变量管理
- `docs/architecture/ADR/015-sdk-over-rest-api.md` - SDK 选择

---

**核心要点**: 本地测试 → 通过 → 部署。避免在 Lambda 中调试。
