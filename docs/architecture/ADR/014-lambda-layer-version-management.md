# ADR-014: Lambda 部署与同步策略（三层架构）

**状态**: 已接受（2026-01-14 修订）
**日期**: 2026-01
**相关组件**: AWS Lambda, Lambda Layers, AWS CDK, Azure DI SDK, cdk watch
**相关决策**: [ADR-016](./016-lambda-local-first-testing.md) (三层 Lambda 测试), [ADR-018](./018-cdk-watch-cloud-driven-testing.md) (cdk watch 云端驱动)

---

## 背景 (Context)

### 问题

在集成 Azure Document Intelligence (DI) 等复杂 SDK 时，核心逻辑位于 `shared-layer`。由于 AWS Lambda Layer 的**不可变性**和 AWS CDK 的**资源哈希缓存机制**，导致以下问题：

1. **代码已修改，Lambda 仍使用旧版本**
   - 修改 `lambda/shared-layer/nodejs/shared/model-analyzer.mjs`（Azure DI API 路径修复）
   - 运行 `cdk deploy` 显示 "(no changes)"，缓存导致未重新计算哈希
   - Lambda Layer 版本未递增
   - Lambda 函数仍指向旧版本

2. **根本原因**
   - Lambda Layer 版本是不可变快照（Version 15 永远是 Version 15）
   - CDK 资源哈希缓存：源文件改变但哈希值被缓存
   - `cdk deploy` 不触发新 `LayerVersion` 创建
   - Lambda 函数的 Layer ARN 保持不变

3. **调试发现过程**
   - API 返回 404（使用旧的 API 路径）
   - CloudWatch 日志显示 Azure DI 请求使用了错误的端点
   - 检查 Lambda Layer：仍为 Version 15（旧代码）
   - 检查最新 Layer 版本：Version 15 是最新的

---

## 决策：三层部署架构 (The Three-Tier Strategy)

采用分层部署策略，根据文件变动类型选择**最快的同步路径**，平衡"云端真实环境"和"秒级同步"。

### **Tier 1: 极速路径 (Manual Layer Sync) — < 10 秒**

**适用场景**：仅修改 `infra/lambda/shared-layer/nodejs/shared/*.mjs`
**操作**：手动打包 Zip 并通过 AWS CLI 直接发布新版本，随后更新 Lambda 函数配置
**优势**：
- ✅ 跳过 CloudFormation，同步时间 < 10 秒
- ✅ 确定性：总是创建新版本（无缓存干扰）
- ✅ 可见性：明确的版本号显示在命令输出中
- ✅ 可靠性：无 CDK 缓存问题

**何时使用**：
- 紧急 bug 修复（需立即部署）
- 孤立的 Layer 代码改动
- 快速验证 SDK 改动

**执行步骤**：

```bash
# Step 1: 打包 Layer（必须保证 nodejs/ 是根目录）
cd infra/lambda/shared-layer
zip -r /tmp/layer.zip nodejs/

# Step 2: 发布新版本到 AWS
aws lambda publish-layer-version \
  --layer-name yorutsuke-shared-dev \
  --zip-file fileb:///tmp/layer.zip \
  --compatible-runtimes nodejs20.x \
  --profile dev

# 输出示例：
# {
#   "Version": 16,
#   "LayerVersionArn": "arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16"
# }

# Step 3: 更新所有关联函数使用新 Layer
aws lambda update-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16 \
  --profile dev

aws lambda update-function-configuration \
  --function-name yorutsuke-batch-processor-us-dev \
  --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16 \
  --profile dev

# Step 4: 验证所有函数都指向新版本
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers[0].Arn'

# 预期输出：arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16
```

---

### **Tier 2: 实时路径 (CDK Watch / Hotswap) — 1-3 秒**

**适用场景**：修改 Lambda 处理程序 (`index.mjs`)、环境变量或非破坏性基建变更
**操作**：运行 `npx cdk watch --profile dev` 开启监听模式
**优势**：
- ✅ 代码保存即同步（自动检测变更）
- ✅ 自动 Hotswap（AWS CDK 的热交换能力）
- ✅ 无需手动命令，开发体验最佳
- ✅ 真实 AWS 环境测试

