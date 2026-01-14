# ADR-018: 使用 cdk watch 进行云端驱动的 Lambda 测试

**Status**: Accepted (Supersedes ADR-017)
**Date**: 2026-01-14
**Related**: [ADR-016 Lambda Local-First Testing](./016-lambda-local-first-testing.md), [ADR-014 Lambda Layer Management](./014-lambda-layer-version-management.md), [ADR-015 SDK Over REST API](./015-sdk-over-rest-api.md)

## Context

### 问题：Lambda 集成测试需要平衡成本和真实性

ADR-016 定义了本地优先的三层测试策略：
- ✅ **Layer 1**: 纯业务逻辑 (本地 Node.js)
- ❌ **Layer 2 + 3**: Lambda 集成 + 端到端 (缺少方案)

ADR-017 提议使用 LocalStack，但存在关键限制：

| 限制 | 影响 |
|------|------|
| **需要 Docker** | 部分开发者无法使用（如当前环境） |
| **模拟 vs 真实** | 可能隐藏真实 AWS 环境的问题 |
| **维护成本** | LocalStack 更新可能不同步 AWS |
| **学习曲线** | 又一个工具链的配置和学习 |

### 发现：无 Docker 时的最优方案

在测试 Azure DI Lambda 集成时，发现：

**SAM 本地模拟方案**:
```
SAM build → sam local invoke
✅ 快速本地测试
❌ 无法测试 S3 触发
❌ 需要 Docker
❌ 与生产环境差异大
```

**cdk watch 云端驱动方案**:
```
cdk watch (监听代码变化)
    ↓ 自动部署到真实 AWS
S3 上传触发 Lambda
    ↓ 真实环境执行
CloudWatch 日志查看结果
```

**对比评估**:

| 方面 | LocalStack | cdk watch | 赢家 |
|------|-----------|-----------|------|
| **Docker 需求** | ❌ 必需 | ✅ 无需 | cdk watch |
| **S3 触发** | ✅ 支持 | ✅ 完全支持 | cdk watch |
| **真实环境** | ⚠️ 模拟 | ✅ AWS 真实 | cdk watch |
| **设置复杂度** | 🔧 中等 | ✅ 简单 | cdk watch |
| **启动时间** | ⏱️ 10-20 秒 | ⚡ 1-2 分钟 | LocalStack |
| **自动化程度** | 手动 invoke | ✅ 自动部署 | cdk watch |
| **日志准确性** | ⚠️ 模拟日志 | ✅ 真实 CloudWatch | cdk watch |
| **成本** | 无（本地） | $0.01/测试 | LocalStack |
| **当前可用性** | ❌ (无 Docker) | ✅ (即刻可用) | cdk watch |

**结论**: 当无 Docker 或重视真实性时，**cdk watch 是更优方案**

---

## Decision

**采用三阶段测试流程，其中 Layer 2 + 3 使用 cdk watch 云端驱动测试**

### 新的工作流程

```
Step 1: Pure Node.js (本地)
════════════════════════════
• 验证纯业务逻辑
• 测试 SDK 初始化
• 验证数据格式
• 时间: 5 分钟
• 环境: 本地

   ↓ ✅ 通过

Step 2: cdk watch (云端)
════════════════════════════
• 启动 cdk watch 监听代码
• 上传文件到真实 S3
• Lambda 自动被触发
• 查看 CloudWatch 日志
• 验证 DynamoDB 结果
• 时间: 15 分钟
• 环境: AWS 开发账户

   ↓ ✅ 通过

Step 3: cdk deploy (生产)
════════════════════════════
• 最终部署确认
• 时间: 5 分钟
• 环境: AWS 生产/开发账户
```

### 工作流详解

