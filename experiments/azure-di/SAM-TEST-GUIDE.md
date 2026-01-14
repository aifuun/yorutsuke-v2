# 🚀 SAM 本地测试指南 - Azure DI Integration

通过 AWS SAM 在本地测试 Lambda 函数，调用 Azure Document Intelligence 识别 receipt。

---

## 📋 前置要求

```bash
# ✅ 检查工具
sam --version          # AWS SAM CLI v1.151.0+
docker --version       # Docker Desktop
aws --version          # AWS CLI v2

# 如果没安装SAM
brew install aws-sam-cli
```

---

## 🔧 第一步：设置 Azure 凭证

```bash
# 方式1：导出环境变量（推荐）
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=<REDACTED_SECRET>

# 验证
echo $AZURE_DI_ENDPOINT
echo $AZURE_DI_API_KEY
```

---

## 🏗️ 第二步：构建 SAM 项目

```bash
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di

# 构建Lambda和Layer
sam build

# 输出应该显示：
# Building resources
# ✔︎ InstantProcessorFunction built
# ✔︎ SharedLayer built
# Build Succeeded
```

---

## 🧪 第三步：运行本地测试

### 方式A：直接调用函数（推荐用于快速测试）

```bash
# 设置环境变量
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=<REDACTED_SECRET>

# 调用函数（不需要Docker）
sam local invoke InstantProcessorFunction \
  --event events/s3-event.json \
  --parameter-overrides ParameterValues="--env-vars { \"AZURE_DI_ENDPOINT\": \"$AZURE_DI_ENDPOINT\", \"AZURE_DI_API_KEY\": \"$AZURE_DI_API_KEY\" }"

# 或更简单的方式 - 用环境变量文件
sam local invoke InstantProcessorFunction \
  --event events/s3-event.json
```

### 方式B：启动本地 API Gateway（完整模拟）

```bash
# 需要Docker运行
sam local start-api --port 3000 \
  --env-vars $(cat <<EOF
{
  "InstantProcessorFunction": {
    "AZURE_DI_ENDPOINT": "$AZURE_DI_ENDPOINT",
    "AZURE_DI_API_KEY": "$AZURE_DI_API_KEY"
  }
}
EOF
)

# 然后在另一个终端测试
curl -X POST http://localhost:3000/invoke \
  -H "Content-Type: application/json" \
  -d @events/s3-event.json
```

---

## 📊 运行示例和预期输出

### 执行命令：
```bash
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di

# 构建
sam build

# 测试
sam local invoke InstantProcessorFunction --event events/s3-event.json
```

### 预期输出：

```
📋 Instant Processor Lambda Started
Event: {
  "Records": [
    {
      "s3": {
        "bucket": {
          "name": "yorutsuke-images-us-dev-696249060859"
        },
        "object": {
          "key": "uploads/1768363465275-test-receipt.jpg"
        }
      }
    }
  ]
}

📦 Processing S3 object: s3://yorutsuke-images-us-dev-696249060859/uploads/1768363465275-test-receipt.jpg

🔍 Starting multi-model analysis...

[... 详细日志 ...]

✅ AZURE_DI_CLIENT_INITIALIZED
   endpoint: https://rj0088.cognitiveservices.azure.com/

✅ Analysis submitted (202 Accepted)
   Result ID: f96e0a9b-bca0-45f5-bbb1-7ab08412b8a8

✅ Analysis completed (6 polls)

📊 AZURE_DI_EXTRACTED_RESULT
   vendor: CompanyName
   totalAmount: 1958
   taxAmount: 178
   confidence: 68.9

[... 所有4个模型的结果 ...]

📊 Results: {
  "textract": { ... },
  "nova_mini": { ... },
  "nova_pro": { ... },
  "azure_di": {
    "vendor": "...",
    "totalAmount": 1958,
    "taxAmount": 178,
    "confidence": 68.9
  },
  "comparisonStatus": "completed",
  "successCount": 4,
  "failureCount": 0
}

📤 Lambda returning: {
  "statusCode": 200,
  "body": {...}
}
```

---

## 🐛 调试技巧

### 1️⃣ 启用详细日志
```bash
sam local invoke InstantProcessorFunction \
  --event events/s3-event.json \
  --debug
```

### 2️⃣ 查看Layer中的文件
```bash
# Lambda Layer在SAM中挂载于 /opt/nodejs/shared/
# 检查model-analyzer.mjs是否正确加载

sam local invoke InstantProcessorFunction \
  --event events/s3-event.json \
  --layer-cache-basedir .aws-sam/
```

