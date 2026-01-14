# Lambda Layer 部署最佳实践

> 基于 Azure DI 部署调试经验。避免修改代码后Lambda仍在使用旧版本的问题。

## 核心概念

### Layer 是不可变的（Immutable）

```
Lambda Layer 版本 = 代码快照
├─ Version 1: 代码A
├─ Version 2: 代码B（新版本，不替换Version 1）
└─ Version N: 代码C（当前使用）

Lambda Function 指向特定版本的 ARN
└─ arn:aws:lambda:region:account:layer:name:15  ← 固定引用
```

**关键点**:
- 修改源文件 ≠ 更新 Layer
- Layer 版本号递增，永不回收
- Lambda 需要显式指向新 ARN 才能使用新代码

---

## 问题场景 & 解决方案

### ❌ 问题 1: CDK 部署后 Lambda 仍用旧代码

**症状**：
```bash
# 修改了 lambda/shared-layer/nodejs/shared/model-analyzer.mjs
# 运行 npm run deploy，看到 "(no changes)"
# Lambda 仍在使用旧版本代码
```

**根本原因**：
- CDK LayerVersion 没有检测到代码变更
- CDK 缓存导致不重新计算文件哈希
- Lambda Function 的 Layer ARN 没有更新

**✅ 解决方案**：

#### 方案 A: 清除 CDK 缓存 + 强制重新合成

```bash
# 1. 清除 CDK 缓存
rm -rf cdk.out

# 2. 重新合成（会重新计算文件哈希）
npm run synth

# 3. 部署
npm run deploy -- --profile dev --all --require-approval never
```

**何时使用**: 小改动，希望用 CDK 管理版本

#### 方案 B: 手动发布 Layer + 更新 Lambda（最可靠）

```bash
# 1. 打包 Layer
cd infra
zip -r /tmp/layer.zip lambda/shared-layer/nodejs

# 2. 发布新版本到 AWS
aws lambda publish-layer-version \
  --layer-name yorutsuke-shared-dev \
  --zip-file fileb:///tmp/layer.zip \
  --compatible-runtimes nodejs20.x \
  --profile dev

# 返回结果示例:
# {
#   "Version": 16,
#   "LayerVersionArn": "arn:aws:lambda:us-east-1:....:layer:yorutsuke-shared-dev:16"
# }

# 3. 更新 Lambda 函数使用新 Layer
aws lambda update-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16 \
  --profile dev

# 验证
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers'
```

**何时使用**:
- ✅ 紧急修复（需要立即部署）
- ✅ CDK 缓存问题（无法清除）
- ✅ 多个 Lambda 引用同一 Layer（一次性更新所有）
- ✅ 不想等 CDK 重新合成（快速验证）

**优点**: 完全可控，立即生效，不依赖 CDK 缓存

---

### ❌ 问题 2: 不知道 Lambda 当前使用的是哪个 Layer 版本

**✅ 解决方案**:

```bash
# 查看 Lambda 使用的 Layer
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers'

# 返回
# [
#   {
#     "Arn": "arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16",
#     "CodeSize": 1125019
#   }
# ]

# 查看该 Layer 版本的创建时间（验证是否是最新）
aws lambda list-layer-versions \
  --layer-name yorutsuke-shared-dev \
  --profile dev | jq '.LayerVersions | .[0:3]'

# 返回
# [
#   {
#     "Version": 16,
#     "CreatedDate": "2026-01-14T03:05:00.624+0000"  ← 最新
#   },
#   {
#     "Version": 15,
#     "CreatedDate": "2026-01-14T02:01:39.000+0000"
#   }
# ]
```

---

### ❌ 问题 3: 修改了代码，不确定是否要发布新 Layer 版本

**判断流程**:

```
修改了源代码
    ↓
是否修改 lambda/shared-layer/nodejs/shared/*.mjs？
    ├─ 是 → 需要发布新 Layer 版本
    ├─ 是 → 需要更新 Lambda 函数的 Layer ARN
    └─ 否 → 只需 CDK 部署即可

例子：
✅ 修改 model-analyzer.mjs → 发布 Layer
❌ 修改 Lambda function code → CDK 部署足够
```

---

## 部署清单

### 修改 Shared Layer 代码时

