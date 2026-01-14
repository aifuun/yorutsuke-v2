# Lambda 开发流程评估与优化

**日期**: 2026-01-14
**评估对象**: Azure DI 集成的 Lambda 开发流程

## 📋 当前状态评估

### 现有方案对比

| 方面 | SAM 方案 | cdk watch 方案 |
|------|---------|--------------|
| **Docker 需求** | ❌ 需要 | ✅ 不需要 |
| **真实 AWS 环境** | ⚠️ 模拟 | ✅ 真实 |
| **S3 触发测试** | ❌ 无法测试 | ✅ 完整测试 |
| **启动时间** | ⏱️ 慢 | ⚡ 快 |
| **错误调试** | 📝 模拟日志 | 📊 CloudWatch 真实日志 |
| **多模型测试** | ❌ 仅 Azure DI | ✅ 4 个模型并行 |
| **设置复杂度** | 🔧 中等 | ✅ 简单 |

## 🎯 推荐方案：三阶段开发流程

### **Step 1: Pure Node.js 测试**（本地，5 分钟）

**目标**: 验证 Azure DI SDK 逻辑正确性

```bash
cd experiments/azure-di

# 设置凭证
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=<REDACTED_SECRET>

# 运行测试
node test-multimodel-analyzer.mjs
```

**验证清单**:
- [x] Azure SDK 初始化成功: `AZURE_DI_CLIENT_INITIALIZED`
- [x] API 请求格式正确: `AZURE_DI_REQUEST_START`
- [x] 多模型并行执行
- [x] 错误处理正常

**优点**:
- ⚡ 极快的反馈循环
- 🚫 无需 Docker、无需 AWS 部署
- 📝 清晰的错误信息
- 🔍 代码路径与生产一致

---

### **Step 2: cdk watch 云端实时联调**（AWS，10-15 分钟）

**目标**: 验证 Lambda 在真实 AWS 环境中的完整功能

#### 前置条件

```bash
cd /Users/woo/dev/yorutsuke-v2-1/infra

# 1. 确保 .env 中有 Azure 凭证（已配置）
cat .env
# AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
# AZURE_DI_API_KEY=...

# 2. 确保 AWS 凭证可用
aws sts get-caller-identity --profile dev
```

#### 启动 cdk watch

```bash
cd /Users/woo/dev/yorutsuke-v2-1/infra

# 方式 1：启动 cdk watch（实时同步代码变化）
cdk watch --context env=dev --profile dev

# 方式 2：或直接部署一次（快速验证）
npm run deploy --context env=dev --profile dev
```

**cdk watch 工作流程**:

```
本地代码修改
    ↓
CDK 检测到变化
    ↓
编译 TypeScript (lib/*.ts)
    ↓
合成 CloudFormation 模板
    ↓
部署到 AWS
    ↓
实时反馈：成功/失败/错误
```

#### 测试 Lambda 的完整流程

**Option A: 通过 S3 上传触发（推荐）**

```bash
# 1. 上传测试 receipt 到 S3
aws s3 cp ~/receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/test-receipt.jpg \
  --profile dev

# 2. Lambda 自动触发，监看日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev | jq .

# 3. 查看 Azure DI 执行的关键日志
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern 'AZURE_DI' \
  --profile dev | jq '.events'
```

**Option B: 直接调用 Lambda（快速验证）**

```bash
# 构造 S3 事件
aws lambda invoke \
  --function-name yorutsuke-instant-processor-us-dev \
  --payload '{"Records":[{"s3":{"bucket":{"name":"yorutsuke-images-us-dev-696249060859"},"object":{"key":"uploads/test.jpg"}}}]}' \
  --profile dev \
  response.json

# 查看返回值
cat response.json | jq .
```

#### 验证 Azure DI 执行成功

```bash
# 查看 DynamoDB 中的结果（Azure DI 字段）
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --filter-expression 'attribute_exists(modelComparison)' \
  --profile dev \
  | jq '.Items[0].modelComparison.M.azure_di'

# 预期看到：
# {
#   "vendor": "CompanyName",
#   "totalAmount": 1958,
#   "taxAmount": 178,
#   "confidence": 68.9
# }
```

