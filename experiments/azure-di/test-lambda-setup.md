# Lambda 本地测试指南

## 📋 三种本地测试方案

### 方案1️⃣：最简单 - 直接测试Azure DI (推荐)

**优点**：
- ✅ 无需Docker
- ✅ 无需AWS凭证
- ✅ 即刻得到反馈

**操作**：
```bash
# 1. 设置Azure凭证
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=<REDACTED_SECRET>

# 2. 运行Azure DI本地测试
cd experiments/azure-di
node test-azure-di-local-fixed.mjs
```

**输出示例**：
```
✅ SDK initialized successfully
✅ Analysis submitted (202 Accepted)
✅ Analysis completed (6 polls)
📊 Extracted Fields:
   - Vendor: CompanyName
   - Invoice Date: 2025-01-14
   - Confidence: 85%
```

---

### 方案2️⃣：中等 - 使用AWS SAM模拟Lambda

**优点**：
- ✅ 完整Lambda环境
- ✅ 本地API网关
- ✅ 接近真实环境

**需求**：Docker, AWS CLI credentials

**安装**：
```bash
# macOS
brew install aws-sam-cli

# 或下载: https://aws.amazon.com/serverless/sam/
```

**创建SAM模板** `template.yaml`：
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Timeout: 120
    MemorySize: 512
    Runtime: nodejs20.x

Resources:
  InstantProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: infra/lambda/shared-layer/nodejs/
      Handler: index.handler
      Layers:
        - !Ref SharedLayer

  SharedLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      ContentUri: infra/lambda/shared-layer/nodejs/
      CompatibleRuntimes:
        - nodejs20.x
```

**运行**：
```bash
# 启动本地API
sam local start-api

# 或直接调用函数
sam local invoke InstantProcessorFunction -e events/s3-event.json
```

---

### 方案3️⃣：完整 - LocalStack (完全模拟AWS)

**优点**：
- ✅ S3, Lambda, DynamoDB等
- ✅ 最接近真实环境
- ✅ 可测试整个流程

**需求**：Docker

**安装和运行**：
```bash
# 安装
brew install localstack

# 启动
localstack start

# 在另一个终端验证
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566

# 创建S3桶
aws s3 mb s3://yorutsuke-test

# 上传测试文件
aws s3 cp receipt.jpg s3://yorutsuke-test/uploads/

# 查看CloudWatch日志
aws logs tail /aws/lambda/...
```

---

## 🎯 我建议的步骤

### 步骤1：验证Azure DI (3分钟)
```bash
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=your-key
node experiments/azure-di/test-azure-di-local-fixed.mjs
```

如果成功，Azure DI代码没问题。

### 步骤2：在Lambda中验证 (实时监控)

**打开一个终端监控日志**：
```bash
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev
```

**在另一个终端上传测试receipt**：
```bash
# 方式A：通过Tauri应用 (最现实)
# 在应用中选择上传receipt

# 方式B：直接上传到S3
aws s3 cp /path/to/receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/ \
  --profile dev
```

**查看结果**：
- ✅ CloudWatch应显示: `AZURE_DI_CLIENT_INITIALIZED`
- ✅ DynamoDB应包含: `azure_di` 字段

### 步骤3：检查DynamoDB结果
```bash
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --profile dev \
  --limit 1 | jq '.Items[0].modelComparison.M.azure_di'
```

---

## 🐛 调试技巧

### 在IDE中调试Lambda代码

**使用VS Code**：
1. 打开 `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs`
2. 添加断点 (F9)
3. 运行 `node --inspect-brk test-debug.mjs`
4. 在VS Code中连接调试器 (Cmd+Shift+D)

### 查看完整日志
```bash
# 查看最近100行日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --profile dev \
  --max-items 100

# 按traceId搜索
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern '"lambda-1768363469109"' \
  --profile dev
```

### 检查Lambda配置
```bash
# 查看环境变量
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Environment.Variables'

# 查看Layer版本
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers'
```

---

## 📊 当前部署状态

✅ **已完成**：
- Layer v22 已发布 (包含修复的Azure SDK)
- Lambda已配置Azure凭证
- 本地Azure DI测试可用

⏳ **等待**：
- Receipt上传以触发Lambda
- CloudWatch日志验证

---

## 🚀 快速开始

```bash
# 1. 验证Azure DI可用 (无AWS凭证需要)
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=<REDACTED_SECRET>
node test-azure-di-local-fixed.mjs

# 2. 上传真实receipt (需要AWS凭证)
aws s3 cp ~/Downloads/receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/ \
  --profile dev

# 3. 监控Lambda执行
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --profile dev --follow

# 4. 查看结果
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --profile dev | jq '.Items[0]'
```

---

## ❓ FAQ

**Q: 需要Docker吗？**
A: 否。本地Azure DI测试不需要。SAM和LocalStack需要。

**Q: 需要AWS凭证吗？**
A: 本地测试Azure DI不需要。上传到真实Lambda需要。

**Q: 本地改代码后需要什么？**
A:
1. 修改代码
2. npm install (如果有新依赖)
3. npm run deploy (重新发布Layer)
4. Lambda自动使用新Layer

**Q: 如何调试冷启动？**
A:
1. 第一次调用: 查看完整日志 (包括初始化)
2. 第二次调用: 查看快速执行 (缓存的SDK)
3. 对比时间确认优化有效

**Q: 成本多少？**
A:
- Azure DI: ~¥0.15/image
- Lambda: <¥0.01/execution
- 测试成本: 约¥1-5

---

**推荐**: 先运行 `test-azure-di-local-fixed.mjs` 验证代码，再上传真实receipt到Lambda。
