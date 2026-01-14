# Lambda Layer 快速参考

> 95% 的 Lambda 问题都是 Layer 版本管理。这是速查表。

## 五分钟快速修复

### 场景 1: 修改了 shared-layer 代码，Lambda 仍用旧版本

```bash
# 1. 快速发布新版本（60 秒）
cd /Users/woo/dev/yorutsuke-v2-1/infra && \
zip -r /tmp/layer.zip lambda/shared-layer/nodejs && \
LAYER_V=$(aws lambda publish-layer-version \
  --layer-name yorutsuke-shared-dev \
  --zip-file fileb:///tmp/layer.zip \
  --compatible-runtimes nodejs20.x \
  --profile dev | jq -r '.Version') && \
echo "New Layer Version: $LAYER_V"

# 2. 更新 Lambda（30 秒）
aws lambda update-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:$LAYER_V \
  --profile dev

# 3. 验证（10 秒）
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers[0].Arn'
```

**所需时间**: 2 分钟 ✅

---

### 场景 2: 不知道 Lambda 用的是哪个 Layer 版本

```bash
# 查看当前版本
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers'

# 查看最新的 5 个版本（找 CreatedDate 最新的）
aws lambda list-layer-versions \
  --layer-name yorutsuke-shared-dev \
  --profile dev | jq '.LayerVersions | .[0:5]'
```

---

### 场景 3: 修改了代码，不确定要不要更新 Layer

```
修改的文件路径
    ↓
lambda/shared-layer/nodejs/shared/*.mjs?
    ├─ YES → 必须发布新 Layer 版本（见场景 1）
    ├─ YES → 然后更新 Lambda Layer ARN
    └─ NO → CDK deploy 就够了（npm run deploy）
```

---

## 命令速查

| 需求 | 命令 |
|------|------|
| 查看当前 Layer | `aws lambda get-function-configuration --function-name yorutsuke-instant-processor-us-dev --profile dev \| jq '.Layers'` |
| 查看最新版本 | `aws lambda list-layer-versions --layer-name yorutsuke-shared-dev --profile dev \| jq '.LayerVersions[0]'` |
| 发布新 Layer | 见场景 1 |
| 更新 Lambda | 见场景 1 |
| 验证是否生效 | 见场景 1 的第 3 步 |

---

## 核心记忆点

### ❌ 不要相信这些假设

```
"修改了代码，Lambda 应该自动使用新代码" ❌
"CDK deploy 会自动发布新 Layer" ❌
"Layer 版本号会自动递增" ❌（不会，需要手动 publish）
"Lambda 会自动找最新版本" ❌
```

### ✅ 必须记住这些事实

```
1. Layer 是不可变的快照 → 修改代码 = 发布新版本
2. Lambda 指向特定 ARN → 必须显式更新
3. 版本号永不回收 → Version 15 永远存在
4. 手动发布最快 → 比等 CDK 快 3 倍
5. 验证是最后一步 → 不验证就没成功
```

---

## 一句话诊断

```bash
# Lambda 用的 Layer 版本对吗？
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers[0].Arn' | grep -o 'layer:.*'

# 预期输出
# "layer:yorutsuke-shared-dev:16"  ← 版本号
```

如果版本号很旧，就是 Layer 没有更新。按场景 1 操作。

---

## 避免这个常见错误

```bash
# ❌ 错误: 修改代码后直接运行
npm run deploy  # 等 5 分钟，说"no changes"，疑惑

# ✅ 正确: 快速发布 Layer
cd infra && zip -r /tmp/layer.zip lambda/shared-layer/nodejs && \
aws lambda publish-layer-version ... && \
aws lambda update-function-configuration ... && \
aws lambda get-function-configuration ...  # 验证

# 总用时: 2 分钟
```

---

## 参考完整文档

详见: `.claude/rules/lambda-layer-deployment.md`
