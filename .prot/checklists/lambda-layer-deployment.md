# Lambda Layer 部署清单

> 修改 shared-layer 代码后的操作流程。确保不会重复犯"代码改了但Lambda仍用旧版本"的错误。

## Pre-Deployment 检查

- [ ] 已修改 `lambda/shared-layer/nodejs/shared/*.mjs` 文件？
  - [ ] 如果否，跳过本清单，只需 `npm run deploy`
  - [ ] 如果是，继续下一步

- [ ] 已验证代码修改的语法？
  ```bash
  node -c lambda/shared-layer/nodejs/shared/model-analyzer.mjs
  ```

- [ ] 已在本地测试过修改的代码逻辑？

---

## 部署步骤

### 方案 A: 快速发布（推荐用于修复）

✅ **场景**: 修复 bug、紧急部署、不想等 CDK

```bash
# Step 1: 打包 Layer（位置：infra 目录）
cd /Users/woo/dev/yorutsuke-v2-1/infra
zip -r /tmp/layer.zip lambda/shared-layer/nodejs
# ✓ 验证: /tmp/layer.zip 被创建

# Step 2: 发布新版本
LAYER_VERSION=$(aws lambda publish-layer-version \
  --layer-name yorutsuke-shared-dev \
  --zip-file fileb:///tmp/layer.zip \
  --compatible-runtimes nodejs20.x \
  --profile dev | jq -r '.Version')

echo "✅ Published Layer Version: $LAYER_VERSION"
# ✓ 记下版本号（例如: 16, 17, 18）

# Step 3: 更新 Lambda 函数们
for FUNC in yorutsuke-instant-processor-us-dev yorutsuke-batch-us-dev; do
  aws lambda update-function-configuration \
    --function-name $FUNC \
    --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:$LAYER_VERSION \
    --profile dev
  echo "✅ Updated $FUNC"
done

# Step 4: 验证（必须做！）
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers[0].Arn'
# ✓ 期望看到: arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:$LAYER_VERSION
```

**耗时**: 2 分钟
**可靠性**: 100%
**何时用**: 大多数情况

---

### 方案 B: CDK 部署（推荐用于完整部署）

✅ **场景**: 同时修改环境变量、功能代码、Layer

```bash
# Step 1: 清除 CDK 缓存（强制重新计算文件哈希）
cd /Users/woo/dev/yorutsuke-v2-1/infra
rm -rf cdk.out

# Step 2: 重新合成（这会检测到代码变更）
npm run synth

# Step 3: 预览变更
npm run diff -- --profile dev

# Step 4: 部署
export CDK_DEFAULT_ACCOUNT=696249060859
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY="<REDACTED_SECRET>"
npm run deploy -- --profile dev --all --require-approval never

# Step 5: 验证
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers[0]'
```

**耗时**: 5 分钟
**可靠性**: 95% (取决于 CDK 缓存)
**何时用**: 完整系统更新

---

## Validation 检查表

部署后 **必须** 验证（5 分钟内）：

- [ ] **检查 Layer 版本是否更新**
  ```bash
  aws lambda get-function-configuration \
    --function-name yorutsuke-instant-processor-us-dev \
    --profile dev | jq '.Layers'
  ```
  期望看到新的版本号

- [ ] **检查 Layer 发布时间是否正确**
  ```bash
  aws lambda list-layer-versions \
    --layer-name yorutsuke-shared-dev \
    --profile dev | jq '.LayerVersions[0:2]'
  ```
  期望看到最新版本的 CreatedDate 是当前时间

- [ ] **检查 CloudWatch 日志是否反映新代码**
  ```bash
  aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
    --follow --profile dev --since 1m
  ```
  上传一张收据测试，观察日志是否包含新的行为

- [ ] **手动测试新功能**
  - 打开 Tauri 应用
  - 上传测试收据
  - 观察是否包含新的字段或行为

---

## 常见失败及修复

### 失败 1: "Layer 没有更新"

**症状**: 检查 Layers 仍显示旧版本号

**诊断**:
```bash
# 查看最新发布的 Layer 版本
aws lambda list-layer-versions \
  --layer-name yorutsuke-shared-dev \
  --profile dev | jq '.LayerVersions[0:2]'

# 查看 Lambda 使用的 Layer
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers'
```

**修复**: 重新执行部署步骤的 Step 3 和 Step 5

---

### 失败 2: "zip: command not found"

**症状**:
```
bash: zip: command not found
```

**修复**:
```bash
# macOS
brew install zip

# Linux
apt-get install zip

# 或使用 Node.js 实现
npm install -g cross-zip
```

---

### 失败 3: "Profile dev not found"

**症状**:
```
Error: Could not determine AWS account to use
```

**修复**:
```bash
# 检查 AWS 配置
aws configure list --profile dev

# 如果不存在，设置 profile
export AWS_PROFILE=dev
```

---

## 故障排除流程

当 Lambda 仍使用旧代码时：

```
1. 确认修改了 lambda/shared-layer/nodejs/shared/*.mjs
   └─ 如果没有，问题不在这里

2. 验证代码文件确实被修改了
   grep -n "修改的内容" lambda/shared-layer/nodejs/shared/*.mjs

3. 检查 zip 文件是否包含新代码
   unzip -l /tmp/layer.zip | grep model-analyzer.mjs

4. 检查 Layer 是否发布了新版本
   aws lambda list-layer-versions --layer-name yorutsuke-shared-dev --profile dev

5. 检查 Lambda 是否指向新 Layer
   aws lambda get-function-configuration --function-name ... --profile dev | jq '.Layers'

6. 如果 Layer 版本是新的但 Lambda 仍用旧的
   → 需要显式更新 Lambda 的 Layer ARN（步骤 2 中的 Step 3）

7. 如果都正确但仍不生效
   → Lambda 可能有缓存，等待 1-2 分钟或创建新的 Invocation
```

---

## 记住这三件事

1. **Layer 是不可变的** - 代码改了必须发布新版本
2. **Lambda 指向特定版本** - 新版本不会自动被使用
3. **验证是最后一步** - 没验证就没成功

---

## 快速参考

| 情况 | 命令 |
|------|------|
| 发布新版本 | `cd infra && zip -r /tmp/layer.zip lambda/shared-layer/nodejs && aws lambda publish-layer-version ...` |
| 查看当前版本 | `aws lambda get-function-configuration --function-name yorutsuke-instant-processor-us-dev --profile dev \| jq '.Layers'` |
| 查看所有版本 | `aws lambda list-layer-versions --layer-name yorutsuke-shared-dev --profile dev` |
| 更新 Lambda | `aws lambda update-function-configuration --function-name ... --layers arn:...` |

---

完整文档: `.claude/rules/lambda-layer-deployment.md`
快速查表: `.claude/rules/lambda-quick-reference.md`
