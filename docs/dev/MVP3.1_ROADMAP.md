# MVP3.1 - 增强型批处理 (Observability + Reliability)

**状态**: 规划中  
**目标**: 提升 MVP3 的可观测性、可靠性和用户体验  
**预期工期**: 3 个工作周  
**开始日期**: 2026-01-13 (post-MVP3 验证)

---

## 📋 概述

MVP3 完成了核心功能（4 项改进：幂等性、流式处理、S3 映射、IAM 最小权限），现已可在 dev 环境部署。

MVP3.1 在此基础上，重点提升：
- **可观测性**: 完整链路追踪（traceId）+ 实时监控告警
- **可靠性**: 消息队列 + DLQ 处理失败消息
- **用户体验**: 文件自动清理 + 详细错误报告

---

## 🎯 4 项核心任务

### 任务 #1: 图片文件迁移 (migrateImageFiles)

**优先级**: 🔴 CRITICAL  
**工期估算**: 4-6 小时  
**依赖**: pending-images schema 确认 + s3Key 字段可用  
**阻塞项**: 无（MVP3 中实现为 TODO，不影响部署）

**目的**:
- 将处理完的图片从 `uploads/` 迁移到 `processed/{YYYY-MM-DD}/`
- 实现自动文件清理（30天后 S3 lifecycle 删除）
- 记录迁移状态和失败情况

**实施清单**:
- [ ] **确认 s3Key 来源**
  - pending-images 表中是否包含 s3Key？
  - 如无，需在 presign/instant-processor 补充
  - 格式: `uploads/{userId}/{timestamp}-{filename}` ✓
  
- [ ] **实现 migrateImageFiles 函数**
  ```javascript
  async function migrateImageFiles(imageIds, jobId, userId) {
    // 1. 查询 pending-images 表获取 s3Key
    // 2. CopyObject: uploads/ → processed/{date}/
    // 3. DeleteObject: uploads/
    // 4. 错误处理: dead-letter + 日志记录
  }
  ```
  
- [ ] **错误处理策略**
  - CopyObject 失败: 记录 WARN，保留源文件，继续
  - DeleteObject 失败: 记录 WARN（源文件保留可手动清理）
  - Dead-letter: 保存失败记录到 S3 `dead-letters/{jobId}/{timestamp}.json`
  
- [ ] **重试逻辑**
  - 3 次重试 + exponential backoff (100ms → 200ms → 400ms)
  - 最终失败更新 transaction 状态为 `migrationFailed`
  
- [ ] **单元测试**
  - Mock S3 CopyObject/DeleteObject
  - 验证 JST 日期格式 (YYYY-MM-DD)
  - 验证错误情况处理
  
- [ ] **集成测试**
  - 上传测试图片到 uploads/
  - 手动触发批处理
  - 验证文件迁移成功 + 源文件删除

**代码改动**:
- `infra/lambda/batch-result-handler/index.mjs`: 实现 migrateImageFiles (~40 行)
- `infra/lambda/batch-result-handler/index.test.mjs`: 添加测试 (~30 行)

**验收标准**:
- 迁移成功率 > 99% (< 1 失败/1000)
- 日期格式正确 (YYYY-MM-DD, JST-based)
- Dead-letter 记录完整 (imageId, error, timestamp)

---

### 任务 #2: 日志链路追踪 (Trace Propagation)

**优先级**: 🟡 MEDIUM  
**工期估算**: 2-3 小时  
**依赖**: 无  
**阻塞项**: 无

**目的**:
- 完整追踪每笔交易的全生命周期 (upload → batch → result)
- 便于问题排查和性能分析
- 符合 Pillar R (可观测性)

**实施清单**:
- [ ] **在 transaction record 中保存 traceId**
  ```typescript
  const transaction = {
    transactionId,
    imageId,
    userId,
    traceId: ctx.traceId,  // ← 新增字段
    intentId: jobMetadata.intentId,  // ← 新增字段 (from batch-jobs)
    amount,
    // ... 其他字段
  };
  ```
  
- [ ] **更新 DynamoDB 表 schema**
  - transactions 表添加 `traceId` (String, optional)
  - transactions 表添加 `intentId` (String, optional)
  - 创建 GSI: `(intentId, transactionId)` 便于按 intent 查询
  
- [ ] **CloudWatch Logs insights 查询示例**
  ```
  fields @timestamp, @message, traceId, imageId, jobId
  | filter traceId = "12345-abc"
  | stats count() by imageId
  ```
  
