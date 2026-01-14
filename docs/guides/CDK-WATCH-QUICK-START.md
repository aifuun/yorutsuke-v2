# CDK Watch 快速开始指南

**时间**: 15 分钟完成 Azure DI Lambda 云端联调

---

## 前置检查

```bash
# 1. 检查 AWS 凭证
aws sts get-caller-identity --profile dev
# 应该看到 Account 和 UserId

# 2. 检查 Azure DI 凭证
cd /Users/woo/dev/yorutsuke-v2-1/infra
cat .env | grep AZURE_DI
# 应该看到：
# AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
# AZURE_DI_API_KEY=...
```

---

## 三个命令完成 Azure DI Lambda 测试

### Step 1: 启动 cdk watch（开发者本地）

```bash
cd /Users/woo/dev/yorutsuke-v2-1/infra

# 启动实时监听和自动部署
cdk watch --profile dev

# 你会看到：
# ✨ File watch mode enabled ✨
# 正在监听文件变化...
# 有任何代码改动，会自动部署到 AWS
```

**这个终端保持开启，它会监听你的代码变化！**

### Step 2: 上传测试文件（另一个终端）

```bash
# 打开新终端窗口
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di

# 使用你的测试图片（假设有 receipt.jpg）
# 如果没有，使用我们的测试脚本生成：
node test-multimodel-analyzer.mjs

# 看到 ✅ Test Completed Successfully! 表示本地测试通过

# 现在上传真实 S3 测试（触发云端 Lambda）
aws s3 cp ~/Desktop/receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/my-test.jpg \
  --profile dev

# 你会看到：
# upload: ../Desktop/receipt.jpg to s3://.../my-test.jpg
```

### Step 3: 查看 Lambda 执行日志（第三个终端）

```bash
# 打开第三个终端窗口

# 实时查看 Lambda 日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev

# 你会看到完整的执行日志：
# {
#   "timestamp": "2026-01-14T...",
#   "level": "info",
#   "event": "MODEL_COMPARISON_STARTED",
#   ...
# }

# 查看 Azure DI 相关日志
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern 'AZURE_DI' \
  --profile dev
```

---

## 终端布局参考

```
┌─────────────────────────┬─────────────────────────┐
│    Terminal 1           │    Terminal 2           │
│  (cdk watch 运行中)     │   (S3 上传 + 测试)     │
│                         │                         │
│  $ cdk watch            │  $ aws s3 cp ...       │
│  ✨ File watch enabled  │  upload: ... done      │
│                         │                         │
│  [实时监听文件]         │  [S3 触发 Lambda]      │
└─────────────────────────┴─────────────────────────┘
                    ↓
        ┌──────────────────────────┐
        │     Terminal 3           │
        │ (CloudWatch 日志监视)    │
        │                          │
        │ $ aws logs tail          │
        │ [实时日志流]             │
        └──────────────────────────┘
```

---

## 完整流程展示

### 场景 1: 修改 Lambda 代码后重新测试

```bash
# Terminal 1 中 cdk watch 持续运行
# 检测到代码变化 → 自动编译 → 自动部署到 AWS

# Terminal 2 中上传新文件触发 Lambda
aws s3 cp new-receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/test-2.jpg \
  --profile dev

# Terminal 3 中看到新的执行日志
# 无需手动重新部署！cdk watch 已自动完成
```

### 场景 2: 调试 Azure DI 错误

```bash
# Terminal 3 查看 Azure DI 相关错误
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern 'AZURE_DI_ERROR' \
  --profile dev

# 看到错误信息后，在 Terminal 1 编辑代码修复
# 修复后自动重新部署，无需任何手动操作
```

### 场景 3: 验证 DynamoDB 结果

```bash
# S3 上传文件后，Lambda 处理完成，结果保存到 DynamoDB
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --filter-expression 'attribute_exists(modelComparison)' \
  --profile dev \
  | jq '.Items[0].modelComparison.M.azure_di'

# 预期输出：
# {
#   "vendor": "CompanyName",
#   "totalAmount": 1958,
#   "taxAmount": 178,
#   "confidence": 68.9
# }
```

---

## 关键日志指标

### ✅ 成功标志

查看这些日志事件表示 Azure DI 成功：

