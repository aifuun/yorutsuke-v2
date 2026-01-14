# Model Analyzer 本地测试

在部署到 Lambda 之前，在本地验证 OCR 模型是否工作。

## 目录结构

```
experiments/model-analyzer/
├── README.md                    # 本文件
├── test-bedrock-nova.js         # ✅ Bedrock Nova Mini/Pro 测试
├── test-textract.js             # (待实现) AWS Textract 测试
├── test-azure-di.js             # (待实现) Azure Document Intelligence 测试
└── .env.example                 # 环境变量模板
```

## 快速开始

### 前置条件

```bash
# 1. AWS CLI 配置
aws configure --profile dev
export AWS_PROFILE=dev

# 2. 安装依赖（在项目根目录）
cd /Users/woo/dev/yorutsuke-v2-1
npm install -g @aws-sdk/client-bedrock-runtime
```

### 运行 Bedrock Nova 测试

```bash
# 设置环境变量
export AWS_REGION=us-east-1
export AWS_PROFILE=dev
export TEST_IMAGE_URL="https://your-receipt-image-url.jpg"

# 运行测试
node experiments/model-analyzer/test-bedrock-nova.js
```

**预期输出**:

```
🚀 Bedrock Nova 本地测试

配置:
  Region: us-east-1
  Profile: dev
  Image URL: https://example.com/receipt.jpg

1️⃣ 初始化 Bedrock 客户端...
   ✅ 已连接

2️⃣ 下载测试图片...
   ✅ 已下载 (120.5 KB)

3️⃣ 测试 Nova Mini 模型...
   ✅ Nova Mini 成功
   结果: {
     "vendor": "Lawson",
     "totalAmount": 2850,
     "taxAmount": 258,
     ...
   }

4️⃣ 测试 Nova Pro 模型...
   ✅ Nova Pro 成功
   结果: {
     "vendor": "Lawson",
     "totalAmount": 2850,
     "taxAmount": 258,
     ...
   }

✨ 测试完成!
```

## 测试清单

### ✅ 本地测试应该验证

- [ ] SDK 连接是否成功（AWS credentials 配置对吗）
- [ ] 单个模型是否返回期望的 JSON 格式
- [ ] 模型响应时间是否在合理范围（通常 2-5 秒）
- [ ] 错误处理是否正确（例如：网络超时）
- [ ] 结果包含所有必需的字段（vendor, totalAmount, 等）

### ✅ 通过本地测试后

如果上面所有测试都通过了，可以：

1. **复制函数到 Lambda layer**:
   ```bash
   cp test-bedrock-nova.js ../shared-layer/nodejs/shared/bedrock-analyzer.mjs
   ```

2. **发布新 Layer 版本**:
   ```bash
   npm run layer:publish
   ```

3. **部署到 Lambda**:
   ```bash
   npm run deploy
   ```

## 常见问题

### Q: 错误 "NoCredentialsError"

**原因**: AWS 凭证未配置

**解决**:
```bash
aws configure --profile dev
export AWS_PROFILE=dev
```

### Q: 错误 "AccessDenied: User is not authorized"

**原因**: IAM 权限不足

**解决**:
```bash
# 检查 IAM 权限
aws iam get-user-policy --user-name yorutsuke-dev --policy-name BedRock_Access --profile dev

# 或者给你的 IAM 用户添加 Bedrock 权限
# https://console.aws.amazon.com/iam/
```

### Q: 错误 "ValidationException: Invalid model identifier"

**原因**: 模型 ID 不正确，或者不在该 region 可用

**解决**:
```bash
# 列出可用模型
aws bedrock list-foundation-models --region us-east-1 --profile dev
```

### Q: 下载图片超时

**原因**: URL 不可访问或网络问题

**解决**:
```bash
# 使用本地文件而不是 URL
export TEST_IMAGE_PATH="/path/to/receipt.jpg"

# 修改脚本中的 fetchImageAsBase64 函数
# const imageBase64 = await fs.readFile(process.env.TEST_IMAGE_PATH, 'base64');
```

## 测试用图片

### 推荐的测试图片来源

| 来源 | URL | 说明 |
|------|-----|------|
| Azure Samples | [Invoice PDF](https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/sample-invoice.pdf) | 标准发票 |
| 本地文件 | `/private/tmp/yorutsuke-test/` | 见 `docs/tests/TEST_ASSETS.md` |

### 使用本地文件

```bash
# 1. 查看可用的测试文件
ls -la /private/tmp/yorutsuke-test/

# 2. 转换为 Base64（如果脚本不支持）
cat /private/tmp/yorutsuke-test/receipt.jpg | base64 > /tmp/receipt.b64

# 3. 在脚本中使用
export TEST_IMAGE_BASE64=$(cat /tmp/receipt.b64)
```

## 脚本细节

### test-bedrock-nova.js

**主要函数**:

```typescript
// 调用 Bedrock 模型（可直接用于 shared-layer）
async function invokeBedrockModel(client, modelId, imageBase64)

// 标准化结果格式（Lambda 中也会用到）
function normalizeBedrockResult(rawResult)
```

**这些函数可以直接复制到**:
```
infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs
```

## 工作流示例

### 添加新的 OCR 模型

**步骤 1: 本地测试（5 分钟）**

```bash
cat > experiments/model-analyzer/test-new-model.js << 'EOF'
// 参考 test-bedrock-nova.js 的结构
// 添加你的 SDK 和模型 ID
EOF

node test-new-model.js
# ✅ 成功？继续下一步
# ❌ 失败？修改代码，重试
```

**步骤 2: 集成到 shared-layer（10 分钟）**

```bash
# 1. 复制函数到 shared-layer
cp test-new-model.js infra/lambda/shared-layer/nodejs/shared/new-model-analyzer.mjs

# 2. 更新 model-analyzer.mjs 的主函数，调用新模型
# export async function analyzeReceipt({ imageBase64, ... }) {
#   const results = await Promise.allSettled([
#     analyzeTextract(...),
#     analyzeNovaMini(...),
#     analyzeNewModel(imageBase64, ...), // ← 新加
#   ]);
# }
```

**步骤 3: 部署到 Lambda（2 分钟）**

```bash
cd infra
npm run layer:publish
npm run deploy
```

## 下一步

- [ ] 实现 `test-textract.js` - AWS Textract 测试
- [ ] 实现 `test-azure-di.js` - Azure Document Intelligence 测试
- [ ] 创建集成测试 `test-multi-model.js` - 所有模型并行运行
- [ ] 添加性能基准测试 - 模型响应时间对比

## 参考

- [ADR-016: Lambda 本地优先测试](../../docs/architecture/ADR/016-lambda-local-first-testing.md)
- [Rules: Lambda 本地优先](../../.claude/rules/lambda-local-first.md)
- [AWS Bedrock 文档](https://docs.aws.amazon.com/bedrock/)
- [测试资源](../../docs/tests/TEST_ASSETS.md)

---

**核心原则**: ✅ 本地测试 → 通过 → 部署。**不要在 Lambda 中调试！**