**优点**:
- ✅ 测试真实 S3 触发（Lambda 实际工作场景）
- ✅ 真实 AWS 环境（IAM、权限、VPC 等）
- ✅ 完整的 4 模型比较（Textract + Nova + Azure DI）
- ✅ 真实 CloudWatch 日志
- ✅ 实时部署反馈
- ✅ 快速迭代循环

---

### **Step 3: 生产部署**（最终确认，5 分钟）

**目标**: 确认所有基础设施一致性，准备生产

```bash
cd /Users/woo/dev/yorutsuke-v2-1/infra

# 1. 查看变化
npm run diff --context env=dev --profile dev

# 2. 最终部署
npm run deploy --context env=dev --profile dev

# 3. 验证
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev

# 4. 完整端到端测试（真实 receipt）
aws s3 cp ~/production-receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/ \
  --profile dev
```

---

## ✅ 当前 CDK 配置评估

### 已配置的正确项 ✨

1. **Azure DI 环境变量正确加载**
```typescript
// infra/lib/yorutsuke-stack.ts
const azureDiEndpoint = process.env.AZURE_DI_ENDPOINT;
const azureDiApiKey = process.env.AZURE_DI_API_KEY;

...(azureDiEndpoint && { AZURE_DI_ENDPOINT: azureDiEndpoint }),
...(azureDiApiKey && { AZURE_DI_API_KEY: azureDiApiKey }),
```
✅ **评价**: 安全，不硬编码到 CDK，从环境变量加载

2. **Lambda Layer 正确配置**
```typescript
const sharedLayer = new lambda.LayerVersion(this, "SharedLayer", {
  layerVersionName: `yorutsuke-shared-${env}`,
  code: lambda.Code.fromAsset("lambda/shared-layer"),
  compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
});
```
✅ **评价**: 结构清晰，共享代码隔离

3. **S3 触发配置正确**
```typescript
imageBucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3_notifications.LambdaDestination(instantProcessLambda),
  { prefix: "uploads/" }
);
```
✅ **评价**: 自动触发，无需手动调用

4. **cdk.json 包含 watch 配置**
```json
{
  "watch": {
    "include": ["**"],
    "exclude": ["node_modules", "dist", ...]
  }
}
```
✅ **评价**: 支持 cdk watch，可以实时开发

---

## 🔄 改进建议

### 1. 添加 cdk watch 脚本（推荐）

**修改**: `infra/package.json`

```json
{
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "cdk": "cdk",
    "synth": "cdk synth",
    "diff": "cdk diff --profile dev",
    "deploy": "cdk deploy --profile dev",
    "destroy": "cdk destroy --profile dev",
    // ← 新增：
    "cdk:watch": "cdk watch --profile dev",
    "cdk:watch-prod": "cdk watch --context env=prod --profile prod"
  }
}
```

**使用**:
```bash
npm run cdk:watch    # 开发环境实时部署
npm run cdk:watch-prod  # 生产环境（谨慎！）
```

### 2. 创建本地开发指南

**文件**: `LAMBDA-DEVELOPMENT-GUIDE.md`（下一步）

包含：
- Step 1: Pure Node.js 测试
- Step 2: cdk watch 云端联调
- Step 3: 生产部署
- 常见问题排查

### 3. 增强 Azure DI 日志记录（可选）

在 `infra/lib/yorutsuke-stack.ts` 中添加：

```typescript
// 添加环境变量验证日志
if (azureDiEndpoint && azureDiApiKey) {
  console.log("✅ Azure DI 已配置，将部署到 Lambda");
} else {
  console.log("⚠️  Azure DI 未配置，跳过（可选功能）");
}
```

### 4. 添加部署检查清单（可选）

**文件**: `infra/deployment-checklist.md`

```markdown
# Lambda 部署前检查清单

- [ ] .env 中有 AZURE_DI_ENDPOINT
- [ ] .env 中有 AZURE_DI_API_KEY
- [ ] AWS 凭证可用：aws sts get-caller-identity --profile dev
- [ ] 本地 Node.js 测试通过：node test-multimodel-analyzer.mjs
- [ ] cdk diff 无意外变化
- [ ] CloudWatch 日志正常
- [ ] DynamoDB 中有 azure_di 字段
```

---

## 📊 时间对比

