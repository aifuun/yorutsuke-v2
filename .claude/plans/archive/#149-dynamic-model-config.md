# Processing Model 管理现状调查报告

## 执行概要

通过全面代码审计，发现系统处于**不一致状态**：
- **Admin Panel UI 完整**但 **Backend API 已删除**
- 用户可以看到模型选择界面，但无法实际保存配置
- 模型配置完全通过 CDK 环境变量管理，无动态修改能力

---

## 调查结果

### 1. 当前 Processing Model 的 Endpoint：无

**结论：没有 API endpoint 用于模型管理**

**现状：**
- 模型配置方式：**环境变量** `MODEL_ID`
- 默认值：`"us.amazon.nova-lite-v1:0"`
- 配置位置：`infra/lib/yorutsuke-stack.ts` (line 292)
  ```typescript
  environment: {
    MODEL_ID: "us.amazon.nova-lite-v1:0",
  }
  ```

**Instant Processor 使用方式：**
- 文件：`infra/lambda/instant-processor/index.mjs` (line 16, 154)
- 直接读取环境变量：
  ```javascript
  const MODEL_ID = process.env.MODEL_ID || "us.amazon.nova-lite-v1:0";
  // ...
  modelId: MODEL_ID  // 使用时无任何动态逻辑
  ```

**已删除的 endpoints（Issue #147）：**
- `GET /batch/config` - 获取配置
- `POST /batch/config` - 更新配置
- 对应 Lambda：`lambda/admin/batch-config/` (已删除)

---

### 2. Admin Panel 的 Models Radio 按钮：存在但不可用

**结论：Admin Panel UI 完整，但后端 API 不存在，无法保存**

#### UI 实现细节

**位置：**
- 主组件：`admin/src/components/ProcessingSettings.tsx` (lines 111-131)
- 页面容器：`admin/src/pages/Batch.tsx`
- 导航：Sidebar 中有 "Batch" 链接（⚙️ 图标）

**UI 形式：NOT Radio Buttons**
- 使用**可点击的 Card 选择模式**
- 3 个模型选项（卡片布局）：
  1. **Nova Lite** - "Recommended, low cost"
  2. **Nova Pro** - "Higher accuracy"
  3. **Claude 3 Haiku** - "Alternative"

**代码示例：**
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {AVAILABLE_MODELS.map((model) => (
    <div
      onClick={() => updateField('modelId', model.id)}
      className={`p-4 rounded-lg border cursor-pointer ${
        localConfig.modelId === model.id
          ? 'border-app-accent bg-app-accent/10'  // 选中状态
          : 'border-app-border hover:...'
      }`}
    >
      <div className="font-medium">{model.name}</div>
      <div className="text-xs text-app-text-secondary">
        {model.description}
      </div>
    </div>
  ))}
</div>
```

#### 数据流（当前断裂）

```
用户点击 Model Card
    ↓
updateField('modelId', modelId)
    ↓
localConfig state 更新 ✅
    ↓
点击 "Save Changes" 按钮
    ↓
api.post('/batch/config', localConfig)  ← API 调用
    ↓
❌ 404 Not Found - Backend endpoint 不存在
```

#### Backend 状态

**API 路由：不存在**
- `infra/lib/yorutsuke-admin-stack.ts` 中**没有** `/batch` 或 `/batch/config` 路由
- 只有 3 个 endpoint：
  - `GET /stats`
  - `GET,POST /control`
  - `GET /costs`

**Lambda 处理器：已删除**
- `lambda/admin/batch/index.mjs` - 已删除
- `lambda/admin/batch-config/index.mjs` - 已删除

---

### 3. Receipt 处理时的 Model 获取：直接从环境变量

**结论：不通过 endpoint 获取，直接读取环境变量**

#### 处理流程

**文件：** `infra/lambda/instant-processor/index.mjs`

```javascript
// Line 16: 启动时读取环境变量
const MODEL_ID = process.env.MODEL_ID || "us.amazon.nova-lite-v1:0";