**何时使用**：
- Lambda 函数业务逻辑改动（`instant-processor/index.mjs` 等）
- Lambda 环境变量配置改动
- Lambda 角色权限改动（非破坏性）
- 本地开发迭代周期

**执行步骤**：

```bash
# Terminal 1: 启动 cdk watch（持续监听代码变化）
cd infra
npx cdk watch --profile dev

# 输出应显示：
# ✨ File watch mode enabled
# [监听代码变化中...]

# Terminal 2: 修改代码
# 编辑 infra/lambda/instant-processor/index.mjs
# Ctrl+S 保存

# Terminal 1: 自动检测到变化并部署
# 输出示例：
# [变化检测] instant-processor 代码变更
# [自动部署] 已推送到 Lambda

# Terminal 3: 上传文件测试或查看日志
aws s3 cp ~/test-receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/test.jpg \
  --profile dev

aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev
```

**Tier 2 和 Tier 1 的关键差异**：
- Tier 1 只作用于 Layer，Tier 2 作用于 Lambda 函数代码
- Tier 2 自动化，Tier 1 需手动命令
- Tier 2 开发友好，Tier 1 速度最快

---

### **Tier 3: 标准路径 (Full Deploy) — 3-5 分钟**

**适用场景**：生产发布、IAM 角色变更、新增 AWS 资源、完整基建同步
**操作**：`npm run deploy` (即 `cdk deploy --profile dev`)
**优势**：
- ✅ 确保基建 100% 状态一致
- ✅ 版本控制完整（git 记录）
- ✅ 完整的 CloudFormation 验证
- ✅ 适合团队协作和生产环境

**何时使用**：
- 准备合并 PR（完整验证）
- 发布到生产环境
- IAM/角色权限大改动
- 新增 S3 Bucket/DynamoDB 表等资源
- 修复基建漂移

**执行步骤**：

```bash
# 清除 CDK 缓存（确保最新）
rm -rf cdk.out

# 合成（验证所有改动）
npm run synth

# 完整部署所有 stack
npm run deploy

# 验证部署结果
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers[0].Arn'

aws lambda get-function-configuration \
  --function-name yorutsuke-batch-processor-us-dev \
  --profile dev | jq '.Layers[0].Arn'

# 验证两个函数都使用同一个最新 Layer 版本
```

---

## 实现规则 (Implementation Rules)

### Rule 1: Tier 1 的正确打包结构

打包时必须确保 `nodejs/` **是压缩包的根目录**，否则 Lambda 无法识别路径。

```bash
# ✅ 正确：进入 shared-layer 目录，以 nodejs/ 为根
cd infra/lambda/shared-layer
zip -r /tmp/layer.zip nodejs/

# 验证压缩包结构
unzip -l /tmp/layer.zip | head -10
# 应该看到：
# nodejs/
# nodejs/shared/
# nodejs/shared/model-analyzer.mjs
# nodejs/shared/schemas.mjs
# ...

# ❌ 错误：从 infra 目录打包会产生错误的路径
cd infra
zip -r /tmp/layer.zip lambda/shared-layer/nodejs
# 这会产生: lambda/shared-layer/nodejs/shared/xxx.mjs (错误)
```

### Rule 2: 多函数同步校验

手动更新 Layer 后，必须验证**所有关联函数**都指向了最新的**同一个** ARN。

```bash
# 检查所有关联函数
for func in yorutsuke-instant-processor-us-dev yorutsuke-batch-processor-us-dev; do
  echo "=== $func ==="
  aws lambda get-function-configuration \
    --function-name $func \
    --profile dev | jq '.Layers[0].Arn'
done

# 预期输出：两个函数应该指向同一个 ARN
# === yorutsuke-instant-processor-us-dev ===
# "arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16"
# === yorutsuke-batch-processor-us-dev ===
# "arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16"
```