- [ ] **Lambda 日志中加 traceId**
  ```javascript
  logger.info(EVENTS.BATCH_RESULT_STARTED, {
    jobId,
    traceId: ctx.traceId,  // ← 每处日志都加
    bucket,
    key
  });
  ```
  
- [ ] **单元测试**
  - 验证 traceId 正确传播
  - 验证 intentId 从 batch-jobs 查询获得
  
- [ ] **集成测试**
  - 端到端流程: upload → batch → result
  - CloudWatch Logs 按 traceId 检索确认日志链路完整

**代码改动**:
- `infra/lambda/batch-result-handler/index.mjs`: 在 transform/write 中加 traceId/intentId (~10 行)
- CDK: transactions 表添加 traceId GSI (~8 行)

**验收标准**:
- 100% 的 transaction 记录包含 traceId
- CloudWatch Logs 可按 traceId 完整检索
- intentId GSI 查询性能 < 100ms

---

### 任务 #3: 消息队列 + DLQ (SQS + DLQ)

**优先级**: 🟡 MEDIUM  
**工期估算**: 6-8 小时  
**依赖**: 无 (但建议在 #1 之后实施，确保错误处理清晰)  
**阻塞项**: 无 (MVP3 使用 S3 event 也可接受)

**目的**:
- 提升失败消息处理的可靠性
- 自动重试机制 (可配置重试次数)
- Dead-letter queue 可见性
- 便于故障排查和恢复

**架构变更**:
```
S3 batch-output/ 事件
  ↓
SNS Topic (可选, 便于多个消费者)
  ↓
SQS Queue (主队列)
  ↓
Lambda (batch-result-handler) ← 通过 EventSourceMapping
  ↓ [if fails after retries]
SQS DLQ (死信队列)
```

**实施清单**:
- [ ] **CDK 中定义 SQS Queue + DLQ**
  ```typescript
  const batchResultDLQ = new sqs.Queue(this, "BatchResultDLQ", {
    queueName: `yorutsuke-batch-result-dlq-${env}`,
    retentionPeriod: cdk.Duration.days(14),
  });
  
  const batchResultQueue = new sqs.Queue(this, "BatchResultQueue", {
    queueName: `yorutsuke-batch-result-queue-${env}`,
    visibilityTimeout: cdk.Duration.minutes(15),
    deadLetterQueue: { queue: batchResultDLQ, maxReceiveCount: 3 },
  });
  ```
  
- [ ] **S3 → SNS → SQS 配置**
  - 创建 SNS Topic
  - S3 bucket 事件通知发送到 SNS (而非直接 Lambda)
  - SNS 订阅 SQS Queue
  
- [ ] **Lambda event source mapping**
  - 将 Lambda 与 SQS Queue 关联
  - 配置批次大小: 10 (权衡延迟 vs 吞吐)
  - 配置可见性超时: 15 分钟 (Lambda timeout 10m + buffer)
  - 配置并发消费: 2 (avoid overwhelming downstream)
  
- [ ] **DLQ 监控告警**
  ```typescript
  new cloudwatch.Alarm(this, "BatchResultDLQAlarm", {
    metric: batchResultDLQ.metricApproximateNumberOfMessagesVisible(),
    threshold: 1,
    alarmDescription: "Batch result DLQ has messages",
    alarmName: `yorutsuke-batch-result-dlq-depth-${env}`,
    evaluationPeriods: 1,
  });
  ```
  
- [ ] **Lambda 改动最小化**
  - event 格式从 `S3Event` 改为 `SQSEvent`
  - 解析 SQS 消息体为 S3Event
  - 错误处理: 抛出异常自动进入 DLQ
  
- [ ] **集成测试**
  - 模拟 S3 event → SNS → SQS 流程
  - 测试失败重试 (mock Lambda failure)
  - 验证消息进入 DLQ
  - 验证告警触发

**代码改动**:
- `infra/lambda/batch-result-handler/index.mjs`: 解析 SQS event (~20 行)
- `infra/lib/yorutsuke-stack.ts`: SQS + SNS 配置 (~50 行)

**验收标准**:
- SQS Queue 正常收消息
- 失败消息自动重试 (3 次)
- DLQ 中的消息可被监控告警检测
- 告警准确率 > 95%

**后续手动恢复流程**:
1. 检查 DLQ 中的消息 (使用 AWS Console 或 CLI)
2. 修复根本原因 (如 pending-images 表缺字段)
3. 从 DLQ 恢复消息到主队列或重新处理

---

### 任务 #4: 监控告警 (CloudWatch Metrics)

**优先级**: 🟡 MEDIUM  
**工期估算**: 3-4 小时  
**依赖**: #3 建议先完成 (便于利用 SQS metrics)  
**阻塞项**: 无

**目的**:
- 实时监控批处理的成功率和性能
- 及时发现异常（如失败率突增）
- 支持自动告警和人工干预

**4 项核心指标**:

| 指标 | 类型 | 计算方式 | 告警条件 |
|------|------|---------|---------|
| `BatchResult/SuccessCount` | Sum | 成功处理的 transaction 数 | - |
| `BatchResult/FailureCount` | Sum | 失败的 transaction 数 | `> 5% of total` |
| `BatchResult/ProcessingTime` | Histogram | Lambda 执行时间 (ms) | `p99 > 60s` |
| `BatchResult/DLQDepth` | Gauge | SQS DLQ 消息数 | `> 0` |

**实施清单**:
- [ ] **Lambda 中添加 putMetricData()**
  ```javascript
  import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
  
  const cloudwatch = new CloudWatchClient({});
  
  // 在处理完成后
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: "Yorutsuke",
    MetricData: [
      {
        MetricName: "BatchResult/SuccessCount",
        Value: successCount,
        Unit: "Count",
        Timestamp: new Date(),
      },
      {
        MetricName: "BatchResult/FailureCount",
        Value: failureCount,
        Unit: "Count",
        Timestamp: new Date(),
      },
      {
        MetricName: "BatchResult/ProcessingTime",
        Value: endTime - startTime,
        Unit: "Milliseconds",
        Timestamp: new Date(),
      },
    ],
  }));
  ```
  
- [ ] **CDK 中定义 CloudWatch Alarms**
  ```typescript
  // 失败率告警
  new cloudwatch.Alarm(this, "BatchResultFailureRateAlarm", {
    metric: new cloudwatch.Metric({
      namespace: "Yorutsuke",
      metricName: "BatchResult/FailureCount",
      statistic: "Sum",
      period: cdk.Duration.minutes(5),
    }),
    threshold: /* computed from success + failure */,
    evaluationPeriods: 2,
    alarmDescription: "Batch result failure rate > 5%",
    alarmName: `yorutsuke-batch-result-failure-rate-${env}`,
  });
  
  // 处理时间告警
  new cloudwatch.Alarm(this, "BatchResultProcessingTimeAlarm", {
    metric: new cloudwatch.Metric({
      namespace: "Yorutsuke",
      metricName: "BatchResult/ProcessingTime",
      statistic: "p99",
      period: cdk.Duration.minutes(5),
    }),
    threshold: 60000, // 60 seconds in milliseconds
    evaluationPeriods: 1,
    alarmDescription: "Batch result processing time (p99) > 60s",
    alarmName: `yorutsuke-batch-result-processing-time-${env}`,
  });
  
  // DLQ 深度告警
  new cloudwatch.Alarm(this, "DLQDepthAlarm", {
    metric: batchResultDLQ.metricApproximateNumberOfMessagesVisible(),
    threshold: 0,
    evaluationPeriods: 1,
    alarmDescription: "DLQ has unprocessed messages",
    alarmName: `yorutsuke-batch-result-dlq-depth-${env}`,
  });
  ```
  
- [ ] **SNS notification 配置**
  ```typescript
  const alertsTopic = new sns.Topic(this, "BatchResultAlertsTopic", {
    topicName: `yorutsuke-batch-result-alerts-${env}`,
    displayName: "Batch Result Alerts",
  });
  
  // 所有告警都发送到此 SNS topic
  // 在 AWS 控制台订阅邮件或 Slack
  ```
  
- [ ] **CloudWatch Dashboard 创建**
  ```typescript
  new cloudwatch.Dashboard(this, "BatchResultDashboard", {
    dashboardName: `yorutsuke-batch-result-${env}`,
    widgets: [
      new cloudwatch.GraphWidget({
        title: "Success/Failure Count",
        left: [
          new cloudwatch.Metric({
            namespace: "Yorutsuke",
            metricName: "BatchResult/SuccessCount",
            statistic: "Sum",
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: "Yorutsuke",
            metricName: "BatchResult/FailureCount",
            statistic: "Sum",
          }),
        ],
      }),
      // ... 其他 widget
    ],
  });
  ```
  
- [ ] **告警测试**
  - 手动修改告警阈值为低值
  - 执行批处理
  - 验证告警触发 + 通知发送
  
- [ ] **性能基准 (Baseline)**
  - 正常情况: 成功率 > 95%, 处理时间 (p95) < 10s
  - 记录基准值便于后续对比

**代码改动**:
- `infra/lambda/batch-result-handler/index.mjs`: 添加 metrics (~25 行)
- `infra/lib/yorutsuke-stack.ts`: Alarms + Dashboard (~80 行)

**验收标准**:
- 4 项 metrics 正确上传到 CloudWatch
- 3 项 Alarms 在阈值触发时工作正常
- Dashboard 显示实时数据
- SNS 通知在告警时发送

---

## 📈 执行优先级 + 依赖矩阵

| # | 任务 | 优先级 | 工期 | 依赖 | 可并行 | 备注 |
|---|------|--------|------|------|--------|------|
| 1 | migrateImageFiles | 🔴 HIGH | 4-6h | pending-images schema | 2 | 关键功能 |
| 2 | trace 传播 | 🟡 MED | 2-3h | 无 | 1, 3, 4 | 快速胜利 |
| 3 | SQS + DLQ | 🟡 MED | 6-8h | 无 | 4 | 架构升级 |
| 4 | metrics | 🟡 MED | 3-4h | 3 (建议) | - | 运维可见性 |

**推荐执行顺序** (时间线):

```
Week 1 (Jan 13-17):
  - Day 1-2: 任务 #2 (trace, 2-3h, 快速胜利)
  - Day 2-3: 任务 #1 (migrateImageFiles, 4-6h, 关键)
  - 并行: 确认 pending-images schema

Week 2 (Jan 20-24):
  - Day 1-2: 任务 #3 (SQS + DLQ, 6-8h, 架构升级)

Week 3 (Jan 27-31):
  - Day 1-2: 任务 #4 (metrics, 3-4h)
  - Day 3-5: 集成测试 + 调优 + 文档
```

---

## ✅ 验收标准 (DoD: Definition of Done)

**代码**:
- [ ] 所有 4 项任务代码已提交到 master
- [ ] TypeScript 编译无错误
- [ ] Node.js 语法验证通过
- [ ] 代码风格一致 (与 MVP3 保持)

**测试**:
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试在 dev 环境通过
- [ ] 所有测试脚本已提交
- [ ] 性能基准已建立 (baseline)

**性能 & 可靠性**:
- [ ] migrateImageFiles 成功率 > 99%
- [ ] 处理时间 (p95) < 10s
- [ ] 失败率 < 5%
- [ ] DLQ 消息能被正确处理

**可观测性**:
- [ ] 100% transaction 记录包含 traceId
- [ ] CloudWatch Logs 可按 traceId 完整检索
- [ ] 4 项 metrics 正确上传
- [ ] 3 项 Alarms 工作正常

**文档**:
- [ ] 本 Roadmap 已更新完成状态
- [ ] 部署指南已更新 (SQS, metrics 配置)
- [ ] 故障排查指南已编写 (DLQ 恢复流程)
- [ ] 性能调优建议已文档化

---

## 🔮 未来考虑 (MVP3.2+)

- [ ] **Step Functions 并行处理**
  - 场景: 日均交易量 > 10K
  - 目的: 突破单 Lambda 的吞吐量限制
  - 工期: 8-10h

- [ ] **Kinesis Firehose 实时分析**
  - 场景: 需要实时聚合统计
  - 目的: BI dashboard 更新延迟 < 1min
  - 工期: 6-8h

- [ ] **ML 异常检测**
  - 场景: 自动发现处理异常
  - 目的: 提前告警而非被动响应
  - 工期: 12-16h

---

## 📞 相关文档

| 文档 | 位置 | 用途 |
|------|------|------|
| MVP3 Plan | [.claude/batch-result-handler-PLAN.md](.claude/batch-result-handler-PLAN.md) | 详细设计 |
| MVP3 实现 | [.claude/IMPLEMENTATION-COMPLETE-#99.md](.claude/IMPLEMENTATION-COMPLETE-#99.md) | 实现总结 |
| MVP3 PILLAR | [docs/architecture/](../architecture/) | 架构对齐 |
| TODO 追踪 | [.claude/TODO.md](.claude/TODO.md) | 会话跟踪 |

