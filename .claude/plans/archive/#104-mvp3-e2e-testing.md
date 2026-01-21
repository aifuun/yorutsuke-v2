# Feature Plan: #104 MVP3 End-to-End Batch Testing

> **Step 2 of Two-Step Planning** - 综合测试计划

| 项目 | 值 |
|------|-----|
| Issue | #104 |
| MVP | MVP3 |
| 复杂度 | T2 (Integration Testing) |
| 预估 | 3-4h |
| 状态 | [x] 规划 / [ ] 执行中 / [ ] Review / [ ] 完成 |

---

## 1. 目标

**做什么**: 验证 MVP3 混合批处理系统的完整流程，包括 Lambda 部署、配置管理、触发机制、OCR 处理和结果存储。

**为什么**:
- 确保所有 MVP3 组件正确集成
- 验证 Instant/Batch/Hybrid 三种模式都能正常工作
- 验证 Admin Panel 配置生效
- 保证后续开发的稳定基线

**验收标准**:
- [ ] 所有 Backend 测试 (SB-200~220) 通过
- [ ] Admin Panel 配置测试通过
- [ ] Integration 测试通过
- [ ] 无现有功能退化

---

## 2. 测试方案

### 2.1 环境验证 (~30min)

**Phase 1: 检查 AWS 资源部署状态**

| 资源 | 检查方法 | 预期 |
|------|----------|------|
| Lambda Functions | `aws lambda list-functions --profile dev` | 5个 Lambda 存在 |
| DynamoDB Tables | `aws dynamodb list-tables --profile dev` | transactions, batch-jobs, control 表存在 |
| S3 Buckets | `aws s3 ls --profile dev` | yorutsuke-images-dev 存在 |
| S3 Prefixes | `aws s3 ls s3://yorutsuke-images-dev/ --profile dev` | uploads/, processed/ 存在 |

**Lambda 清单**:
- [x] `yorutsuke-presign-dev`
- [x] `yorutsuke-instant-processor-dev`
- [x] `yorutsuke-batch-orchestrator-dev`
- [x] `yorutsuke-batch-result-handler-dev`
- [x] `yorutsuke-batch-config-dev` (Admin API)

**Phase 2: 检查 Lambda 环境变量**

```bash
# instant-processor
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-dev \
  --profile dev \
  --query 'Environment.Variables'

# 预期: TRANSACTIONS_TABLE, CONTROL_TABLE, MODEL_ID, IMAGES_BUCKET
```

**Phase 3: 检查 Admin Panel 可访问性**

```bash
# 获取 Admin Panel URL
aws cloudformation describe-stacks \
  --stack-name YorutsukeAdminStack \
  --profile dev \
  --query 'Stacks[0].Outputs'

# 访问 URL，检查 Dashboard 加载
```

---

### 2.2 Backend 测试 (SB-200~220) (~1.5h)

#### SB-200: Instant 模式测试

**目标**: 验证 Instant 模式下每张图片立即处理

**前置条件**:
```bash
# 设置 Admin Config 为 Instant 模式
curl -X PUT https://<admin-api-url>/config \
  -H "Content-Type: application/json" \
  -d '{"processingMode": "instant"}'
```

**步骤**:
1. 上传 1 张测试图片（使用 test-assets）
2. 检查 instant-processor Lambda 日志
3. 检查 transactions 表是否有新记录

**预期**:
- instant-processor 被触发（S3 ObjectCreated event）
- 5-10 秒内 transactions 表有记录
- 图片移动到 processed/

**验证命令**:
```bash
# 查看 Lambda 日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-dev \
  --since 5m --profile dev

# 查询 transactions 表
aws dynamodb scan \
  --table-name yorutsuke-transactions-dev \
  --profile dev \
  --max-items 5
```

---

#### SB-203: Batch 模式 - 10 张触发

**目标**: 验证 Batch 模式下累计 10 张图片触发批处理

**前置条件**:
```bash
# 设置 Admin Config 为 Batch 模式
curl -X PUT https://<admin-api-url>/config \
  -d '{"processingMode": "batch", "imageThreshold": 10}'
```

**步骤**:
1. 上传 9 张图片 → 等待 → 不应触发
2. 上传第 10 张图片 → 立即触发 batch-orchestrator
3. 检查 batch-jobs 表状态
4. 等待 Batch Inference 完成（~30-60 分钟）
5. 检查 batch-result-handler 执行
6. 验证 transactions 表有 10 条记录