```bash
# 检查 Azure DI 客户端初始化
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern 'AZURE_DI_CLIENT_INITIALIZED' \
  --profile dev

# 检查请求提交
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern 'AZURE_DI_REQUEST_START' \
  --profile dev

# 检查完整流程
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern 'MODEL_COMPARISON_COMPLETED' \
  --profile dev
```

### ⚠️ 常见错误处理

```bash
# 1. Azure DI 返回 "Invalid request"
# 原因：S3 对象不存在或被删除
# 解决：确保 S3 中有对应的 receipt.jpg

# 2. Lambda 超时
# 原因：Azure DI 分析太慢（>2 分钟）
# 解决：Lambda 已配置 2 分钟超时，足够用

# 3. 环境变量未设置
# 原因：.env 未加载
# 解决：
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=...
cdk deploy --profile dev  # 重新部署一次

# 4. IAM 权限不足
# 原因：Lambda 角色无法访问 S3、DynamoDB
# 检查：
aws iam get-role --role-name yorutsuke-instant-processor-us-dev-lambda-role
```

---

## 完整的 cdk watch 工作流程

```
┌─────────────────────────────────────────────┐
│  1. 启动 cdk watch                          │
│     $ cdk watch --profile dev               │
│     ✨ File watch mode enabled              │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  2. 编辑代码或上传 S3 文件                   │
│     $ aws s3 cp receipt.jpg s3://...        │
│     → S3 事件触发 Lambda                    │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  3. cdk watch 检测到代码变化（如果有编辑）  │
│     检测文件变化...                         │
│     重新编译 TypeScript                     │
│     合成 CloudFormation 模板                │
│     更新 AWS 中的 Lambda                    │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  4. Lambda 在 AWS 中执行                    │
│     调用 Azure DI SDK                       │
│     处理 receipt                            │
│     保存结果到 DynamoDB                     │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  5. 查看日志并验证                          │
│     $ aws logs tail ... --follow            │
│     查看 Azure DI 提取的字段                │
│     查看 DynamoDB 中的结果                  │
└─────────────────────────────────────────────┘
```

---

## 快速参考命令

```bash
# === Step 1: 启动 cdk watch ===
cd /Users/woo/dev/yorutsuke-v2-1/infra
cdk watch --profile dev

# === Step 2: 测试（新终端）===
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di
node test-multimodel-analyzer.mjs

# === Step 3: 上传文件触发 Lambda ===
aws s3 cp ~/receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/test.jpg \
  --profile dev

# === Step 4: 查看日志（新终端）===
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev

# === 查看 Azure DI 日志 ===
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern 'AZURE_DI' \
  --profile dev

# === 查看 DynamoDB 结果 ===
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --profile dev | jq '.Items[0].modelComparison.M.azure_di'

# === 停止 cdk watch（Ctrl+C）===
# 当开发完成时，在 Terminal 1 按 Ctrl+C 停止监听
```

---

## vs SAM 的优势对比

| 功能 | SAM (需要 Docker) | cdk watch ✅ |
|------|----------------|------------|
| 启动时间 | ⏱️ 3-5 分钟 | ⚡ 1-2 分钟 |
| S3 触发测试 | ❌ 不支持 | ✅ 完全支持 |
| 真实环境 | ❌ 模拟 | ✅ 真实 AWS |
| 自动重新部署 | ❌ 手动 | ✅ 自动监听 |
| Docker 需求 | ❌ 需要 | ✅ 无需 |
| 日志准确性 | ⚠️ 模拟 | ✅ 真实 CloudWatch |

---

## 成本考虑

**cdk watch 开发成本极低**：

- Lambda 调用：$0.0000002 / 次 = 1000 次调用 $0.0002
- S3 上传：$0.000005 / 次 = 1000 次上传 $0.005
- CloudWatch 日志：$0.50 / GB = 1GB 日志 $0.50

**每天开发成本** < $1（即使频繁测试）

---

## 总结

✅ **建议的工作流程**：

```
Day 1: 本地 Node.js 测试 (experiments/azure-di)
Day 2-3: cdk watch 云端联调 (infra)
Day 4+: 生产部署 (cdk deploy)
```

**优点**：
- ⚡ 快速反馈
- 🚫 无需 Docker
- ✅ 真实环境
- 💰 低成本
- 🔄 实时同步

**立即开始**：
```bash
cd infra
cdk watch --profile dev
```

---

**预期时间**: 15 分钟完成 Azure DI Lambda 的完整云端验证
**成本**: < $0.01 （开发费用）
**质量**: 100% 与生产环境一致