// Line 130-159: 处理 receipt 时
const payload = {
  messages: [/* ... */],
  inferenceConfig: { maxTokens: 1024, temperature: 0.1 },
};

const bedrockResponse = await bedrock.send(
  new InvokeModelCommand({
    modelId: MODEL_ID,  // ← 直接使用环境变量，无动态获取
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  })
);
```

#### Multi-Model Comparison（独立流程）

**文件：** `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs`

除了主处理流程，系统还会**并行运行 4 个模型**用于对比：
1. AWS Textract
2. Nova Mini
3. Nova Pro
4. Claude Sonnet 4.5

**特点：**
- 与主处理流程**独立**运行（`Promise.allSettled`）
- 结果存储在 `modelComparison` 字段
- 非阻塞：任何模型失败不影响主流程
- 用途：内部对比/调试，不影响用户体验

---

### 4. Batch 残余检查：大量保留但有意为之

**结论：保留了批处理基础设施，但处于待激活状态**

#### 保留的 Batch 组件（有意保留）

| 组件 | 位置 | 状态 | 用途 |
|------|------|------|------|
| **Batch Orchestrator** | `infra/lambda/batch-orchestrator/` | ✅ 部署但未激活 | 提交 Bedrock Batch 任务 |
| **Batch Result Handler** | `infra/lambda/batch-result-handler/` | ✅ 部署但未激活 | 处理 Bedrock Batch 结果 |
| **Batch Jobs Table** | DynamoDB `yorutsuke-batch-jobs-us-{env}` | ✅ 已创建 | 存储批处理任务元数据 |
| **Admin Batch UI** | `admin/src/pages/Batch.tsx` (310 lines) | ✅ 可访问 | 批处理监控页面 |
| **Processing Settings** | `admin/src/components/ProcessingSettings.tsx` | ✅ 可见 | 配置批处理模式 |
| **Batch Config Schema** | `shared-layer/.../schemas.mjs` | ✅ 定义完整 | Zod 验证 |

**保留原因（来自 Issue #147）：**
- 当前使用 Instant-only 模式（所有图片立即处理）
- 基础设施已部署且维护成本低
- 为未来批处理模式做准备（> 100 images/day）

#### 已删除的 Batch 组件（Issue #147）

| 组件 | 删除时间 | 原因 |
|------|---------|------|
| `lambda/admin/batch/` | Commit `a5e30e5` | 手动触发和状态查询不需要 |
| `lambda/admin/batch-config/` | Commit `a5e30e5` | 改用环境变量配置 |
| `/batch` API endpoints | Commit `a5e30e5` | Backend 不支持动态配置 |
| `/batch/config` API endpoints | Commit `a5e30e5` | Backend 不支持动态配置 |
| `BatchProcessLambda` | Commit `3d44143` | 不使用批处理模式 |
| `BatchProcessRule` (EventBridge) | Commit `3d44143` | 不需要定时触发 |
| CloudWatch Alarms (batch errors) | Commit `3d44143` | 无批处理 Lambda |

---

## 关键问题：UI/Backend 不一致

### 问题描述

**Admin Panel 状态矛盾：**
1. **Frontend**：UI 完整，用户可以看到模型选择 cards
2. **Backend**：API endpoints 不存在，无法保存配置
3. **结果**：用户点击 "Save Changes" 会收到 404 错误

**用户体验问题：**
- UI 暗示可以配置模型
- 实际上配置无法保存
- 会造成用户困惑

### 当前架构总结

```
┌─────────────────────────────────────────────────────────────┐
│  Current Architecture (Post Issue #147)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CDK Deployment                                             │
│       ↓                                                     │
│  Environment Variable: MODEL_ID = "us.amazon.nova-lite-v1:0"│
│       ↓                                                     │
│  Instant Processor Lambda                                   │
│       ├─ Read env: const MODEL_ID = process.env.MODEL_ID   │
│       └─ Use directly: modelId: MODEL_ID                    │
│                                                             │
│  Admin Panel UI (Broken)                                    │
│       ├─ Shows model selection cards ✅                      │
│       ├─ User clicks "Save"                                 │
│       ├─ POST /batch/config                                 │
│       └─ ❌ 404 - Endpoint doesn't exist                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 建议的后续行动

### 选项 A：删除 Admin Panel 中的 Model UI（推荐）

**理由：**
- 与当前架构一致（环境变量配置）
- 避免用户困惑
- 减少死代码

**需要删除：**
- `admin/src/components/ProcessingSettings.tsx` 中的模型选择部分
- `admin/src/types/batch.ts` 中的 `AVAILABLE_MODELS`
- 或在 UI 中添加 "Model selection coming soon" 占位符

### 选项 B：重新实现 Backend API（功能完整）

**需要实现：**
1. 创建 `lambda/admin/batch-config/` Lambda
2. 添加 `/batch/config` GET/POST endpoints 到 API Gateway
3. 将 `modelId` 存储到 DynamoDB control table
4. 修改 `instant-processor` 从 DynamoDB 读取而非环境变量

**权衡：**
- ✅ 功能完整，用户可动态配置
- ❌ 增加复杂性（DynamoDB 依赖）
- ❌ 需要处理配置缓存和失败回退

### 选项 C：保持现状，添加提示（最小改动）

**实现：**
- 在 Admin Panel Batch 页面添加横幅：
  ```
  ⚠️ Model configuration is currently managed via infrastructure deployment.
  Dynamic model selection coming in a future update.
  ```
- 禁用 "Save Changes" 按钮
- 显示当前使用的模型（只读）

---

## 文件清单

### Admin Panel UI（需要修改）
- `admin/src/components/ProcessingSettings.tsx` (80+ lines)
- `admin/src/pages/Batch.tsx` (310 lines)
- `admin/src/types/batch.ts` (type definitions)
- `admin/src/api/client.ts` (API endpoints)

### Backend Infrastructure（可能需要重新创建）
- `infra/lib/yorutsuke-admin-stack.ts` (API Gateway routes)
- `infra/lambda/admin/batch-config/index.mjs` (不存在，需创建)

### Lambda Processor（可能需要修改）
- `infra/lambda/instant-processor/index.mjs` (line 16, 154)
- `infra/lib/yorutsuke-stack.ts` (environment variables, line 292)

### Batch Infrastructure（已保留，无需修改）
- `infra/lambda/batch-orchestrator/index.mjs` (390 lines)
- `infra/lambda/batch-result-handler/index.mjs` (505 lines)
- DynamoDB: `yorutsuke-batch-jobs-us-{env}` table

---

## 验证清单

如果选择修复 UI/Backend 不一致：

- [ ] Admin Panel 中的模型选择 UI 是否可见？
- [ ] 点击 "Save Changes" 是否成功（200 OK）？
- [ ] DynamoDB control table 是否更新 `modelId`？
- [ ] Instant Processor 是否读取正确的模型？
- [ ] 模型切换后，新上传的 receipt 是否使用新模型处理？
- [ ] Admin Panel 是否正确显示当前配置的模型？

---

**调查完成时间：** 2026-01-17
**调查范围：** Complete codebase (infra/, admin/, app/)
**关键发现：** UI/Backend inconsistency - Admin Panel shows model selection but API doesn't exist

---

# Implementation Plan: Dynamic Model Configuration

## Goal

Implement dynamic model configuration with:
1. Separate "Models" admin page (extract from Batch page)
2. Backend API endpoints for model management
3. DynamoDB storage for model configuration
4. instant-processor reads from DynamoDB instead of environment variable
5. Support for external models (Azure DI)

## Architecture Decision

**Chosen Approach:** Option B + UI Refactoring

```
┌─────────────────────────────────────────────────────────────┐
│  New Architecture                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Admin Panel                                                │
│       ├─ Models Page (NEW) → POST /model/config            │
│       └─ Batch Page (simplified)                           │
│                    ↓                                        │
│  API Gateway: /model/config                                 │
│       ├─ GET  → Read current model config                  │
│       └─ POST → Update model config                        │
│                    ↓                                        │
│  DynamoDB Control Table                                     │
│       key: "modelConfig"                                    │
│       value: { modelId, tokenCode, provider, config }      │
│                    ↓                                        │
│  Instant Processor Lambda                                   │
│       ├─ Startup: Load config from DynamoDB                │
│       ├─ Cache in memory (Lambda container)                │
│       └─ Fallback to env var if DynamoDB fails             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Backend Infrastructure

#### 1.1 Create Model Config Lambda
**File:** `infra/lambda/admin/model-config/index.mjs`

```javascript
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ddb = new DynamoDBClient({});
const CONTROL_TABLE_NAME = process.env.CONTROL_TABLE_NAME;

// Schema for model configuration
const ModelConfigSchema = {
  modelId: String,        // "us.amazon.nova-lite-v1:0"
  tokenCode: String,      // User-friendly code: "nova-lite", "nova-pro", "azure-di"
  provider: String,       // "aws-bedrock" | "azure-openai"
  displayName: String,    // "Nova Lite"
  description: String,    // "Recommended, low cost"
  config: Object,         // Provider-specific config (e.g., Azure endpoint)
  updatedAt: String,      // ISO timestamp
  updatedBy: String,      // Cognito sub
};

export async function handler(event) {
  const method = event.httpMethod;

  if (method === 'GET') {
    // Read current config
    const response = await ddb.send(new GetItemCommand({
      TableName: CONTROL_TABLE_NAME,
      Key: marshall({ key: 'modelConfig' }),
    }));

    if (!response.Item) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          modelId: "us.amazon.nova-lite-v1:0",
          tokenCode: "nova-lite",
          provider: "aws-bedrock",
          displayName: "Nova Lite",
          description: "Default model",
          config: {},
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(unmarshall(response.Item).value),
    };
  }

  if (method === 'POST') {
    // Update config
    const body = JSON.parse(event.body);
    const userSub = event.requestContext.authorizer.claims.sub;

    const config = {
      ...body,
      updatedAt: new Date().toISOString(),
      updatedBy: userSub,
    };

    await ddb.send(new PutItemCommand({
      TableName: CONTROL_TABLE_NAME,
      Item: marshall({
        key: 'modelConfig',
        value: config,
      }),
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, config }),
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}
```

#### 1.2 Add API Gateway Routes
**File:** `infra/lib/yorutsuke-admin-stack.ts`

Add after costsLambda definition:

```typescript
// ========================================
// Lambda: Admin Model Config
// ========================================
const modelConfigLambda = new lambda.Function(this, "AdminModelConfigLambda", {
  functionName: `yorutsuke-admin-model-config-us-${env}`,
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: "index.handler",
  code: lambda.Code.fromAsset("lambda/admin/model-config"),
  layers: [sharedLayer],
  environment: {
    CONTROL_TABLE_NAME: controlTable.tableName,
  },
  timeout: cdk.Duration.seconds(10),
});

controlTable.grantReadWriteData(modelConfigLambda);

// /model/config endpoint
const modelConfigResource = api.root.addResource("model").addResource("config");
modelConfigResource.addMethod(
  "GET",
  new apigateway.LambdaIntegration(modelConfigLambda),
  authOptions
);
modelConfigResource.addMethod(
  "POST",
  new apigateway.LambdaIntegration(modelConfigLambda),
  authOptions
);
```

#### 1.3 Update Instant Processor to Read from DynamoDB
**File:** `infra/lambda/instant-processor/index.mjs`

```javascript
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const ddb = new DynamoDBClient({});
const CONTROL_TABLE_NAME = process.env.CONTROL_TABLE_NAME;
const DEFAULT_MODEL_ID = process.env.MODEL_ID || "us.amazon.nova-lite-v1:0";

// Cached model config (persists across invocations in same Lambda container)
let cachedModelConfig = null;

/**
 * Load model config from DynamoDB (cached in memory after first load)
 */
async function loadModelConfig() {
  if (cachedModelConfig) {
    logger.debug('MODEL_CONFIG_CACHE_HIT', { modelId: cachedModelConfig.modelId });
    return cachedModelConfig;
  }

  try {
    const response = await ddb.send(new GetItemCommand({
      TableName: CONTROL_TABLE_NAME,
      Key: marshall({ key: 'modelConfig' }),
    }));

    if (response.Item) {
      cachedModelConfig = unmarshall(response.Item).value;
      logger.info('MODEL_CONFIG_LOADED', { modelId: cachedModelConfig.modelId });
      return cachedModelConfig;
    }
  } catch (error) {
    logger.warn('MODEL_CONFIG_LOAD_FAILED', { error: String(error) });
  }

  // Fallback to environment variable
  cachedModelConfig = {
    modelId: DEFAULT_MODEL_ID,
    tokenCode: 'nova-lite',
    provider: 'aws-bedrock',
  };
  logger.info('MODEL_CONFIG_FALLBACK', { modelId: DEFAULT_MODEL_ID });
  return cachedModelConfig;
}

// In handler function, replace:
// const MODEL_ID = process.env.MODEL_ID || "us.amazon.nova-lite-v1:0";
// With:
const modelConfig = await loadModelConfig();
const MODEL_ID = modelConfig.modelId;
```

Grant control table read permission in CDK:
```typescript
controlTable.grantReadData(instantProcessLambda);
```

### Phase 2: Admin Panel UI

#### 2.1 Create Models Page
**File:** `admin/src/pages/Models.tsx`

```tsx
import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface ModelConfig {
  modelId: string;
  tokenCode: string;
  provider: string;
  displayName: string;
  description: string;
  config?: Record<string, any>;
}

const AVAILABLE_MODELS: ModelConfig[] = [
  {
    modelId: 'us.amazon.nova-lite-v1:0',
    tokenCode: 'nova-lite',
    provider: 'aws-bedrock',
    displayName: 'Nova Lite',
    description: 'Recommended, low cost',
  },
  {
    modelId: 'us.amazon.nova-pro-v1:0',
    tokenCode: 'nova-pro',
    provider: 'aws-bedrock',
    displayName: 'Nova Pro',
    description: 'Higher accuracy',
  },
  {
    modelId: 'azure-document-intelligence',
    tokenCode: 'azure-di',
    provider: 'azure-openai',
    displayName: 'Azure DI',
    description: 'External provider',
  },
];

export function ModelsPage() {
  const [currentConfig, setCurrentConfig] = useState<ModelConfig | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadCurrentConfig();
  }, []);

  async function loadCurrentConfig() {
    try {
      const response = await api.get('/model/config');
      setCurrentConfig(response.data);
      setSelectedModel(response.data.tokenCode);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  async function handleSave() {
    const model = AVAILABLE_MODELS.find(m => m.tokenCode === selectedModel);
    if (!model) return;

    setLoading(true);
    setMessage('');

    try {
      await api.post('/model/config', model);
      setMessage('Model configuration saved successfully');
      loadCurrentConfig();
    } catch (error) {
      setMessage('Failed to save configuration');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="models-page">
      <h1>Processing Model Configuration</h1>

      <div className="model-selection">
        {AVAILABLE_MODELS.map((model) => (
          <label key={model.tokenCode} className="model-option">
            <input
              type="radio"
              name="model"
              value={model.tokenCode}
              checked={selectedModel === model.tokenCode}
              onChange={(e) => setSelectedModel(e.target.value)}
            />
            <div className="model-info">
              <strong>{model.displayName}</strong>
              <span>{model.description}</span>
            </div>
          </label>
        ))}
      </div>

      <button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save Configuration'}
      </button>

      {message && <div className="message">{message}</div>}

      {currentConfig && (
        <div className="current-config">
          <h3>Current Configuration</h3>
          <pre>{JSON.stringify(currentConfig, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

#### 2.2 Update Navigation
**File:** `admin/src/components/Layout.tsx`

```tsx
// Add Models to navigation
<nav>
  <Link to="/dashboard">📊 Dashboard</Link>
  <Link to="/control">🛡️ Control</Link>
  <Link to="/costs">💰 Costs</Link>
  <Link to="/models">🤖 Models</Link>  {/* NEW */}
  <Link to="/batch">⚙️ Batch</Link>
</nav>
```

#### 2.3 Update Routes
**File:** `admin/src/App.tsx`

```tsx
import { ModelsPage } from './pages/Models';

// Add route
<Route path="/models" element={<ModelsPage />} />
```

#### 2.4 Simplify Batch Page (Optional)
**File:** `admin/src/pages/Batch.tsx`

Remove ProcessingSettings component (model selection), keep only batch monitoring UI.

### Phase 3: Schema Updates

#### 3.1 Add ModelConfig to Shared Schemas
**File:** `infra/lambda/shared-layer/nodejs/shared/schemas.mjs`

```javascript
export const ModelConfigSchema = z.object({
  modelId: z.string(),
  tokenCode: z.string(),
  provider: z.enum(['aws-bedrock', 'azure-openai']),
  displayName: z.string(),
  description: z.string(),
  config: z.record(z.any()).optional(),
  updatedAt: z.string(),
  updatedBy: z.string(),
});
```

### Phase 4: Verification

#### Test Plan

1. **Admin Panel UI**:
   - [ ] Navigate to /models page
   - [ ] See 3 radio buttons (Nova Lite, Nova Pro, Azure DI)
   - [ ] Select Nova Pro, click Save
   - [ ] Verify success message
   - [ ] Refresh page, verify selection persists

2. **Backend API**:
   - [ ] GET /model/config returns current config
   - [ ] POST /model/config updates DynamoDB
   - [ ] Verify control table has modelConfig item

3. **Instant Processor**:
   - [ ] Upload receipt image
   - [ ] Check CloudWatch logs for MODEL_CONFIG_LOADED event
   - [ ] Verify Bedrock invocation uses correct modelId
   - [ ] Test fallback: Delete modelConfig from DynamoDB, verify env var fallback works

4. **Error Handling**:
   - [ ] DynamoDB unavailable → Falls back to env var
   - [ ] Invalid model config → Validation error returned
   - [ ] Unauthorized access → 401 error

## Critical Files

| File | Purpose |
|------|---------|
| `infra/lambda/admin/model-config/index.mjs` | Model config API (NEW) |
| `infra/lib/yorutsuke-admin-stack.ts` | API Gateway routes |
| `infra/lambda/instant-processor/index.mjs` | Read model from DynamoDB |
| `admin/src/pages/Models.tsx` | Models configuration page (NEW) |
| `admin/src/components/Layout.tsx` | Navigation menu |
| `admin/src/pages/Batch.tsx` | Simplify (remove model selection) |

## Rollout Strategy

1. **Deploy backend first** (zero downtime):
   - Create model-config Lambda
   - Add API routes
   - Update instant-processor with fallback logic

2. **Seed initial config** (manual):
   ```bash
   aws dynamodb put-item \
     --table-name yorutsuke-control-us-dev \
     --item '{"key":{"S":"modelConfig"},"value":{"M":{"modelId":{"S":"us.amazon.nova-lite-v1:0"},"tokenCode":{"S":"nova-lite"},"provider":{"S":"aws-bedrock"}}}}'
   ```

3. **Deploy admin panel**:
   - Build and upload to S3
   - Invalidate CloudFront cache

4. **Verify**:
   - Test model switching via admin panel
   - Upload receipt, verify correct model used

## Security Considerations

- [ ] API endpoints protected by Cognito authorizer
- [ ] Model config changes logged with user identity
- [ ] Fallback to env var ensures resilience
- [ ] No secrets in DynamoDB (model IDs are not sensitive)

## Future Enhancements

- Support for custom model parameters (temperature, maxTokens)
- Model cost tracking per configuration
- A/B testing between models
- Model performance metrics

---

**Plan Created:** 2026-01-17
**Estimated Complexity:** T2 (Logic - DynamoDB read/write, Lambda updates, UI refactoring)
**Related Issues:** #147 (batch removal), #146 (transaction model simplification)
