# Lambda 开发指南

Lambda 开发的完整指南和最佳实践，包括本地测试、云端集成和生产部署。

## 📚 文档导航

### 推荐阅读顺序

#### 1️⃣ 快速开始（5 分钟）
**如果你只有 5 分钟，从这里开始**

- **[CDK-WATCH-QUICK-START.md](./CDK-WATCH-QUICK-START.md)** - 3 个命令启动 Lambda 云端测试
  - 启动 cdk watch
  - 上传文件触发 Lambda
  - 查看 CloudWatch 日志

#### 2️⃣ 完整工作流（30 分钟）
**理解三阶段 Lambda 开发过程**

- **[LAMBDA-DEVELOPMENT-WORKFLOW.md](./LAMBDA-DEVELOPMENT-WORKFLOW.md)** - 详细的 Lambda 开发流程指南
  - Step 1: Pure Node.js 本地验证
  - Step 2: cdk watch 云端集成测试
  - Step 3: cdk deploy 生产部署
  - 时间成本分析
  - CDK 配置现状评估

#### 3️⃣ 决策和评估（20 分钟）
**理解为什么选择 cdk watch 而不是 SAM/LocalStack**

- **[DEVELOPMENT-WORKFLOW-ASSESSMENT.md](./DEVELOPMENT-WORKFLOW-ASSESSMENT.md)** - 详细的方案评估和对比
  - SAM 方案评估 (33/100)
  - cdk watch 方案评估 (98/100)
  - 时间和成本对比
  - 风险评估
  - 最终建议

### Azure DI 集成（可选）

如果你在做 Azure Document Intelligence 集成，查看这些文档：

- **[azure-di/QUICK-START.md](./azure-di/QUICK-START.md)** - Azure DI 快速指南
- **[azure-di/COMPLETION-SUMMARY.md](./azure-di/COMPLETION-SUMMARY.md)** - 完整实现总结
- **[azure-di/SAM-LOCAL-TEST-RESULTS.md](./azure-di/SAM-LOCAL-TEST-RESULTS.md)** - SAM 本地测试结果（备选）

---

## 🎯 按场景快速查找

### 我想快速测试 Lambda...

**场景**: 需要在 5 分钟内运行一次 Lambda 测试

```bash
# 1. 查看：CDK-WATCH-QUICK-START.md
# 2. 执行三个命令
cdk watch --profile dev
aws s3 cp receipt.jpg s3://...
aws logs tail /aws/lambda/... --follow --profile dev
```

**文档**: [CDK-WATCH-QUICK-START.md](./CDK-WATCH-QUICK-START.md)

---

### 我想理解完整的开发流程...

**场景**: 需要理解从本地测试到生产部署的完整过程

**阅读顺序**:
1. [LAMBDA-DEVELOPMENT-WORKFLOW.md](./LAMBDA-DEVELOPMENT-WORKFLOW.md) - 总体流程
2. `.claude/rules/cdk-watch-testing.md` - 操作指南
3. `docs/architecture/ADR/018-cdk-watch-cloud-driven-testing.md` - 架构决策

---

### 我正在做 Lambda 开发决策...

**场景**: 需要在 SAM/LocalStack/cdk watch 之间做出选择

**阅读顺序**:
1. [DEVELOPMENT-WORKFLOW-ASSESSMENT.md](./DEVELOPMENT-WORKFLOW-ASSESSMENT.md) - 详细对比
2. `docs/architecture/ADR/018-cdk-watch-cloud-driven-testing.md` - 最终决策
3. `.claude/rules/cdk-watch-testing.md` - 操作规范

---

### 我在集成 Azure Document Intelligence...

**场景**: 需要在 Lambda 中使用 Azure DI SDK

**阅读顺序**:
1. [azure-di/QUICK-START.md](./azure-di/QUICK-START.md) - 快速入门
2. [azure-di/COMPLETION-SUMMARY.md](./azure-di/COMPLETION-SUMMARY.md) - 实现细节
3. `docs/architecture/ADR/015-sdk-over-rest-api.md` - SDK 决策

---

## 📊 工作流程图

### 完整的 Lambda 开发循环 (25 分钟)

```
┌───────────────────────────────────────────────────────────┐
│ Phase 1: Pure Node.js 本地验证 (5 分钟)                   │
├───────────────────────────────────────────────────────────┤
│ 命令: node experiments/azure-di/test-multimodel-analyzer.mjs│
│ 验证: Azure SDK 初始化、API 调用逻辑、数据格式            │
│ 文档: 参考本地测试脚本                                    │
└───────────────┬─────────────────────────────────────────┘
                ↓ ✅ 通过
┌───────────────────────────────────────────────────────────┐
│ Phase 2: cdk watch 云端集成测试 (15 分钟)                │
├───────────────────────────────────────────────────────────┤
│ Terminal 1: cdk watch --profile dev                       │
│ Terminal 2: aws s3 cp receipt.jpg s3://...                │
│ Terminal 3: aws logs tail ... --follow                    │
│ 验证: S3 触发、Lambda 执行、DynamoDB 保存、日志           │
│ 文档: CDK-WATCH-QUICK-START.md                            │
└───────────────┬─────────────────────────────────────────┘
                ↓ ✅ 通过
┌───────────────────────────────────────────────────────────┐
│ Phase 3: cdk deploy 生产部署 (5 分钟)                    │
├───────────────────────────────────────────────────────────┤
│ 命令: cdk deploy --context env=dev --profile dev          │
│ 验证: 基础设施一致性确认                                 │
│ 文档: LAMBDA-DEVELOPMENT-WORKFLOW.md                      │
└───────────────────────────────────────────────────────────┘

总时间: 25 分钟
成本: < $0.01/测试
质量: 100% 与生产一致
```