### Rule 3: 故障回滚

若更新后报错，立即将函数指向前一个稳定的 Layer 版本 ARN。

```bash
# 查看 Layer 历史版本
aws lambda list-layer-versions \
  --layer-name yorutsuke-shared-dev \
  --profile dev | jq '.LayerVersions[] | {Version, CreatedDate}'

# 回滚到上一个版本
PREV_VERSION=15  # 上一个稳定版本
aws lambda update-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:$PREV_VERSION \
  --profile dev

aws lambda update-function-configuration \
  --function-name yorutsuke-batch-processor-us-dev \
  --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:$PREV_VERSION \
  --profile dev

# 验证已回滚
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers[0].Arn'
```

### Rule 4: 提交信息文档化

使用新 Layer 版本后，提交信息应包含**版本号**和**原因**。

```bash
# 示例提交信息
git commit -m "fix: update Azure DI API path in model-analyzer.mjs (Layer v16)

- Fixed incorrect Azure endpoint configuration
- Published Layer v16 and updated Lambda functions
- Verified: instant & batch processors now use v16
"
```

---

## 决策选择流程图 (Decision Tree)

```
修改了源代码文件
    ↓
什么类型的改动?
    │
    ├─ infra/lambda/shared-layer/nodejs/shared/*.mjs?
    │  └─ YES → Tier 1 (Manual Layer Sync) — < 10秒
    │     • 打包 zip
    │     • 发布 Layer
    │     • 更新 Lambda 函数 ARN
    │     • 验证所有函数都指向新版本
    │
    ├─ infra/lambda/[instant|batch]-processor/index.mjs?
    │  └─ YES → Tier 2 (cdk watch) — 1-3秒
    │     • cdk watch 自动同步
    │     • 开发时最快
    │
    ├─ infra/lib/*.ts (CDK 代码)?
    │  └─ YES → Tier 3 (Full Deploy) — 3-5分钟
    │     或
    │     → 环境变量?
    │       └─ YES → Tier 3 (Full Deploy)
    │
    ├─ 其他改动 (S3 配置、IAM 角色等)?
    │  └─ YES → Tier 3 (Full Deploy) — 3-5分钟
    │
    └─ 准备合并 PR / 部署到生产?
       └─ 运行 Tier 3 进行最终验证
```

---

## 影响 (Consequences)

### ✅ 正向影响

1. **大幅提升联调速度**
   - Azure DI 等复杂 SDK 改动：Tier 1（< 10秒）vs CDK（3-5分钟）
   - Lambda 函数改动：Tier 2（1-3秒，自动）vs 手动部署

2. **防止"代码变更但未部署"的无声失败**
   - Tier 1 强制创建新版本，无缓存干扰
   - 明确的版本号验证

3. **提升开发体验**
   - Tier 2 `cdk watch` 提供接近本地开发的实时反馈
   - 无需等待完整部署周期

4. **降低生产风险**
   - Tier 3 确保完整的基建验证
   - 明确的三层选择防止错误部署

### ⚠️ 负向影响

1. **操作复杂性**
   - Tier 1 需要手动命令（虽然可自动化）
   - 开发者需理解三层架构并做出正确选择

2. **CDK 本地状态偏差（低风险）**
   - Tier 1 是"带外操作"（out-of-band）
   - 若不及时通过 Tier 3 同步，CDK 本地状态与云端存在微小差异
   - **缓解**: 下次全量部署（Tier 3）会自动修正

3. **多函数同步的手动负担**
   - Tier 1 涉及多个 Lambda 函数时，需手动逐个更新
   - **缓解**: 可编写 `sync-layer.sh` 脚本全自动化

---

## 缓解措施 (Mitigations)

| 问题 | 缓解方案 |
|------|--------|
| Tier 1 操作复杂 | 提供 `sync-layer.sh` 自动化脚本 |
| 易选错部署路径 | 决策树文档化 + 快速参考卡片 |
| CDK 状态偏差 | 定期运行 Tier 3 同步（每天或每周） |
| 多函数更新易遗漏 | 脚本集成多函数验证逻辑 |

