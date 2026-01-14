# CDK Watch 云端驱动测试规则

> **目的**: 使用 AWS CDK Watch 进行实时、云端驱动的 Lambda 集成测试
> **适用**: Lambda 需要 S3 触发、DynamoDB 写入等完整 AWS 集成场景
> **参考**: [ADR-018: cdk watch 云端驱动测试](../docs/architecture/ADR/018-cdk-watch-cloud-driven-testing.md)

## 核心概念

### 为什么用 cdk watch 而非 LocalStack？

| 方面 | LocalStack | cdk watch |
|------|-----------|-----------|
| **Docker 需求** | ❌ 必需 | ✅ 无需 |
| **真实环境** | ❌ 模拟 | ✅ AWS 真实 |
| **S3 触发** | ✅ 支持 | ✅ 完全支持 |
| **设置复杂度** | 🔧 中等 | ✅ 简单 |
| **自动化程度** | 手动 | ✅ 自动部署 |
| **当前可用性** | ❌ (无 Docker) | ✅ (即刻可用) |

**结论**: cdk watch 是更优选择（特别是无 Docker 时）

---

## 工作流程

### 三阶段开发循环

```
┌─────────────────────┐
│ Phase 1: Pure Node  │  验证业务逻辑 (5 分钟)
│ 本地快速测试        │  node experiments/*/test-*.mjs
└──────────┬──────────┘
           ↓ ✅
┌─────────────────────┐
│ Phase 2: cdk watch  │  验证 AWS 集成 (15 分钟)
│ 云端驱动测试        │  S3 触发 → Lambda → DynamoDB
└──────────┬──────────┘
           ↓ ✅
┌─────────────────────┐
│ Phase 3: cdk deploy │  生产部署 (5 分钟)
│ 最终部署确认        │  确认基础设施一致性
└─────────────────────┘
```

---

## Quick Start (15 分钟)

### 前置条件

```bash
# 检查 AWS 凭证
aws sts get-caller-identity --profile dev

# 检查 CDK
npm list -g aws-cdk

# 检查环境变量
cat infra/.env | grep AZURE_DI
```

### 三个终端窗口

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

### 执行步骤

#### Step 1: 启动 cdk watch

```bash
cd /Users/woo/dev/yorutsuke-v2-1/infra

# 启动监听和自动部署
cdk watch --profile dev

# 你会看到：
# ✨ File watch mode enabled
# 正在监听文件变化...
```

**这个终端保持开启！有任何代码改动会自动部署。**

#### Step 2: 运行本地测试（新终端）

```bash
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di

# 确保本地测试仍然通过
node test-multimodel-analyzer.mjs

# 预期：✅ Test Completed Successfully!
```

#### Step 3: 上传文件触发 Lambda（同一终端）

```bash
# 上传测试文件到 S3
# Lambda 会自动被触发
aws s3 cp ~/receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/test.jpg \
  --profile dev

# 你会看到：
# upload: ... done
```

#### Step 4: 查看 CloudWatch 日志（第三个终端）

```bash
# 实时查看 Lambda 执行日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev

# 你会看到 JSON 日志，包含：
# {
#   "timestamp": "...",
#   "event": "AZURE_DI_CLIENT_INITIALIZED",
#   ...
# }
```

#### Step 5: 验证 DynamoDB 结果

```bash
# 查看 Azure DI 提取的结果
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --filter-expression 'attribute_exists(modelComparison)' \
  --profile dev | jq '.Items[0].modelComparison.M.azure_di'

# 预期输出：
# {
#   "vendor": "CompanyName",
#   "totalAmount": 1958,
#   "confidence": 68.9
# }
```

---

## 常见操作

### 修改代码后的自动部署

```bash
# 在 Terminal 1 (cdk watch 仍运行中)：
# 1. 编辑 Lambda 代码或 Layer 代码
# 2. 保存文件
# 3. cdk watch 自动检测变化
# 4. 自动重新编译和部署
# 5. 部署完成后，Terminal 1 会显示进度

# 在 Terminal 2 中重新触发测试：
aws s3 cp ~/another-receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/test2.jpg \
  --profile dev

# 观察 Terminal 3 的新日志
```

### 调试 Lambda 错误

```bash
# Terminal 3 中过滤特定事件的日志
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern 'AZURE_DI_ERROR' \
  --profile dev

# 或者查看所有 Azure DI 相关日志
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-us-dev \
  --filter-pattern 'AZURE_DI' \
  --profile dev
```

### 停止 cdk watch 并进行最终部署

```bash
# Terminal 1: 按 Ctrl+C 停止 cdk watch
# 提示：此时开发环境已经有最新的代码版本

# 执行最终部署到生产
cd infra
cdk deploy --context env=dev --profile dev

# 或者上传真实 receipt 进行最终端到端验证
aws s3 cp ~/production-receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/ \
  --profile dev
```

---

## 关键日志事件

### ✅ 成功标志

查看这些日志表示 Lambda 执行成功：

```bash
# 1. Azure DI 客户端初始化
AZURE_DI_CLIENT_INITIALIZED

# 2. 请求提交到 Azure
AZURE_DI_REQUEST_START

# 3. 模型比较完成
MODEL_COMPARISON_COMPLETED

# 4. 事务保存成功
TRANSACTION_SAVED
```