**预期**:
- 前 9 张不触发 batch-orchestrator
- 第 10 张触发 batch-orchestrator
- batch-jobs 表有 jobId 记录，status: SUBMITTED
- 完成后 status: COMPLETED
- transactions 表有 10 条记录

**验证命令**:
```bash
# 检查 batch-jobs 表
aws dynamodb scan \
  --table-name yorutsuke-batch-jobs-dev \
  --profile dev

# 检查 Bedrock Batch Job 状态
aws bedrock list-model-invocation-jobs \
  --profile dev \
  --region us-east-1
```

**⚠️ 注意**: Batch Inference 需要 30-60 分钟，可以并行测试其他场景。

---

#### SB-204: Hybrid 模式 - 超时降级

**目标**: 验证 Hybrid 模式下不足 10 张时，超时后使用 instant-processor

**前置条件**:
```bash
# 设置 Hybrid 模式，超时 5 分钟（测试用）
curl -X PUT https://<admin-api-url>/config \
  -d '{"processingMode": "hybrid", "imageThreshold": 10, "timeoutMinutes": 5}'
```

**步骤**:
1. 上传 5 张图片
2. 等待 5 分钟（超时）
3. 检查是否触发 instant-processor（降级处理）
4. 验证 transactions 表有 5 条记录

**预期**:
- 5 张图片不触发 batch-orchestrator（不足阈值）
- 5 分钟后 EventBridge 触发超时检查
- instant-processor 被调用 5 次
- transactions 表有 5 条记录

**⚠️ 问题**: 当前 CDK stack 可能没有 EventBridge 定时器，需要确认。

---

#### SB-205: Batch Job 结果处理

**目标**: 验证 batch-result-handler 正确处理 Bedrock 输出

**步骤**:
1. 等待 SB-203 的 Batch Job 完成
2. 检查 S3 batch-output/ 是否有输出文件
3. 检查 batch-result-handler 日志
4. 验证 transactions 表记录格式正确

**预期**:
- batch-output/ 有 results.jsonl
- batch-result-handler 被 S3 event 触发
- transactions 表字段完整：merchant, amount, category, confidence

**验证命令**:
```bash
# 检查 S3 输出
aws s3 ls s3://yorutsuke-images-dev/batch-output/ --profile dev

# 下载并查看输出
aws s3 cp s3://yorutsuke-images-dev/batch-output/results.jsonl . --profile dev
cat results.jsonl | jq .
```

---

#### SB-210: OCR 质量测试

**目标**: 验证 AI 正确提取收据信息

**步骤**:
1. 使用 `/private/tmp/yorutsuke-test/receipts/` 中的清晰收据
2. 上传并处理
3. 检查提取的字段：
   - merchant (商户名)
   - amount (金额)
   - category (分类: sale/purchase/meal/transport...)
   - confidence (置信度 0-1)

**预期**:
- merchant 提取正确（≥80% 准确率）
- amount 数值正确（100% 准确率，数字识别）
- category 合理（可接受同义词）
- confidence ≥ 0.7（清晰收据）

**验证方法**:
```bash
# 查询最近交易
aws dynamodb query \
  --table-name yorutsuke-transactions-dev \
  --profile dev \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "device-xxx"}}' \
  --scan-index-forward false \
  --limit 5
```

---

#### SB-220: Admin Config 生效测试

**目标**: 验证 Admin Panel 修改配置后，Lambda 读取新配置

**步骤**:
1. 在 Admin Panel 修改 modelId: `amazon.nova-pro-v1:0`
2. 触发新的处理（Instant 或 Batch）
3. 检查 Lambda 日志，确认使用了 nova-pro

**预期**:
- Lambda 从 DynamoDB control 表读取最新配置
- 日志显示使用 `amazon.nova-pro-v1:0`
- OCR 结果更精确（可选验证）

**验证命令**:
```bash
# 检查 control 表
aws dynamodb get-item \
  --table-name yorutsuke-control-dev \
  --key '{"configKey": {"S": "batch_config"}}' \
  --profile dev

# 检查 Lambda 日志中的 modelId
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-dev \
  --filter-pattern "modelId" \
  --profile dev
```

---

### 2.3 Admin Panel 测试 (~30min)

#### AP-01: 加载配置