| 流程 | 时间 | 效果 |
|------|------|------|
| Step 1: Node.js 本地测试 | 5 分钟 | Azure SDK 逻辑验证 ✅ |
| Step 2: cdk watch 云端测试 | 10-15 分钟 | 完整 Lambda 功能 ✅ |
| Step 3: 生产部署 | 5 分钟 | 最终上线 ✅ |
| **总计** | **20-25 分钟** | **完整验证** |

**vs SAM 方式**：
- SAM 需要 Docker（无则不可用）
- SAM local invoke 不支持 S3 触发
- SAM 输出与 CloudWatch 日志差异大
- **总计**: 需要 Docker 或失败

---

## 🎓 关键点总结

### 为什么 cdk watch 比 SAM 更好（没有 Docker）

1. **真实环境测试**
   - Lambda 在真实 AWS 中运行
   - S3 触发真实可用
   - CloudWatch 日志完全准确

2. **快速迭代**
   - 本地编辑 → CDK 自动部署
   - 无需手动 SAM 构建/调用
   - 反馈速度快

3. **完整功能验证**
   - 4 个 OCR 模型都能测试
   - IAM 权限验证
   - DynamoDB 持久化验证

4. **成本效益**
   - 开发环境资源廉价
   - 每个测试 < $0.01
   - 可随时销毁

### 步骤简化流程

```
开发流程优化前 (失败):
┌─────────────┐
│ SAM 需要 Docker
│ Docker 不可用  → ❌ 卡住
│ 无法进行测试
└─────────────┘

优化后 (成功):
┌─────────────────────────────────────┐
│ Step 1: Node.js 本地测试 (5 分钟)
│   → 验证 Azure SDK 逻辑
├─────────────────────────────────────┤
│ Step 2: cdk watch 云端测试 (15 分钟)
│   → S3 触发、完整功能、真实日志
├─────────────────────────────────────┤
│ Step 3: 生产部署 (5 分钟)
│   → 最终确认、上线
└─────────────────────────────────────┘
```

---

## ✅ 实施建议

### 立即可做

1. **继续使用当前的本地 Node.js 测试**
   ```bash
   node experiments/azure-di/test-multimodel-analyzer.mjs
   ```

2. **使用 cdk watch 进行云端联调**
   ```bash
   cd infra
   cdk watch --profile dev
   ```

3. **通过 S3 上传触发真实 Lambda 测试**
   ```bash
   aws s3 cp receipt.jpg s3://yorutsuke-images-us-dev-696249060859/uploads/
   ```

4. **监看 CloudWatch 日志**
   ```bash
   aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev --follow --profile dev
   ```

### 下一步改进

1. [ ] 添加 `cdk:watch` 脚本到 package.json
2. [ ] 创建 Lambda 开发指南文档
3. [ ] 创建部署前检查清单
4. [ ] 记录常见问题和解决方案

---

## 📝 总体评估

| 项目 | 当前状态 | 评分 |
|------|--------|------|
| CDK 配置完整性 | ✅ 完整 | 9/10 |
| Azure DI 集成 | ✅ 正确 | 10/10 |
| 环境变量管理 | ✅ 安全 | 10/10 |
| 开发流程优化 | ⚠️ 可优化 | 7/10 |
| 文档完整性 | ⚠️ 缺少文档 | 6/10 |

## 🚀 最终建议

**采用三阶段流程**（推荐）：

```
Pure Node.js (验证逻辑)
    ↓
cdk watch (验证功能)
    ↓
cdk deploy (生产部署)
```

**优点**：
- ✅ 无需 Docker
- ✅ 快速反馈
- ✅ 真实环境
- ✅ 完整验证
- ✅ 易于迭代

**预期结果**：
- 20-25 分钟内完成 Azure DI Lambda 开发和验证
- 所有 4 个 OCR 模型都在生产环境中工作
- CloudWatch 日志清晰可追踪

---

## 📚 相关文件

- 本地测试：`experiments/azure-di/test-multimodel-analyzer.mjs`
- CDK 配置：`infra/lib/yorutsuke-stack.ts`
- 环境配置：`infra/.env`
- 部署脚本：`infra/package.json`

**状态**: ✅ 就绪，可立即实施
