# Azure Document Intelligence 本地测试指南

> Pure Node.js 本地测试 Lambda 对 Azure DI 的访问
> 来自 ADR-016 Layer 1: Pure Node.js 本地测试

---

## ⚡ 30 秒快速开始

```bash
# 前提：设置 Azure 凭证
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=your-api-key

# 运行测试（使用样本图片）
node experiments/model-analyzer/test-azure-di-local.mjs --sample

# 或使用本地图片
node experiments/model-analyzer/test-azure-di-local.mjs ~/test-receipt.jpg
```

---

## 📚 完整指南

### 1️⃣ 配置 Azure 凭证

获取凭证：
- 在 Azure 门户查找 Document Intelligence 资源
- 复制 **Endpoint** 和 **Key 1**

设置环境变量：

```bash
# macOS/Linux
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=your-api-key-here

# 验证配置
echo $AZURE_DI_ENDPOINT
echo $AZURE_DI_API_KEY
```

**⚠️ 重要**: 不要提交凭证到 git！使用 `.env` 文件或 GitHub Secrets。

---

### 2️⃣ 准备测试图片

#### 选项 A：使用样本图片（推荐快速测试）

```bash
# 无需图片文件，脚本自动生成最小 JPEG
node experiments/model-analyzer/test-azure-di-local.mjs --sample
```

#### 选项 B：使用本地收据图片

```bash
# 任何收据照片（JPG/PNG/PDF）
node experiments/model-analyzer/test-azure-di-local.mjs ~/my-receipt.jpg

# 或
node experiments/model-analyzer/test-azure-di-local.mjs /path/to/receipt.jpg
```

#### 选项 C：从网络下载测试图片

```bash
# 下载示例收据
curl -o /tmp/sample-receipt.jpg \
  "https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/sample-receipt.jpg"

# 运行测试
node experiments/model-analyzer/test-azure-di-local.mjs /tmp/sample-receipt.jpg
```

---

### 3️⃣ 运行测试

#### 基本用法

```bash
node experiments/model-analyzer/test-azure-di-local.mjs [image-path | --sample]
```

#### 示例 1：使用样本

```bash
$ node experiments/model-analyzer/test-azure-di-local.mjs --sample

🚀 Azure Document Intelligence 本地测试

📋 前置检查:
   ✓ AZURE_DI_ENDPOINT 已配置
   ✓ AZURE_DI_API_KEY 已配置

📁 准备测试数据:
   使用样本收据图片 (1x1 最小 JPEG)

🔍 向 Azure Document Intelligence 发送请求:
[DEBUG] AZURE_DI_REQUEST_START ...
[INFO] AZURE_DI_SUBMITTING_REQUEST ...
[DEBUG] AZURE_DI_ANALYSIS_SUBMITTED ...
[DEBUG] AZURE_DI_POLLING ...
[DEBUG] AZURE_DI_RESPONSE_RECEIVED ...

╔══════════════════════════════════════════════════════════════╗
║          Azure Document Intelligence 本地测试结果             ║
╚══════════════════════════════════════════════════════════════╝

📊 测试详情:
   耗时: 8234ms
   状态: ✅ 成功

📝 提取的字段:
   商户名: CONTOSO
   小计: 11.50
   税额: 1.50
   总额: 13.00
   置信度: 95%

🛒 行项目:
   1. Cappuccino
      数量: 1, 单价: 2.20, 小计: 2.20
   2. Espresso
      数量: 1, 单价: 2.20, 小计: 2.20

...
```

#### 示例 2：使用本地文件

```bash
$ node experiments/model-analyzer/test-azure-di-local.mjs ~/test-receipt.jpg

🚀 Azure Document Intelligence 本地测试

📋 前置检查:
   ✓ AZURE_DI_ENDPOINT 已配置
   ✓ AZURE_DI_API_KEY 已配置

📁 准备测试数据:
   读取本地文件: /Users/woo/test-receipt.jpg
   ✓ 图片加载成功 (45382 bytes Base64)

🔍 向 Azure Document Intelligence 发送请求:
...
```

---