```bash
# ✅ 推荐流程

# 1. 编辑文件
vim lambda/shared-layer/nodejs/shared/model-analyzer.mjs

# 2. 验证改动
grep -n "document-intelligence" lambda/shared-layer/nodejs/shared/model-analyzer.mjs

# 3. 打包 + 发布新 Layer
cd infra
zip -r /tmp/layer.zip lambda/shared-layer/nodejs
LAYER_VERSION=$(aws lambda publish-layer-version \
  --layer-name yorutsuke-shared-dev \
  --zip-file fileb:///tmp/layer.zip \
  --compatible-runtimes nodejs20.x \
  --profile dev | jq -r '.Version')

echo "New Layer Version: $LAYER_VERSION"

# 4. 更新所有 Lambda 函数
for FUNC in yorutsuke-instant-processor-us-dev yorutsuke-batch-us-dev; do
  aws lambda update-function-configuration \
    --function-name $FUNC \
    --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:$LAYER_VERSION \
    --profile dev
  echo "Updated $FUNC to Layer $LAYER_VERSION"
done

# 5. 验证
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers'
```

---

## 核心规则

### Rule 1: Layer 源文件修改后必须发布新版本

```typescript
// ✅ 正确的流程
修改 /lambda/shared-layer/nodejs/shared/*.mjs
  ↓
zip -r /tmp/layer.zip lambda/shared-layer/nodejs
  ↓
aws lambda publish-layer-version ...
  ↓
aws lambda update-function-configuration --layers ...

// ❌ 错误的假设
修改源文件 ≠ 自动更新 Lambda
CDK deploy "(no changes)" ≠ Layer 没变
修改代码 ≠ Lambda 立即使用新代码
```

### Rule 2: 验证部署后立即检查

```bash
# 部署后必须验证
aws lambda get-function-configuration \
  --function-name <name> \
  --profile dev | jq '.Layers[0].Arn'

# 记录下 ARN 和版本号
# 例: arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16
#                                                                        ↑
#                                                                    版本号
```

### Rule 3: 不确定时，手动发布 Layer

```bash
# 比 CDK 更可靠，避免缓存问题
# 快速反馈，立即生效
# 不需要等 CDK 重新合成
```

---

## 故障排除

### Lambda 仍在使用旧代码

```bash
# 1. 检查 Lambda 指向的 Layer ARN
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers'

# 2. 检查该版本的发布时间
LAYER_VERSION=$(echo "16")  # 从上面获取
aws lambda list-layer-versions \
  --layer-name yorutsuke-shared-dev \
  --profile dev | jq ".LayerVersions[] | select(.Version == $LAYER_VERSION)"

# 3. 验证最新发布的代码
aws lambda list-layer-versions \
  --layer-name yorutsuke-shared-dev \
  --profile dev | jq '.LayerVersions | .[0]'

# 4. 对比时间戳，判断是否是最新版本
```

### CloudWatch 日志显示旧行为

```bash
# 旧代码仍在执行，说明 Layer 没有更新
# → 重新执行发布 + 更新步骤

aws lambda tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev | head -50
```

---

## 环境变量 vs 代码更新

### 只修改环境变量？

```bash
# CDK 部署足够
npm run deploy -- --profile dev --all

# 或直接更新
aws lambda update-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --environment Variables="{KEY=VALUE}" \
  --profile dev
```

### 修改代码 + 环境变量？

```bash
# 需要同时：
# 1. 发布新 Layer
# 2. 更新 Lambda Layer ARN
# 3. 更新环境变量（或用 CDK）
```

---

## 最佳实践小结

| 情况 | 方案 | 时间 |
|------|------|------|
| 修改 shared-layer/* | 手动 zip + publish | 1 分钟 |
| 修改环境变量 | CDK deploy | 3 分钟 |
| 修改 Lambda 函数代码 | CDK deploy | 3 分钟 |
| 紧急修复 Layer | 手动 publish-layer-version | 30 秒 |
| 不确定要不要发布 | 总是发布新版本 | 安全第一 |

---

## 快速命令参考

```bash
# 发布新 Layer
cd infra && \
zip -r /tmp/layer.zip lambda/shared-layer/nodejs && \
aws lambda publish-layer-version \
  --layer-name yorutsuke-shared-dev \
  --zip-file fileb:///tmp/layer.zip \
  --compatible-runtimes nodejs20.x \
  --profile dev | jq '.Version'

# 更新 Lambda 使用新 Layer（替换 VERSION）
aws lambda update-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:VERSION \
  --profile dev

# 验证
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers[0]'
```

---

## 记住这三点

1. **Layer 是不可变快照** - 修改代码必须发布新版本
2. **Lambda 指向特定 ARN** - 新版本不会自动被使用
3. **手动发布比 CDK 更可靠** - 当需要快速修复时

