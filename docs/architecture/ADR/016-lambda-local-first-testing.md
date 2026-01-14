# ADR-016: Lambda 本地优先测试策略

**Status**: Accepted
**Date**: 2026-01-14
**Related**: [ADR-015 SDK Over REST API](./015-sdk-over-rest-api.md)

## Context

Lambda 开发常见的问题：

| 问题 | 症状 | 成本 |
|------|------|------|
| **冷启动** | 首次调用慢 5-10 秒 | 浪费时间等待 |
| **权限错误** | 部署后才发现 IAM 缺少权限 | 重新配置 + 重新部署（10 分钟） |
| **环境变量错误** | 本地用 `KEY_A`，Lambda 用 `KEY_B` | 调试（15 分钟） |
| **依赖版本冲突** | Layer 中的模块和本地版本不一致 | 神秘错误（30 分钟） |
| **文件系统访问** | Lambda 只有 `/tmp` 可写 | 部署后才发现（20 分钟） |

### 传统方式（存在的问题）

```
代码改动 → CDK 部署 (5 分钟) → Lambda 执行失败
→ 查看日志 (2 分钟) → 改代码 → CDK 部署 (5 分钟)
→ ... 反复 5 次 = 总耗时 50 分钟
```

### 本地优先方式（提议）

```
代码改动 → 本地测试 (1 分钟) ✅ → CDK 部署 (2 分钟) → Lambda 直接成功
总耗时: 3 分钟
```

## Decision

**采用三层分离 + 本地优先开发策略**

### Rule 1: Lambda 代码分层

```
Layer 1: 纯业务逻辑 (shared-layer)
  ├─ 不依赖 AWS SDK
  ├─ 纯函数式，无副作用
  ├─ 完全可在本地运行
  └─ 🧪 本地 100% 测试覆盖

Layer 2: AWS 适配层 (instant-processor/batch-processor)
  ├─ S3/DynamoDB 读写
  ├─ 事件解析和错误处理
  ├─ 调用 Layer 1 的业务逻辑
  └─ 🔷 仅在 Lambda 环境测试（部署前 code review）

Layer 3: 端到端集成 (experiments/integration)
  ├─ 模拟 S3 事件
  ├─ 验证 Layer 1 + Layer 2 协作
  ├─ 检查日志和权限
  └─ 🔷 部署前的最后验证
```

### Rule 2: 开发工作流

```
1️⃣ 新功能 → experiments/ 中本地测试
   • 设置环境变量（可用真实凭证或 mock）
   • 单元测试业务逻辑
   • 测试错误场景

2️⃣ 通过本地测试后 → 集成到 shared-layer
   • 统一接口格式
   • 添加 traceId 和日志
   • 更新类型定义

3️⃣ Lambda 适配层 → 仅集成已测试的函数
   • AWS SDK 操作
   • 错误处理
   • 事件映射

4️⃣ CDK 部署 → 一次成功
   • 发布 Layer 版本
   • 更新 Lambda 配置
   • 端到端验证
```

## Implementation

### 项目结构

```
infra/lambda/
├── shared-layer/nodejs/shared/
│   ├── model-analyzer.mjs          # 纯业务逻辑 ✅ 本地测试
│   ├── transaction-processor.mjs    # 纯业务逻辑 ✅ 本地测试
│   └── index.mjs
├── instant-processor/
│   └── index.mjs                    # AWS 操作 → 仅 review
└── batch-processor/
    └── index.mjs                    # AWS 操作 → 仅 review

experiments/
├── model-analyzer/
│   ├── test-textract.js             # ✅ 测试 Textract OCR
│   ├── test-bedrock.js              # ✅ 测试 Bedrock 多模型
│   ├── test-azure-di.js             # ✅ 测试 Azure Document Intelligence
│   └── test-multi-model.js          # ✅ 集成测试所有 OCR 服务
├── transaction-processor/
│   ├── test-local.js                # ✅ 测试本地事务处理
│   └── test-with-mock-s3.js         # ✅ 模拟 S3 事件
└── integration/
    ├── test-end-to-end.js           # 🔷 完整流程验证
    └── test-layer-versions.js       # 🔷 Layer 版本兼容性
```

