# sync-layer.sh 使用指南

快速部署 Lambda Layer 改动，无需等待完整的 `cdk deploy`。

---

## ⚡ 30 秒快速开始

```bash
# 场景：你修改了 infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs

# Step 1: 运行脚本
./infra/scripts/sync-layer.sh --profile dev

# Step 2: 等待输出（< 10 秒）
# ✓ Layer 同步完成！

# Step 3: 测试新代码
aws s3 cp ~/test.jpg s3://yorutsuke-images-us-dev-696249060859/uploads/
```

---

## 📖 完整使用指南

### 基本语法

```bash
./infra/scripts/sync-layer.sh [PROFILE] [OPTIONS]
```

### 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `PROFILE` | `dev` | AWS Profile (`dev` 或 `prod`) |
| `OPTIONS` | 无 | `--skip-verify` 跳过验证 |

### 常用命令

#### 1️⃣ 标准用法（推荐）

```bash
# 使用 dev profile
./infra/scripts/sync-layer.sh

# 或显式指定 profile
./infra/scripts/sync-layer.sh --profile dev

# 使用 prod profile
./infra/scripts/sync-layer.sh --profile prod
```

#### 2️⃣ 快速模式（跳过验证）

```bash
# 如果你非常确定改动正确，可以跳过最后的验证步骤
./infra/scripts/sync-layer.sh --profile dev --skip-verify
```

#### 3️⃣ 通过 npm script（待配置）

```bash
# 将来可在 infra/package.json 中添加
npm run sync:layer

# 或指定 profile
npm run sync:layer -- prod
```

---

## 🎯 工作流程

### 使用 sync-layer.sh 的完整流程

```
修改文件
  ↓
infra/lambda/shared-layer/nodejs/shared/*.mjs?
  ├─ YES
  │  ↓
  │  ./infra/scripts/sync-layer.sh --profile dev
  │  ↓
  │  等待输出（< 10 秒）
  │  ↓
  │  ✅ Layer v16 已发布并更新所有函数
  │  ↓
  │  git add && git commit -m "fix: ... (Layer v16)"
  │
  └─ NO
     ↓
     其他改动 → 使用 cdk watch 或 cdk deploy
```

---

## 🔍 脚本做了什么？

```
1️⃣  前置检查
    ├─ AWS CLI 和 jq 已安装？
    ├─ AWS 凭证有效？
    └─ 源目录存在？

2️⃣  打包 Layer
    ├─ 进入 infra/lambda/shared-layer
    ├─ zip -r /tmp/layer-*.zip nodejs/
    └─ 验证压缩包结构

3️⃣  发布新版本
    ├─ aws lambda publish-layer-version
    ├─ 提取新版本号（e.g., 16）
    └─ 提取新 ARN

4️⃣  更新所有函数
    ├─ yorutsuke-instant-processor-us-dev
    └─ yorutsuke-batch-processor-us-dev

5️⃣  验证
    ├─ 检查两个函数都指向新 ARN
    ├─ 生成审计日志
    └─ 显示总结
```

---

## 📊 输出示例

```
ℹ ══════════════════════════════════════════════════════════════
ℹ                 Lambda Layer 快速同步脚本
ℹ ══════════════════════════════════════════════════════════════
ℹ 时间: 2026-01-14 14:30:00
ℹ Profile: dev
ℹ Layer: yorutsuke-shared-dev

ℹ 检查前置条件...
✓ 所有必要工具已安装
✓ AWS 凭证验证成功 (profile: dev)
✓ 源目录验证成功: infra/lambda/shared-layer

ℹ 打包 Lambda Layer...
✓ 打包完成: /tmp/layer-yorutsuke-shared-dev-$$.zip (2.1M)
✓ 压缩包结构验证成功

ℹ 发布新 Layer 版本...
✓ 新 Layer 版本发布成功
ℹ 版本号: 16
ℹ ARN: arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16

ℹ 更新所有关联 Lambda 函数...
ℹ 更新函数: yorutsuke-instant-processor-us-dev
✓ 函数已更新: yorutsuke-instant-processor-us-dev
ℹ 更新函数: yorutsuke-batch-processor-us-dev
✓ 函数已更新: yorutsuke-batch-processor-us-dev

ℹ 验证所有函数都指向新 Layer...
✓ ✓ yorutsuke-instant-processor-us-dev → arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16
✓ ✓ yorutsuke-batch-processor-us-dev → arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16
✓ 所有函数验证成功！

✓ 临时文件已清理
ℹ 生成审计日志...
✓ 审计日志已保存: /tmp/sync-layer-yorutsuke-shared-dev-$$.log

✓ ══════════════════════════════════════════════════════════════
✓                     Layer 同步完成！
✓ ══════════════════════════════════════════════════════════════

📦 Layer 信息：
   名称：yorutsuke-shared-dev
   版本：16
   ARN：arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16

🔗 更新的函数：
   • yorutsuke-instant-processor-us-dev
   • yorutsuke-batch-processor-us-dev

📝 日志文件：/tmp/sync-layer-yorutsuke-shared-dev-$$.log

💡 下一步：
   1. 验证 Lambda 函数已收到新代码
      ...
```