```
┌─────────────────────────────────────────────────┐
│ Phase 1: Pure Node.js 本地测试                  │
├─────────────────────────────────────────────────┤
│ 命令: node experiments/azure-di/test-*.mjs      │
│ 验证:                                           │
│  ✅ Azure SDK 初始化成功                        │
│  ✅ API 请求格式正确                            │
│  ✅ 响应数据格式合法                            │
│ 时间: 5 分钟                                    │
│ 成本: $0 (本地)                                 │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Phase 2: cdk watch 云端驱动测试                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ Terminal 1: 启动 cdk watch                     │
│ $ cdk watch --profile dev                      │
│ ✨ File watch mode enabled                     │
│ [监听代码变化，自动部署]                       │
│                                                 │
│ Terminal 2: 运行本地测试                       │
│ $ node test-multimodel-analyzer.mjs             │
│ [验证 Azure SDK 仍然工作]                      │
│                                                 │
│ Terminal 2: 上传文件触发 Lambda                │
│ $ aws s3 cp receipt.jpg s3://...               │
│ [Lambda 自动执行]                              │
│                                                 │
│ Terminal 3: 查看日志                           │
│ $ aws logs tail /aws/lambda/... --follow       │
│ [观察 Azure DI 执行过程]                       │
│                                                 │
│ 验证:                                           │
│  ✅ S3 事件触发正常                             │
│  ✅ Lambda 自动执行                             │
│  ✅ 4 个 OCR 模型并行运行                       │
│  ✅ CloudWatch 日志清晰                         │
│  ✅ DynamoDB 持久化成功                         │
│                                                 │
│ 时间: 15 分钟                                   │
│ 成本: < $0.01 (几次 API 调用)                   │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Phase 3: cdk deploy 生产部署                    │
├─────────────────────────────────────────────────┤
│ 命令: cdk deploy --context env=dev --profile dev│
│ 验证: 基础设施最终确认                         │
│ 时间: 5 分钟                                    │
│ 成本: $0 (deployment)                           │
└─────────────────────────────────────────────────┘
```

---

## Implementation

### 前置条件

```bash
# 1. AWS 凭证可用
aws sts get-caller-identity --profile dev
# 应该返回 Account 和 UserId

# 2. 环境变量配置
cat infra/.env
# 应该看到 AZURE_DI_ENDPOINT 和 AZURE_DI_API_KEY

# 3. CDK 已安装
npm list -g aws-cdk
# 应该看到版本号
```

### Step 1: 本地快速验证 (5 分钟)

```bash
cd experiments/azure-di

# 设置环境变量
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=your-key-here

# 运行本地测试
node test-multimodel-analyzer.mjs

# 预期输出：
# ✅ AZURE_DI_CLIENT_INITIALIZED
# ✅ AZURE_DI_REQUEST_START
# ✅ Test Completed Successfully!
```

### Step 2: 启动 cdk watch (15 分钟)

**Terminal 1: 启动实时监听和自动部署**

```bash
cd infra

# 启动 cdk watch
cdk watch --profile dev

# 输出应该显示：
# ✨ File watch mode enabled
# [监听文件变化中...]
```

**Terminal 2: 再次验证本地测试**

```bash
cd experiments/azure-di

# 确认本地测试仍通过
node test-multimodel-analyzer.mjs

# 应该看到相同的成功结果
```

**Terminal 2: 上传文件触发 Lambda**

```bash
# 上传文件到 S3（触发 Lambda）
aws s3 cp ~/test-receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/test.jpg \
  --profile dev

# 输出应该显示：
# upload: ... done
```

**Terminal 3: 查看 CloudWatch 日志**

```bash
# 实时查看 Lambda 日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev

# 应该看到完整的执行日志，包括：
# MODEL_COMPARISON_STARTED
# AZURE_DI_CLIENT_INITIALIZED
# AZURE_DI_REQUEST_START
# MODEL_COMPARISON_COMPLETED
```

**验证 DynamoDB 结果**

```bash
# 查看 Azure DI 的提取结果
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

### Step 3: 生产部署 (5 分钟)

```bash
# 停止 cdk watch (Ctrl+C in Terminal 1)

# 最终部署
cd infra
cdk deploy --context env=dev --profile dev

# 确认部署成功后，可选：上传真实 receipt 进行最终验证
aws s3 cp ~/production-receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/ \
  --profile dev