## 🧪 测试场景

### 场景 1: 验证 Azure 凭证

```bash
# 最快速的验证（使用最小图片）
node experiments/model-analyzer/test-azure-di-local.mjs --sample
```

**预期结果**:
- ✅ 脚本完成运行
- ✅ 显示提取的字段（即使图片为 1x1）
- ✅ 耗时 8-15 秒（包括轮询）

---

### 场景 2: 测试真实收据

```bash
# 下载真实收据样本
curl -o /tmp/real-receipt.jpg https://example.com/receipt.jpg

# 运行测试
node experiments/model-analyzer/test-azure-di-local.mjs /tmp/real-receipt.jpg
```

**预期结果**:
- ✅ 成功提取商户名、总额等字段
- ✅ 行项目数 > 0
- ✅ 置信度 > 80%

---

### 场景 3: 测试错误处理

#### 错误 1: 凭证缺失

```bash
unset AZURE_DI_API_KEY
node experiments/model-analyzer/test-azure-di-local.mjs --sample

# ❌ 输出: 缺少环境变量: AZURE_DI_API_KEY
```

#### 错误 2: 无效凭证

```bash
export AZURE_DI_API_KEY=invalid-key
node experiments/model-analyzer/test-azure-di-local.mjs --sample

# ❌ 输出: Azure API error (401): Invalid credentials
```

#### 错误 3: 网络错误

```bash
export AZURE_DI_ENDPOINT=https://invalid-endpoint.azure.com/
node experiments/model-analyzer/test-azure-di-local.mjs --sample

# ❌ 输出: fetch failed / ENOTFOUND / connection refused
```

---

## 📊 输出说明

### 日志级别

脚本输出三种类型的日志（模拟 Lambda 环境）:

| 日志 | 含义 | 示例 |
|------|------|------|
| `[DEBUG]` | 详细的调试信息 | AZURE_DI_REQUEST_START, AZURE_DI_POLLING |
| `[INFO]` | 重要的步骤信息 | AZURE_DI_SUBMITTING_REQUEST, MODEL_COMPARISON_COMPLETED |
| `[WARN]` | 警告信息 | MODEL_FAILED |
| `[ERROR]` | 错误信息 | AZURE_DI_ERROR, AZURE_DI_SUBMIT_FAILED |

### 字段提取

脚本提取的标准字段：

```json
{
  "vendor": "商户名",
  "subtotal": 小计,
  "taxAmount": 税额,
  "totalAmount": 总额,
  "confidence": 置信度百分比,
  "lineItems": [
    {
      "description": "项目描述",
      "quantity": 数量,
      "unitPrice": 单价,
      "totalPrice": 小计
    }
  ],
  "rawResponse": {
    "documentType": "文档类型",
    "pages": 页数
  }
}
```

---

## 🔍 故障排查

### 问题 1: "Azure API error (401)"

**原因**: 凭证无效或过期

**解决**:
```bash
# 1. 确认凭证
echo $AZURE_DI_ENDPOINT
echo $AZURE_DI_API_KEY

# 2. 在 Azure 门户重新生成 API Key
# 3. 重新导出环境变量
export AZURE_DI_API_KEY=new-key

# 4. 重试
node experiments/model-analyzer/test-azure-di-local.mjs --sample
```

---

### 问题 2: "Analysis polling timeout after 30 seconds"

**原因**: Azure 处理超时或服务响应慢

**解决**:
```bash
# 1. 检查网络连接
ping -c 1 rj0088.cognitiveservices.azure.com

# 2. 检查 Azure 服务状态
# https://status.azure.com/

# 3. 尝试更大的图片（> 100KB）

# 4. 增加轮询次数（编辑脚本中的 maxRetries）
```

---

### 问题 3: "No Operation-Location header in response"

**原因**: Azure API 返回格式不符合预期

**解决**:
```bash
# 1. 检查 API 版本是否正确（应该是 2024-02-29-preview）
# 2. 检查是否使用了正确的模型（prebuilt-receipt）
# 3. 查看完整的响应体
# 4. 查阅 Azure 文档：
#    https://learn.microsoft.com/en-us/rest/api/aiservices/document-models
```