---

## ⚠️ 常见错误排查

### 错误 1: "缺少必要工具: jq"

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# 验证
jq --version
```

### 错误 2: "AWS 凭证配置有问题"

```bash
# 检查凭证
aws sts get-caller-identity --profile dev

# 如果失败，检查 ~/.aws/credentials 和 ~/.aws/config
cat ~/.aws/credentials
cat ~/.aws/config
```

### 错误 3: "目录不存在"

```bash
# 脚本必须从项目根目录运行
cd /path/to/yorutsuke-v2
./infra/scripts/sync-layer.sh
```

### 错误 4: "函数不存在或未配置 Layer"

```bash
# 这通常表示该 profile 不存在此函数
# 或者函数名称有误

# 列出所有 Lambda 函数
aws lambda list-functions --profile dev --region us-east-1 | jq '.Functions[].FunctionName'
```

---

## 🔄 与 ADR-014 的关系

此脚本实现了 **ADR-014: Lambda 部署与同步策略** 的 **Tier 1** 部分：

| Tier | 名称 | 工具 | 用途 |
|------|------|------|------|
| Tier 1 | 极速路径 | **sync-layer.sh** | Layer 改动（< 10 秒） |
| Tier 2 | 实时路径 | `cdk watch` | Lambda 函数改动（1-3 秒） |
| Tier 3 | 标准路径 | `cdk deploy` | 完整系统发布（3-5 分钟） |

---

## 📚 相关文档

- **ADR-014**: [Lambda 部署与同步策略](../../docs/architecture/ADR/014-lambda-layer-version-management.md)
- **Rules**: `.claude/rules/lambda-layer-deployment.md`
- **Quick Ref**: `.claude/rules/lambda-quick-reference.md`
- **Checklist**: `.prot/checklists/lambda-layer-deployment.md`

---

## 💡 最佳实践

1. **始终运行验证**
   - 不使用 `--skip-verify` 除非你完全确定
   - 验证步骤确保所有函数都同步

2. **提交信息包含版本号**
   ```bash
   git commit -m "fix: update Azure DI API path (Layer v16)"
   ```

3. **每天结束时运行 `cdk deploy`**
   - 同步 CDK 本地状态与云端
   - 防止基建漂移

4. **保留审计日志**
   - 日志文件包含时间戳和所有操作细节
   - 便于故障排查

5. **在 CI/CD 中使用**
   ```yaml
   # GitHub Actions 示例
   - name: Sync Layer
     run: ./infra/scripts/sync-layer.sh --profile dev
   ```

---

## 🚀 优化建议（未来）

### 可以添加的功能

1. **自动选择 Profile**
   ```bash
   # 根据当前 git branch 自动选择 profile
   ./infra/scripts/sync-layer.sh --auto-profile
   ```

2. **比较新旧版本**
   ```bash
   # 显示新 Layer 与旧 Layer 的差异
   ./infra/scripts/sync-layer.sh --diff
   ```

3. **自动回滚**
   ```bash
   # 如果验证失败自动回滚到上一个版本
   ./infra/scripts/sync-layer.sh --auto-rollback
   ```

4. **Slack 通知**
   ```bash
   # 发送部署结果到 Slack
   ./infra/scripts/sync-layer.sh --notify-slack
   ```

---

## 版本历史

| 版本 | 日期 | 改动 |
|------|------|------|
| 1.0 | 2026-01-14 | 初始版本：打包、发布、更新、验证 |

---

*此脚本是 Yorutsuke v2 AI 辅助开发的关键工具，确保快速、可靠的 Lambda Layer 部署。*