---

## 🔧 快速参考命令

### Step 1: 本地测试 (5 分钟)

```bash
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di

export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=your-key-here

node test-multimodel-analyzer.mjs
```

### Step 2: cdk watch 云端测试 (15 分钟)

```bash
# Terminal 1: 启动实时监听
cd /Users/woo/dev/yorutsuke-v2-1/infra
cdk watch --profile dev

# Terminal 2: 上传文件触发 Lambda
aws s3 cp ~/receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/test.jpg \
  --profile dev

# Terminal 3: 查看日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev

# 验证 DynamoDB 结果
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --profile dev | jq '.Items[0].modelComparison.M.azure_di'
```

### Step 3: 生产部署 (5 分钟)

```bash
cd /Users/woo/dev/yorutsuke-v2-1/infra
cdk deploy --context env=dev --profile dev
```

---

## 📖 详细参考

### 规则和最佳实践

| 文件 | 用途 | 位置 |
|------|------|------|
| **cdk-watch-testing.md** | CDK Watch 操作规范 | `.claude/rules/` |
| **lambda-local-first.md** | Lambda 本地优先原则 | `.claude/rules/` |
| **lambda-layer-deployment.md** | Layer 部署细节 | `.claude/rules/` |
| **lambda-quick-reference.md** | Lambda 快速参考 | `.claude/rules/` |

### 架构决策 (ADR)

| ADR | 标题 | 位置 |
|-----|------|------|
| **ADR-016** | Lambda 本地优先测试策略 | `docs/architecture/ADR/` |
| **ADR-017** | LocalStack 集成测试（备选） | `docs/architecture/ADR/` |
| **ADR-018** | cdk watch 云端驱动测试 | `docs/architecture/ADR/` |
| **ADR-015** | SDK 优于 REST API | `docs/architecture/ADR/` |
| **ADR-014** | Lambda Layer 版本管理 | `docs/architecture/ADR/` |

---

## ✅ 核心检查清单

### 开发前

- [ ] AWS 凭证可用：`aws sts get-caller-identity --profile dev`
- [ ] 环境变量配置：`cat infra/.env | grep AZURE_DI`
- [ ] 本地 Node.js 测试通过

### cdk watch 运行中

- [ ] Terminal 1: cdk watch 正在监听文件
- [ ] Terminal 2: S3 文件上传成功
- [ ] Terminal 3: CloudWatch 日志出现新请求

### 部署前

- [ ] 所有本地测试通过 ✅
- [ ] CloudWatch 日志清晰无误
- [ ] DynamoDB 结果正确
- [ ] 执行 cdk deploy 最终部署

---

## 🎓 学习资源

### 新手入门

1. **阅读**: [CDK-WATCH-QUICK-START.md](./CDK-WATCH-QUICK-START.md) (10 分钟)
2. **执行**: 三个命令运行完整测试 (10 分钟)
3. **观察**: CloudWatch 日志和 DynamoDB 结果 (5 分钟)

### 深入学习

1. **理论**: [LAMBDA-DEVELOPMENT-WORKFLOW.md](./LAMBDA-DEVELOPMENT-WORKFLOW.md) (30 分钟)
2. **决策**: [DEVELOPMENT-WORKFLOW-ASSESSMENT.md](./DEVELOPMENT-WORKFLOW-ASSESSMENT.md) (30 分钟)
3. **实践**: 修改代码，观察 cdk watch 自动部署 (持续)

### 高级话题

- **Layer 管理**: `docs/architecture/ADR/014-lambda-layer-version-management.md`
- **SDK 选择**: `docs/architecture/ADR/015-sdk-over-rest-api.md`
- **本地优先策略**: `docs/architecture/ADR/016-lambda-local-first-testing.md`

---

## 🚀 下一步

### 立即开始

```bash
# 5 分钟快速测试
cd /Users/woo/dev/yorutsuke-v2-1/infra && cdk watch --profile dev
```

参考: [CDK-WATCH-QUICK-START.md](./CDK-WATCH-QUICK-START.md)

### 完整了解

```bash
# 30 分钟理解完整流程
cat docs/guides/LAMBDA-DEVELOPMENT-WORKFLOW.md
```

### 决策参考

```bash
# 20 分钟了解方案对比
cat docs/guides/DEVELOPMENT-WORKFLOW-ASSESSMENT.md
```

---

## 📞 获取帮助

### 常见问题

- **"cdk watch 无法启动"** → 查看 [CDK-WATCH-QUICK-START.md](./CDK-WATCH-QUICK-START.md) 的故障排查
- **"Lambda 无法被触发"** → 查看 `.claude/rules/cdk-watch-testing.md` 的故障排查
- **"DynamoDB 没有保存结果"** → 查看 `.claude/rules/cdk-watch-testing.md` 的故障排查

### 深入帮助

- **规则问题**: `.claude/rules/cdk-watch-testing.md`
- **架构问题**: `docs/architecture/ADR/018-cdk-watch-cloud-driven-testing.md`
- **操作问题**: `docs/guides/LAMBDA-DEVELOPMENT-WORKFLOW.md`

---

## 📈 改进和反馈

这些文档基于实践经验。如果你发现：

- ❓ **不清楚的地方** → 提出问题
- 🐛 **步骤不工作** → 报告 bug
- 💡 **改进建议** → 提供反馈

所有反馈都帮助我们改进开发流程。

---

**最后更新**: 2026-01-14
**版本**: 1.0 (cdk watch 方案)
**状态**: ✅ 生产就绪