**步骤**:
1. 访问 Admin Panel → Control 页面
2. 检查当前配置显示

**预期**:
- processingMode 显示正确
- imageThreshold 显示正确
- modelId 显示正确

---

#### AP-02: 修改 Threshold

**步骤**:
1. 修改 imageThreshold: 10 → 5
2. 点击 Save
3. 刷新页面，确认保存成功
4. 上传 5 张图片，验证触发

**预期**:
- 保存成功提示
- 刷新后显示 5
- 上传 5 张立即触发 batch

---

#### AP-03: 修改 LLM Model

**步骤**:
1. 修改 modelId: `amazon.nova-lite-v1:0` → `amazon.nova-pro-v1:0`
2. 保存
3. 触发处理，检查日志

**预期**:
- 保存成功
- 新处理使用 nova-pro

---

### 2.4 Integration 测试 (~1h)

#### INT-01: 完整 Instant 流程

**端到端**:
```
Tauri App 上传 → S3 → instant-processor → transactions → Tauri App 查看
```

**步骤**:
1. 在 Tauri App 拖拽上传 1 张收据
2. 等待上传完成（Queue 组件显示）
3. 等待 5-10 秒
4. 切换到 Transaction 页面
5. 验证新交易显示

**预期**:
- Queue 显示 Uploading → Uploaded
- Transaction 列表有新记录
- 金额、商户正确

---

#### INT-02: 完整 Batch 流程

**端到端**:
```
Tauri App 上传 10 张 → S3 → batch-orchestrator → Bedrock Batch → batch-result-handler → transactions → Tauri App 查看
```

**步骤**:
1. Admin Panel 设置 Batch 模式
2. Tauri App 上传 10 张收据
3. 等待 Batch Job 完成（30-60 分钟）
4. 刷新 Transaction 页面
5. 验证 10 条交易显示

**预期**:
- 10 张全部上传成功
- Batch Job 状态: SUBMITTED → IN_PROGRESS → COMPLETED
- Transaction 列表有 10 条新记录
- 成本为 On-Demand 的 50%

---

#### INT-03: Admin Config 影响测试

**端到端**:
```
Admin Panel 修改 threshold → Tauri App 上传 → 验证新阈值生效
```

**步骤**:
1. Admin Panel 设置 threshold = 3
2. Tauri App 上传 3 张
3. 验证触发 batch

**预期**:
- 第 3 张上传时触发 batch-orchestrator
- batch-jobs 表有记录

---

### 2.5 回归测试 (~30min)

**验证现有功能无退化**:

| 功能 | 测试场景 | 预期 |
|------|----------|------|
| MVP1 Local | 离线拖拽上传 | Queue 正常显示 |
| MVP2 Upload | Presign URL | 上传成功 |
| MVP2 Quota | 查看配额 | Quota Widget 正常 |
| MVP2 Offline | 断网后上传 | 暂停并显示 offline |

**步骤**:
1. 断网 → 拖拽上传 → 验证暂停
2. 恢复网络 → 验证自动继续
3. 检查 Quota Widget 显示
4. 检查 Queue 3-column 布局正常

---

## 3. 测试工具

### AWS CLI 命令集

```bash
# 1. Lambda 状态
aws lambda list-functions --profile dev | jq '.Functions[] | select(.FunctionName | startswith("yorutsuke"))'

# 2. DynamoDB 表
aws dynamodb list-tables --profile dev

# 3. S3 内容
aws s3 ls s3://yorutsuke-images-dev/uploads/ --profile dev

# 4. Lambda 日志（实时）
aws logs tail /aws/lambda/yorutsuke-instant-processor-dev --follow --profile dev

# 5. Bedrock Batch Jobs
aws bedrock list-model-invocation-jobs --region us-east-1 --profile dev

# 6. 查询 transactions
aws dynamodb scan --table-name yorutsuke-transactions-dev --profile dev --max-items 10

# 7. 查询 batch-jobs
aws dynamodb scan --table-name yorutsuke-batch-jobs-dev --profile dev
```

### 测试图片

使用 `/private/tmp/yorutsuke-test/receipts/` 中的测试收据：
- `clear-receipt-1.jpg` - 清晰收据
- `blurry-receipt-1.jpg` - 模糊收据
- 准备 10 张不同收据用于 Batch 测试

---

## 4. 风险 & 依赖