```

---

## Consequences

### Positive ✅

1. **无需 Docker**
   - 当 Docker 不可用或有兼容性问题时，仍可进行集成测试
   - 更简洁的开发环境

2. **真实环境验证**
   - 在真实 AWS 环境中测试，而非模拟
   - 避免 LocalStack 和 AWS 的差异问题
   - 捕获真实 IAM 权限问题

3. **S3 触发支持**
   - 完整的事件链路测试
   - 不仅测试 Lambda，也测试 S3 事件通知配置

4. **自动化反馈循环**
   - `cdk watch` 自动检测代码变化
   - 无需手动构建和部署
   - 快速迭代

5. **成本合理**
   - Lambda 调用: $0.0000002 / 次 = 1000 次 $0.0002
   - S3 上传: $0.000005 / 次 = 1000 次 $0.005
   - CloudWatch 日志: $0.50 / GB
   - 总计每天开发成本 < $1（即使频繁测试）

6. **日志准确**
   - 真实 CloudWatch 日志，而非模拟
   - 与生产环境完全一致
   - 便于调试和问题追踪

7. **学习价值**
   - 学习 CDK 最佳实践
   - 理解 AWS 原生工具链
   - 为生产开发积累经验

### Negative ⚠️

1. **需要 AWS 账户和凭证**
   - 与 LocalStack 相比，需要真实的 AWS 环境
   - 但对有 AWS 账户的团队（所有成员）无额外成本

2. **网络延迟**
   - 部署需要 1-2 分钟（vs LocalStack 的 10-20 秒）
   - 但这是可以接受的权衡

3. **部署失败需要排查 AWS 问题**
   - 如果部署失败，可能是 IAM 权限、S3 配置等问题
   - 需要 AWS 知识来排查
   - 但通常错误信息清晰

---

## Comparison: LocalStack vs cdk watch

### 何时选择 LocalStack

```
✅ 需要完全离线开发（无 AWS 网络）
✅ 需要快速（< 1 分钟）部署迭代
✅ 测试 AWS 栈的配置细节
✅ 学习 AWS 服务（教育目的）
❌ 当前我们的场景不适用
```

### 何时选择 cdk watch（推荐）

```
✅ 有 AWS 账户和凭证
✅ 重视真实性胜过速度
✅ 想要捕获真实 AWS 问题
✅ 已经有 CDK 基础设施
✅ 不想维护本地 AWS 模拟
✅ 当前情况（无 Docker）
← 我们选择这个 ✨
```

---

## Migration Path

### 如果已在使用 LocalStack

```
1. 保留 LocalStack 配置作为备选
   - docker-compose.localstack.yml 保留
   - .claude/rules/localstack-testing.md 保留

2. 优先使用 cdk watch
   - 添加 npm run cdk:watch 脚本
   - 更新团队文档指向新流程

3. LocalStack 使用场景
   - 需要完全离线开发时
   - 学习 AWS 服务时
   - 性能基准测试时
```

### 新项目设置

```
✅ 直接使用 cdk watch
✅ 跳过 LocalStack 配置
✅ 关注 docs/guides/ 中的文档
```

---

## Checklist

### 启动 cdk watch 前

- [ ] AWS 凭证可用：`aws sts get-caller-identity --profile dev`
- [ ] 本地测试通过：`node test-multimodel-analyzer.mjs`
- [ ] infra/.env 已配置
- [ ] `cdk.json` 中有 watch 配置

### cdk watch 运行中

- [ ] 代码编辑时自动编译
- [ ] 没有编译错误
- [ ] CDK 自动部署到 AWS
- [ ] 部署成功（无红色错误）

### S3 上传和 Lambda 执行

- [ ] 文件成功上传到 S3
- [ ] CloudWatch 日志出现新的请求
- [ ] 日志中看到 `AZURE_DI_CLIENT_INITIALIZED`
- [ ] 日志中看到 `MODEL_COMPARISON_COMPLETED`
- [ ] DynamoDB 中有新的结果

### 最终部署

- [ ] cdk watch 已停止 (Ctrl+C)
- [ ] 所有本地测试通过
- [ ] CloudWatch 日志清晰无误
- [ ] DynamoDB 结果正确
- [ ] 执行 `cdk deploy` 最终部署

---

## Documentation References

| 文档 | 位置 | 用途 |
|------|------|------|
| **快速开始** | `docs/guides/CDK-WATCH-QUICK-START.md` | 3 个命令启动测试 |
| **工作流指南** | `docs/guides/LAMBDA-DEVELOPMENT-WORKFLOW.md` | 详细工作流程 |
| **评估报告** | `docs/guides/DEVELOPMENT-WORKFLOW-ASSESSMENT.md` | 方案对比分析 |
| **本地测试** | `experiments/azure-di/test-multimodel-analyzer.mjs` | Pure Node.js 测试脚本 |
| **旧方案** | `.claude/rules/localstack-testing.md` | LocalStack 配置（备选） |

---

## Related Decisions

- **[ADR-016](./016-lambda-local-first-testing.md)**: Lambda 本地优先测试 - 定义三层架构
- **[ADR-014](./014-lambda-layer-version-management.md)**: Lambda Layer 版本管理
- **[ADR-015](./015-sdk-over-rest-api.md)**: SDK 优于 REST API

---

## Conclusion

**cdk watch 是比 LocalStack 更优的 Lambda 集成测试方案**，特别是：

- ✅ 当无 Docker 时
- ✅ 当重视真实性时
- ✅ 当想快速迭代时
- ✅ 当成本约束时

**推荐工作流**:
```
Pure Node.js (5 min) → cdk watch (15 min) → cdk deploy (5 min)
总时间: 25 分钟，完整验证，成本 < $0.01
```

---

*此决策旨在简化 Lambda 开发流程，不依赖 Docker，同时保证测试的真实性和完整性。*
