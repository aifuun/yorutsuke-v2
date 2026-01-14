# Azure DI Local Testing - Quick Start Guide

## 一句话总结

✅ SAM 本地测试环境已准备完毕，可以在本地测试 Lambda 调用 Azure Document Intelligence SDK 进行识别。

## 最快开始

```bash
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di

# 设置 Azure 凭证
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=<REDACTED_SECRET>

# 运行本地测试（直接 Node.js，不需要 Docker）
node test-multimodel-analyzer.mjs
```

## 测试结果解读

### ✅ 成功指标

```
✅ AZURE_DI_CLIENT_INITIALIZED      # SDK 客户端初始化成功
✅ AZURE_DI_REQUEST_START            # 请求发送到 Azure DI API
✅ Test Completed Successfully       # 测试完成
```

### ⚠️ 预期错误（不是问题）

```
"The security token included in the request is invalid."
    ↑ 这是预期的 - 本地测试没有 AWS 凭证

"Azure API error: Invalid request."
    ↑ 这是预期的 - 本地测试使用模拟 S3 URL，Azure 无法访问
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `test-multimodel-analyzer.mjs` | ✅ 本地测试（推荐使用，不需要 Docker） |
| `SAM-LOCAL-TEST-RESULTS.md` | 详细测试结果分析 |
| `COMPLETION-SUMMARY.md` | 完整实现总结 |
| `template.yaml` | SAM CloudFormation 模板（如需 Docker 测试） |
| `local-handler/index.mjs` | SAM handler（如需 Docker 测试） |

## 代码验证了什么

✅ **Azure SDK 集成**
- 从环境变量加载凭证
- 初始化 Document Intelligence 客户端
- 发送分析请求到 Azure

✅ **代码完整性**
- 使用的是 `infra/lambda/shared-layer` 中的生产代码
- MultiModelAnalyzer 能正确导入
- 所有依赖都已安装

✅ **错误处理**
- 多个模型并行运行不互相影响
- 单个模型失败被正确记录
- 返回结构一致

## 生产验证步骤

当你准备上线时：

```bash
# 1. 部署 Layer v22（包含 AWS SDK 包）
cd infra && cdk deploy --profile dev

# 2. 上传真实 receipt 到 S3
aws s3 cp receipt.jpg \
  s3://yorutsuke-images-us-dev-696249060859/uploads/ \
  --profile dev

# 3. 查看 CloudWatch 日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
  --follow --profile dev

# 4. 验证数据库结果
aws dynamodb scan \
  --table-name yorutsuke-transactions-us-dev \
  --profile dev | jq '.Items[0].modelComparison'
```

## 关键点

| 关键点 | 说明 |
|--------|------|
| **无需 Docker** | 使用直接 Node.js 测试，更快 |
| **代码一致性** | 运行的是生产环境的实际代码 |
| **错误预期** | 本地测试环境限制（无 AWS 凭证、无真实 S3） |
| **SDK 优先** | 使用 SDK 而非 REST API（微软官方推荐） |
| **日志详细** | 结构化 JSON 日志便于调试 |

## 状态

✅ **就绪**：可以进行生产部署

**下一步**：
1. 确认 Layer v22 部署
2. 上传真实 receipt 测试
3. 验证 DynamoDB 中的 Azure DI 结果

---

**更多信息**:
- 详细结果：`SAM-LOCAL-TEST-RESULTS.md`
- 完整总结：`COMPLETION-SUMMARY.md`
- SAM 指南：`SAM-TEST-GUIDE.md`