### 风险

| 风险 | 级别 | 应对 |
|------|------|------|
| CDK 版本不兼容 | 高 | 升级 CDK CLI 到 2.1033.0+ |
| Batch Job 耗时长 (30-60min) | 中 | 并行测试其他场景 |
| Bedrock Batch 最低 100 张限制 | 高 | 确认 threshold >= 100，或使用 Instant 测试 |
| EventBridge 定时器未配置 | 中 | 检查 CDK stack，添加 EventBridge Rule |
| Admin Panel 部署状态 | 中 | 确认 CloudFront distribution 正常 |

### 依赖

**前置 Issues (全部已完成)**:
- [x] #97 instant-processor Lambda
- [x] #98 batch-orchestrator Lambda
- [x] #99 batch-result-handler Lambda
- [x] #101 Admin Config API
- [x] #102 Admin Panel Batch Settings

**AWS 资源**:
- [x] S3: yorutsuke-images-dev
- [x] DynamoDB: transactions, batch-jobs, control
- [x] Lambda: 5 个函数
- [x] Bedrock: Nova Lite + Batch Inference 权限

**外部服务**:
- AWS Bedrock Batch Inference API (us-east-1)
- Admin Panel CloudFront URL

---

## 5. 潜在问题

### Issue 1: CDK 版本不兼容

**现象**: `cdk list` 报错 schema version mismatch

**原因**: CDK CLI 版本过低 (当前 <2.1033.0)

**解决**:
```bash
npm install -g aws-cdk@latest
cdk --version  # 确认 >= 2.1033.0
```

---

### Issue 2: EventBridge 定时器未配置

**现象**: Hybrid 模式超时不触发 instant-processor

**原因**: CDK stack 缺少 EventBridge Rule

**解决**: 检查 `infra/lib/yorutsuke-stack.ts`，添加：
```typescript
// EventBridge Rule for hybrid timeout
new events.Rule(this, 'HybridTimeoutRule', {
  schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
  targets: [new targets.LambdaFunction(batchCounterFn)],
});
```

---

### Issue 3: Batch Inference 最低 100 张限制

**现象**: 少于 100 张无法创建 Batch Job

**原因**: AWS Bedrock Batch API 限制

**解决**:
- 测试时使用 Instant 模式
- 或准备 100 张测试图片（不现实）
- 或仅测试 threshold 检测逻辑，不实际触发 Batch

---

### Issue 4: Bedrock 跨区域延迟

**现象**: us-east-1 Bedrock API 响应慢

**原因**: 跨太平洋网络延迟

**解决**:
- 使用 Cross-region Inference Profile
- 接受 5-10 秒延迟（正常）

---

## 6. 测试检查清单

### 环境验证
- [ ] CDK CLI 版本 >= 2.1033.0
- [ ] 5 个 Lambda 函数已部署
- [ ] 3 个 DynamoDB 表存在
- [ ] S3 bucket 和 prefixes 正确
- [ ] Admin Panel 可访问

### Backend 测试
- [ ] SB-200: Instant 模式测试通过
- [ ] SB-203: Batch 模式 10 张触发通过
- [ ] SB-204: Hybrid 模式超时降级通过
- [ ] SB-205: Batch Job 结果处理通过
- [ ] SB-210: OCR 质量达标
- [ ] SB-220: Admin Config 生效

### Admin Panel 测试
- [ ] AP-01: 加载配置正常
- [ ] AP-02: 修改 Threshold 生效
- [ ] AP-03: 修改 LLM Model 生效

### Integration 测试
- [ ] INT-01: 完整 Instant 流程通过
- [ ] INT-02: 完整 Batch 流程通过
- [ ] INT-03: Admin Config 影响验证通过

### 回归测试
- [ ] MVP1 Local 功能正常
- [ ] MVP2 Upload 功能正常
- [ ] MVP2 Quota 功能正常
- [ ] MVP2 Offline 功能正常

---

## 7. 进度

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-01-09 | 规划完成 | 测试计划已创建 |
| | 待执行 | 需先解决 CDK 版本问题 |
| | | |

---

*执行前确认*:
- [ ] CDK 版本已升级
- [ ] 所有 AWS 资源已部署
- [ ] 测试图片已准备
- [ ] Admin Panel 可访问
- [ ] 时间预留充足（Batch Job 需 30-60min）