### ⚠️ 常见错误处理

```bash
# 1. "Lambda timeout"
# 原因: Lambda 执行超过配置的时间限制
# 解决: 检查 CDK 配置中的 timeout 设置
grep -A 2 "timeout" infra/lib/yorutsuke-stack.ts

# 2. "AZURE_DI_ERROR: Invalid request"
# 原因: S3 对象不存在或被删除
# 解决: 确保上传的文件在 S3 中存在
aws s3 ls s3://yorutsuke-images-us-dev-696249060859/uploads/

# 3. "The security token included in the request is invalid"
# 原因: AWS 凭证过期或无效
# 解决: 刷新凭证
aws sts get-caller-identity --profile dev  # 应该返回成功

# 4. "cdk watch" 编译失败
# 原因: TypeScript 编译错误
# 解决: 查看 Terminal 1 的错误信息，修复代码
```

---

## 性能指标

### 部署时间

```
首次 cdk watch 启动:  2-3 分钟 (第一次编译和部署)
代码变化检测到部署:  1-2 分钟 (增量部署)
Lambda 冷启动:      0.5-1 秒
Lambda 热启动:      100-200 毫秒
```

### 成本估算

```
每次 Lambda 调用:     $0.0000002
每次 S3 上传:        $0.000005
每次 DynamoDB 写入:  $0.00000125
每月日志存储:        < $1 (1GB)

总计每月开发成本:    < $5 (频繁测试)
```

---

## 规范和最佳实践

### ✅ DO

- ✅ 在 Phase 1 (本地)充分测试业务逻辑
- ✅ 在 Phase 2 (cdk watch)验证完整集成
- ✅ 使用 `--profile dev` 确保使用正确的凭证
- ✅ 查看实时日志而非等待日志汇总
- ✅ 在 Phase 3 前确保所有测试都通过

### ❌ DON'T

- ❌ 不要直接在生产环境中用 cdk watch 开发
- ❌ 不要在没有查看日志的情况下假设成功
- ❌ 不要忘记停止 cdk watch 后再执行 cdk deploy
- ❌ 不要在 Lambda 中硬编码凭证（使用环境变量）
- ❌ 不要频繁修改 CDK 配置（应该先在 Layer 中修改业务逻辑）

---

## 故障排查

### cdk watch 无法启动

```bash
# 1. 检查 CDK 是否安装
npm list -g aws-cdk

# 2. 检查 TypeScript 编译
cd infra && npm run build

# 3. 检查 AWS 凭证
aws sts get-caller-identity --profile dev

# 4. 清除缓存并重试
rm -rf infra/cdk.out infra/dist
cdk watch --profile dev
```

### Lambda 无法被 S3 事件触发

```bash
# 1. 检查 S3 事件通知配置
aws s3api get-bucket-notification-configuration \
  --bucket yorutsuke-images-us-dev-696249060859 \
  --profile dev

# 2. 检查 Lambda IAM 权限
aws iam get-role-policy \
  --role-name yorutsuke-instant-processor-us-dev-lambda-role \
  --policy-name lambda-execution-policy \
  --profile dev

# 3. 检查日志组是否存在
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda \
  --profile dev
```

### DynamoDB 没有保存结果

```bash
# 1. 检查 DynamoDB 表是否存在
aws dynamodb list-tables --profile dev | jq '.TableNames'

# 2. 检查表的内容
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --profile dev

# 3. 检查 Lambda 的 DynamoDB 权限
grep -A 5 "grantReadWriteData" infra/lib/yorutsuke-stack.ts
```

---

## 文档和参考

| 文档 | 位置 | 用途 |
|------|------|------|
| **快速开始** | `docs/guides/CDK-WATCH-QUICK-START.md` | 3 命令快速测试 |
| **详细工作流** | `docs/guides/LAMBDA-DEVELOPMENT-WORKFLOW.md` | 完整流程指南 |
| **ADR 决策** | `docs/architecture/ADR/018-cdk-watch-cloud-driven-testing.md` | 架构决策记录 |
| **本地测试** | `experiments/azure-di/test-multimodel-analyzer.mjs` | Pure Node.js 脚本 |

---

## 总结

### 完整的 Lambda 开发流程

```bash
# 1. 本地快速验证 (5 分钟)
node experiments/azure-di/test-multimodel-analyzer.mjs

# 2. 启动 cdk watch 云端测试 (15 分钟)
cd infra && cdk watch --profile dev

# 3. S3 上传 → Lambda 触发 → DynamoDB 保存 → 查看日志

# 4. 最终部署 (5 分钟)
cdk deploy --profile dev

# 总时间: 25 分钟
# 成本: < $0.01
# 质量: 100% 与生产一致
```

### 为什么选择 cdk watch？

✅ **无需 Docker** - 当 Docker 不可用时仍可工作
✅ **真实环境** - 在真实 AWS 中测试，不是模拟
✅ **自动化** - 代码变化自动部署，无需手动操作
✅ **完整验证** - S3 触发、Lambda 执行、DynamoDB 写入都能测试
✅ **成本低** - 每次测试 < $0.01
✅ **快速反馈** - 1-2 分钟部署循环

---

*参考: [ADR-018](../docs/architecture/ADR/018-cdk-watch-cloud-driven-testing.md)*