---

### 问题 4: "Image file not found"

**原因**: 图片路径不存在

**解决**:
```bash
# 1. 验证文件存在
ls -lh ~/test-receipt.jpg

# 2. 使用绝对路径
node experiments/model-analyzer/test-azure-di-local.mjs \
  /absolute/path/to/receipt.jpg

# 3. 或使用 --sample 选项
node experiments/model-analyzer/test-azure-di-local.mjs --sample
```

---

## 🔄 与 Lambda 的关系

此脚本测试的是 **Lambda 中的相同代码**：

```
本地测试 (此脚本)
    ↓
shared-layer/nodejs/shared/model-analyzer.mjs
    ↓
Lambda instant-processor
    ↓
生产环境
```

### 代码对应关系

| 本地脚本 | Lambda 代码 | 路径 |
|---------|----------|------|
| `AzureDIAnalyzer.analyzeAzureDI()` | `MultiModelAnalyzer.analyzeAzureDI()` | `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs:358` |
| `AzureDIAnalyzer.normalizeAzureDIResult()` | `MultiModelAnalyzer.normalizeAzureDIResult()` | `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs:452` |

---

## 📈 性能基准

| 测试类型 | 耗时 | 说明 |
|---------|------|------|
| 样本图片 (1x1) | 8-12 秒 | 最小数据，主要是轮询等待 |
| 真实收据 (< 1MB) | 8-15 秒 | 包括 Azure 处理时间 |
| 大图片 (> 5MB) | 15-30 秒 | 上传 + 处理 + 轮询 |

---

## 💡 最佳实践

### ✅ DO

```bash
# 使用环境变量，不要硬编码
export AZURE_DI_API_KEY=key
node test-azure-di-local.mjs

# 定期测试验证凭证仍然有效
node test-azure-di-local.mjs --sample

# 在 CI/CD 中使用此脚本进行集成测试
# GitHub Actions 示例见下文
```

### ❌ DON'T

```bash
# 不要提交凭证
git add test-azure-di-local.mjs  # ❌ 可能包含硬编码的凭证

# 不要在脚本中硬编码凭证
# 这样会被 git 记录下来

# 不要频繁修改脚本来改变参数
# 而是使用环境变量
```

---

## 🚀 集成 CI/CD

### GitHub Actions 示例

```yaml
name: Test Azure DI Integration

on: [push, pull_request]

jobs:
  test-azure-di:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Test Azure DI Local
        env:
          AZURE_DI_ENDPOINT: ${{ secrets.AZURE_DI_ENDPOINT }}
          AZURE_DI_API_KEY: ${{ secrets.AZURE_DI_API_KEY }}
        run: |
          node experiments/model-analyzer/test-azure-di-local.mjs --sample
```

---

## 📚 相关文档

- **ADR-014**: [Lambda 部署与同步策略](../../docs/architecture/ADR/014-lambda-layer-version-management.md)
- **ADR-016**: [Lambda 本地优先测试](../../docs/architecture/ADR/016-lambda-local-first-testing.md)
- **ADR-018**: [cdk watch 云端驱动测试](../../docs/architecture/ADR/018-cdk-watch-cloud-driven-testing.md)
- **Azure 文档**: https://learn.microsoft.com/en-us/rest/api/aiservices/document-models

---

## 🎯 工作流程总结

```
修改 shared-layer 代码
    ↓
本地测试 (此脚本)
    ├─ 验证 Azure DI 连接
    ├─ 测试字段提取
    └─ 验证错误处理
    ↓
✅ 测试通过
    ↓
./infra/scripts/sync-layer.sh (Tier 1)
    ↓
Lambda 同步 (< 10 秒)
    ↓
cdk watch 自动重新部署 (Tier 2, 可选)
    ↓
生产验证
```

---

**版本**: 1.0
**最后更新**: 2026-01-14
**作者**: Claude Code

*此脚本是 Yorutsuke v2 AI 辅助开发的关键工具，确保 Azure DI 集成的快速迭代和可靠验证。*