### 本地测试模板

```typescript
// experiments/model-analyzer/test-azure-di.js
import { DocumentIntelligenceClient, AzureKeyCredential } from "@azure/ai-document-intelligence";

// Step 1: 初始化 SDK（完全和 Lambda 代码一致）
const client = new DocumentIntelligenceClient(
  process.env.AZURE_DI_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_DI_API_KEY)
);

// Step 2: 执行业务逻辑
const poller = await client.beginAnalyzeDocument("prebuilt-invoice", {
  urlSource: "https://example.com/receipt.jpg",
});

// Step 3: 验证结果格式
const result = await poller.pollUntilDone();
console.log(JSON.stringify(result, null, 2));

// Step 4: 断言
assert(result.documents[0].fields.VendorName, "Vendor should exist");
assert(result.documents[0].fields.InvoiceTotal, "Total should exist");
```

## Consequences

### Positive ✅

- **快速迭代**: 本地测试 1 分钟 vs Lambda 部署 5+ 分钟
- **调试容易**: 本地有 STDOUT，Lambda 需要 CloudWatch
- **成本低**: 少部署 = 少收费
- **可靠性高**: 在本地就发现大多数问题
- **开发效率提升 5-10 倍**: 平均周期从 50 分钟 → 5 分钟
- **文档自动化**: 测试代码就是使用文档

### Negative ⚠️

- **需要维护两套代码**: shared-layer 和 experiments
  - 解决: 通过 symlink 或 npm workspace 保持同步
- **环境变量管理复杂**: 本地和 Lambda 需要不同的凭证
  - 解决: 使用 `.env.local` 和 AWS Secrets Manager
- **初期设置开销**: 需要拆分现有代码
  - 一次性成本，后续受益无穷

## Migration Plan

### Phase 1: 重构现有代码 (Week 1)

1. 从 `instant-processor/index.mjs` 提取 `analyzeReceipt` 函数
2. 移入 `shared-layer/nodejs/shared/model-analyzer.mjs`
3. 确保无 AWS SDK 依赖
4. 添加 TypeScript 类型定义

### Phase 2: 创建本地测试 (Week 1-2)

1. `experiments/model-analyzer/test-textract.js`
2. `experiments/model-analyzer/test-bedrock.js`
3. `experiments/model-analyzer/test-multi-model.js`
4. 所有测试应使用真实的 API 凭证（从环境变量）

### Phase 3: Lambda 更新 (Week 2)

1. `instant-processor/index.mjs` 简化为仅 AWS 操作
2. 添加 Layer 引用：`const { analyzeReceipt } = require('./shared-layer')`
3. CDK 部署

### Phase 4: 持续改进 (Ongoing)

- 所有新功能都先在 `experiments/` 中测试
- 定期检查本地测试覆盖率
- 维护 `experiments/integration/` 的端到端测试

## Checklist

### 在 experiments/ 中测试

- [ ] 所有 SDK 都能正确初始化
- [ ] 环境变量配置正确
- [ ] 单个模型都能返回期望的结果格式
- [ ] 多个模型并行运行是否工作
- [ ] 错误处理（网络超时、API 限制、无效输入）
- [ ] 结果标准化是否符合 Schema
- [ ] 日志包含 traceId

### 部署前最后检查

- [ ] 所有本地测试都通过 ✅
- [ ] Layer 代码有改动吗？→ 发布新版本
- [ ] Lambda IAM 权限够吗？
- [ ] 环境变量在 Lambda 中配置了吗？

### 部署后验证

- [ ] CloudWatch 日志显示正确的 traceId
- [ ] 模型结果的格式是否和本地测试一致
- [ ] 响应时间是否在预期范围（冷启动正常）

## Related

- [015-sdk-over-rest-api.md](./015-sdk-over-rest-api.md) - SDK 选择决策
- `.claude/rules/lambda-local-first.md` - 操作指南
- `.claude/rules/lambda-layer-deployment.md` - Layer 部署细节

---

*本决策旨在通过本地优先测试，将 Lambda 开发效率提升 5-10 倍，并减少生产问题。*