---

## 相关文件 (References)

| 文件 | 目的 |
|------|------|
| `.claude/rules/lambda-layer-deployment.md` | 详细实现指南 |
| `.claude/rules/lambda-quick-reference.md` | 快速参考卡片 |
| `.prot/checklists/lambda-layer-deployment.md` | 部署前检查清单 |
| `infra/scripts/sync-layer.sh` | 自动化脚本（待创建） |

---

## 相关决策 (Related ADRs)

- **[ADR-001](./001-service-pattern.md)**: Service 模式（Lambda 函数使用共享 Layer）
- **[ADR-013](./013-environment-based-secrets.md)**: 环境变量管理（Layer 中的凭证）
- **[ADR-016](./016-lambda-local-first-testing.md)**: Lambda 本地优先测试（三层测试架构）
- **[ADR-018](./018-cdk-watch-cloud-driven-testing.md)**: cdk watch 云端驱动测试

---

## 时间线 (Timeline)

| 日期 | 事件 |
|------|------|
| 2026-01-14 02:00 | Azure DI API 路径 bug 发现（404 错误） |
| 2026-01-14 02:30 | 代码修复应用到 model-analyzer.mjs |
| 2026-01-14 02:35 | CDK 部署显示"(no changes)"— Layer 未更新 |
| 2026-01-14 03:00 | 根本原因确认：Layer 版本管理 |
| 2026-01-14 03:05 | 手动发布 Layer v16 并更新函数 |
| 2026-01-14 03:06 | Lambda 函数更新为 v16 |
| 2026-01-14 03:07 | 验证：Lambda 现在使用正确的 Layer |
| 2026-01-14 23:00 | ADR-014 升级为三层架构（包含 Tier 2: cdk watch） |

---

## 背景知识：AWS Lambda Layer 行为 (Appendix)

### 为什么 Layer 不会自动更新？

```
Lambda Layer 版本 = 不可变快照
    ├─ Version 1: 代码A（永久固定）
    ├─ Version 2: 代码B（永久固定）
    └─ Version 15: 代码Z（当前版本，也永久固定）

Lambda 函数
    └─ Layers: [arn:....:layer:shared-dev:15]  ← 固定引用 Version 15

修改源文件
    ↓
CDK 缓存了旧哈希
    ↓
输出 "(no changes)"
    ↓
Layer Version 15 保持不变 ← 函数仍使用 v15 ❌
```

### Tier 1：为什么手动发布有效？

```
修改源文件
    ↓
zip 打包
    ↓
aws lambda publish-layer-version
    ↓
创建新快照：Version 16
    ↓
aws lambda update-function-configuration（更新 ARN）
    ↓
函数现在使用 Version 16 代码 ✅
```

### Tier 2：为什么 cdk watch 有效？

```
cdk watch 启动（监听模式）
    ↓
修改 Lambda 函数代码 (instant-processor/index.mjs)
    ↓
保存文件
    ↓
CDK 检测到变更（无缓存）
    ↓
CDK Hotswap：无需等待 CloudFormation
    ↓
直接推送新代码到 Lambda
    ↓
1-3 秒内完成 ✅
```

---

## 实践建议 (Best Practices)

1. **开发时使用 Tier 2** (`cdk watch`)
   - 提供最快的反馈循环
   - 无需担心 Layer/函数区别

2. **Layer 改动使用 Tier 1** (Manual Layer Sync)
   - 最快速（< 10 秒）
   - 确保无缓存问题

3. **每日结束或 PR 前运行 Tier 3** (Full Deploy)
   - 确保本地 CDK 状态与云端同步
   - 捕获任何基建漂移

4. **提交信息包含版本号**
   - 便于追踪 Layer 版本变化
   - 简化故障诊断

---

*此决策旨在为 Yorutsuke v2 的 AI 辅助开发提供快速、可靠、易于理解的部署流程，特别优化了 Azure DI 等复杂 SDK 的集成联调体验。*