### 3️⃣ 检查环境变量是否传递
```bash
# 修改handler添加日志
console.log('AZURE_DI_ENDPOINT:', process.env.AZURE_DI_ENDPOINT);
console.log('AZURE_DI_API_KEY:', process.env.AZURE_DI_API_KEY ? 'SET' : 'NOT SET');
```

### 4️⃣ 排查模块导入问题
```bash
# 如果出现"Cannot find module"错误
# 检查node_modules是否正确打包
sam build --use-container

# 或清除缓存重建
rm -rf .aws-sam
sam build
```

---

## 📁 项目结构

```
experiments/azure-di/
├── template.yaml              # SAM CloudFormation模板
├── samconfig.toml            # SAM配置
├── local-handler/            # Lambda处理器代码
│   ├── index.mjs            # 事件处理程序
│   └── package.json         # 依赖（minimal）
├── events/
│   └── s3-event.json        # 测试S3事件
├── SAM-TEST-GUIDE.md        # 本文件
└── test-azure-di-local-fixed.mjs  # 独立的Azure DI测试

../../infra/lambda/shared-layer/nodejs/  # Layer代码
├── shared/
│   ├── model-analyzer.mjs     # 多模型分析器
│   ├── logger.mjs             # 日志工具
│   └── schemas.mjs            # Zod schemas
└── node_modules/              # Azure SDK等依赖
```

---

## 🔄 工作流程

### 快速迭代：
```bash
# 1. 修改handler代码
vim local-handler/index.mjs

# 2. 构建
sam build

# 3. 测试
sam local invoke InstantProcessorFunction --event events/s3-event.json

# 4. 查看结果并迭代
```

### 修改Layer代码：
```bash
# 1. 修改 infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs
vim ../../infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs

# 2. 重建（会重新打包Layer）
sam build

# 3. 测试
sam local invoke InstantProcessorFunction --event events/s3-event.json
```

---

## ✅ 验证检查清单

运行SAM之前检查：

- [ ] Docker 运行中（如需要）
  ```bash
  docker ps  # 应该能连接
  ```

- [ ] Azure 凭证已设置
  ```bash
  echo $AZURE_DI_ENDPOINT
  echo $AZURE_DI_API_KEY
  ```

- [ ] Lambda Layer构建成功
  ```bash
  ls -la .aws-sam/build/SharedLayer/
  ```

- [ ] Handler代码无语法错误
  ```bash
  node --check local-handler/index.mjs
  ```

- [ ] 测试事件文件有效
  ```bash
  cat events/s3-event.json | jq .
  ```

---

## 🚀 从SAM到生产

当本地测试通过后：

```bash
# 1. 验证Layer v22在Lambda中运行
aws lambda list-layer-versions \
  --layer-name yorutsuke-shared-dev \
  --profile dev | jq '.LayerVersions[0].Version'

# 2. 上传真实receipt触发Lambda
aws s3 cp receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/ \
  --profile dev

# 3. 监控CloudWatch日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev

# 4. 验证DynamoDB结果
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --profile dev | jq '.Items[0].modelComparison.M.azure_di'
```

---

## 💡 常见问题

### Q: SAM需要Docker吗？
A: 取决于模式：
- `sam local invoke` - 不需要Docker（推荐快速测试）
- `sam local start-api` - 需要Docker（完整模拟）

### Q: 如何调试Lambda超时？
A: 在samconfig.toml中设置：
```toml
[default.local_invoke]
parameters = "TIMEOUT=60"
```

### Q: 模块找不到怎么办？
A: 确保Layer正确打包：
```bash
sam build --debug
```

### Q: 如何测试多个事件？
A: 创建多个事件文件：
```bash
sam local invoke InstantProcessorFunction --event events/receipt1.json
sam local invoke InstantProcessorFunction --event events/receipt2.json
```

---

## 📚 更多资源

- [AWS SAM 官方文档](https://docs.aws.amazon.com/serverless-application-model/)
- [SAM CLI 命令参考](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
- [本地测试最佳实践](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-testing.html)

---

## 🎯 下一步

```bash
# 准备好了吗？运行这个命令开始：
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di
sam build
sam local invoke InstantProcessorFunction --event events/s3-event.json
```

享受本地调试！🎉
