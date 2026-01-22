# Tauri Logger → Lambda Logger 可借鉴的功能

> 反向分析：Tauri logger 的哪些设计可以改进 Lambda logger

**Created**: 2026-01-22
**Status**: Analysis for potential Lambda logger improvements

---

## 🎯 可借鉴的核心功能

### 1. ⭐ logStateTransition 辅助函数（强烈推荐）

**Tauri 实现**：
```typescript
export function logStateTransition(params: {
  entity: string;
  entityId: string;
  from: string;
  to: string;
  [key: string]: unknown;
}): void {
  const { entity, entityId, from, to, ...rest } = params;
  logger.info(EVENTS.STATE_TRANSITION, {
    entity,
    entityId,
    from,
    to,
    ...rest,
  });
}
```

**为什么 Lambda 需要**：
- Lambda 处理事务状态转换（unconfirmed → confirmed → deleted）
- Saga 步骤转换（presign → upload → process → sync）
- 标准化 FSM 日志格式（Pillar D）

**Lambda 适配版本**：
```typescript
// infra/lambda/shared-layer/nodejs/shared/logger.ts
export function logStateTransition(params: {
  entity: string;        // 'Transaction', 'Upload', 'Saga'
  entityId: string;      // txId, imageId, sagaId
  from: string;          // 'unconfirmed', 'presign_started'
  to: string;            // 'confirmed', 'upload_completed'
  traceId?: string;      // Optional override (usually from context)
  [key: string]: unknown;
}): void {
  const { entity, entityId, from, to, traceId, ...rest } = params;

  // Override traceId if provided (useful for async flows)
  if (traceId) {
    setContext({ traceId });
  }

  logger.info(EVENTS.STATE_TRANSITION, {
    entity,
    entityId,
    from,
    to,
    ...rest,
  });
}

// 使用示例
logStateTransition({
  entity: 'Transaction',
  entityId: 'txn-123',
  from: 'unconfirmed',
  to: 'confirmed',
  userId: 'user-xyz',
  amount: 1500,
});
```

**好处**：
- ✅ 标准化状态转换日志格式
- ✅ 自动包含必要字段（entity, entityId, from, to）
- ✅ CloudWatch 查询更容易（统一格式）
- ✅ 符合 Pillar D（FSM）最佳实践

---

### 2. ⭐ Context.getOptional() 模式（推荐）

**Tauri 实现**：
```typescript
function createLogEntry(level, event, data) {
  const ctx = globalContextProvider?.getOptional();  // ← 不会抛错

  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    traceId: ctx?.traceId ?? 'no-trace',  // 安全默认值
    userId: ctx?.userId ?? undefined,
    ...data,
  };
}
```

**Lambda 当前实现**：
```typescript
// 全局 currentContext，可能在某些边缘场景未初始化
let currentContext: LoggerContext = { traceId: 'no-trace' };

function createLogEntry(level, event, data) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    traceId: currentContext.traceId,  // 假设总是有效
    userId: currentContext.userId,
    requestId: currentContext.requestId,
    ...data,
  });
}
```

**潜在问题**：
- Lambda 冷启动时，如果 logger 在 initContext 前被调用会怎样？
- 多个请求共享同一 Lambda 容器（未来如果启用并发）

**Lambda 改进版本**：
```typescript
// 添加安全的 context 获取
function getContext(): LoggerContext {
  return currentContext ?? { traceId: 'no-trace', userId: null, requestId: null };
}

function createLogEntry(level, event, data) {
  const ctx = getContext();  // 总是安全

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    traceId: ctx.traceId ?? 'no-trace',  // 双重保护
    userId: ctx.userId,
    requestId: ctx.requestId,
    ...filteredData,
  });
}
```

**好处**：
- ✅ 防御性编程（即使在异常场景下也不会崩溃）
- ✅ 明确的默认值（'no-trace' 而不是 undefined）
- ✅ 为未来的 Lambda 并发做准备

---

### 3. 📝 更详细的设计决策注释（推荐）

**Tauri 的优秀注释示例**：

```typescript
/**
 * Write log entry to local file via Tauri IPC.
 * Fire-and-forget: errors are silently ignored to avoid log recursion.
 */
function persistLog(entry: LogEntry): void {
  // Skip persistence in browser-only mode
  if (typeof window === 'undefined' || !('__TAURI__' in window)) {
    return;
  }

  invoke('log_write', { entry }).catch(() => {
    // Silently ignore - we can't log errors about logging
  });
}
```

**为什么这个注释好**：
- ✅ 说明了 "为什么" 这样设计（"avoid log recursion"）
- ✅ 说明了边界条件（"browser-only mode"）
- ✅ 说明了错误处理策略（"silently ignore"）

**Lambda logger 可以改进的注释**：

```typescript
// 当前（简单）
function filterSensitiveData(data: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 5 || !data) return data;
  // ...
}

// 改进（说明设计决策）
/**
 * Filter sensitive data from log objects (P1: sensitive data filtering)
 *
 * Design decisions:
 * - Max depth 5: Prevents stack overflow on deeply nested objects
 * - Case-insensitive matching: Catches 'Password', 'password', 'PASSWORD'
 * - Returns '[REDACTED]': Clear indicator, doesn't expose data length
 * - Short-circuits on primitives: Performance optimization (no traversal)
 *
 * Trade-offs:
 * - May miss deeply nested secrets (>5 levels) - acceptable for security/performance balance
 * - Field name matching only - doesn't scan values (prevents false positives)
 */
function filterSensitiveData(data: unknown, depth = 0): unknown {
  // ...
}
```

---

### 4. 🛠️ getLogFilePath() 调试辅助函数（可选）

**Tauri 实现**：
```typescript
/**
 * Get the path to today's log file (for debugging).
 */
export async function getLogFilePath(): Promise<string | null> {
  if (typeof window === 'undefined' || !('__TAURI__' in window)) {
    return null;
  }

  try {
    return await invoke<string>('log_get_path');
  } catch {
    return null;
  }
}
```

**Lambda 可以借鉴**：
Lambda 日志在 CloudWatch，但可以添加辅助函数方便查询：

```typescript
// infra/lambda/shared-layer/nodejs/shared/logger.ts
/**
 * Get CloudWatch log stream name for current invocation (for debugging)
 */
export function getLogStreamName(): string {
  return process.env.AWS_LAMBDA_LOG_STREAM_NAME || 'unknown-stream';
}

/**
 * Generate CloudWatch Insights query for current traceId
 */
export function getCloudWatchQuery(traceId?: string): string {
  const tid = traceId || currentContext.traceId;
  return `fields @timestamp, @message
| filter @message like /"${tid}"/
| sort @timestamp desc
| limit 100`;
}

// 使用示例（在 Lambda handler 中）
logger.info('DIAGNOSTIC_INFO', {
  logStream: getLogStreamName(),
  cloudWatchQuery: getCloudWatchQuery(),
});
```

**好处**：
- ✅ 方便开发者快速生成 CloudWatch 查询
- ✅ 在日志中包含 log stream name（用于精确定位）
- ✅ 减少手动构造查询的错误

---

### 5. 📦 日志清理机制（可选，Lambda 用处不大）

**Tauri 实现**：
```typescript
export async function initLogger(): Promise<void> {
  try {
    const deleted = await invoke<number>('log_cleanup', { retentionDays: 7 });
    if (deleted > 0) {
      logger.info(EVENTS.APP_STARTED, { logFilesCleanedUp: deleted });
    }
  } catch {
    // Silently ignore cleanup errors
  }
}
```

**Lambda 不需要**：
- CloudWatch 有自动的 retention policy（可在 CDK 中配置）
- Lambda 函数本身是无状态的，不需要清理本地日志

但可以借鉴的思想：
- 在 CDK 中明确配置 CloudWatch log retention
- 在日志中记录 retention policy（方便审计）

```typescript
// infra/lib/yorutsuke-stack.ts
const logGroup = new logs.LogGroup(this, 'LambdaLogs', {
  logGroupName: `/aws/lambda/${lambdaFunction.functionName}`,
  retention: logs.RetentionDays.ONE_WEEK,  // 明确 7 天
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

// Lambda 启动时记录
logger.info('LAMBDA_INITIALIZED', {
  logRetentionDays: 7,
  logGroup: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
});
```

---

### 6. 🎨 extractTag / formatEventMessage（Lambda 不需要）

**Tauri 的 UI 格式化**：
```typescript
function extractTag(event: string): string {
  // UPLOAD_STARTED -> Upload
  const parts = event.split('_');
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
}

function formatEventMessage(event: string): string {
  // UPLOAD_STARTED -> Started
  const parts = event.split('_');
  const rest = parts.slice(1).join(' ').toLowerCase();
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
```

**Lambda 不需要因为**：
- Lambda 没有 UI，日志直接到 CloudWatch
- CloudWatch 支持 JSON 查询，不需要人类友好格式
- 保持 JSON 原始格式更利于机器解析

但可以借鉴的思想：
- 在开发环境提供格式化工具
- 在 Admin Panel 中实现类似的格式化

```bash
# 可以创建本地工具格式化 CloudWatch 日志
# scripts/format-cloudwatch-logs.sh
aws logs tail /aws/lambda/yorutsuke-presign-dev --follow --profile dev \
  | jq -r '.timestamp + " | " + .event + " | " + (.data | tostring)'
```

---

## 📊 优先级排序

| 功能 | 优先级 | 实现难度 | 价值 |
|------|--------|---------|------|
| **logStateTransition** | ⭐⭐⭐⭐⭐ | 低（15 分钟） | 高（标准化 FSM 日志） |
| **getContext() 安全模式** | ⭐⭐⭐⭐ | 低（10 分钟） | 中（防御性编程） |
| **设计决策注释** | ⭐⭐⭐⭐ | 低（30 分钟） | 高（代码可维护性） |
| **getCloudWatchQuery 辅助** | ⭐⭐⭐ | 中（30 分钟） | 中（调试便利性） |
| **CDK log retention 配置** | ⭐⭐ | 低（5 分钟） | 低（已有 CloudWatch 策略） |
| **Debug UI 格式化** | ⭐ | N/A | N/A（Lambda 不需要） |

---

## 🚀 推荐实施计划

### Phase 1: 快速改进（1小时）

1. **添加 logStateTransition** (15min)
   ```typescript
   export function logStateTransition(params: { /* ... */ }): void
   ```

2. **添加 getContext() 安全模式** (10min)
   ```typescript
   function getContext(): LoggerContext { /* ... */ }
   ```

3. **改进关键函数注释** (30min)
   - filterSensitiveData
   - normalizeErrorData
   - createLogEntry

4. **添加 CloudWatch 辅助函数** (15min)
   ```typescript
   export function getLogStreamName(): string
   export function getCloudWatchQuery(traceId?: string): string
   ```

### Phase 2: 文档和测试（可选）

5. **更新测试** (30min)
   - logStateTransition 测试（5 cases）
   - getContext 边缘情况测试（3 cases）

6. **更新文档** (15min)
   - LOGGING.md 添加 logStateTransition 示例
   - README 添加 CloudWatch 查询示例

---

## 💡 使用示例

### Lambda 中使用 logStateTransition

```typescript
// presign Lambda
import { logStateTransition, EVENTS } from '/opt/nodejs/shared/logger.js';

export async function handler(event) {
  const ctx = initContext(event);

  // 状态转换：开始预签名
  logStateTransition({
    entity: 'Presign',
    entityId: ctx.traceId,
    from: 'requested',
    to: 'processing',
    userId: body.userId,
    fileName: body.fileName,
  });

  try {
    const presignedUrl = await generatePresignedUrl(/* ... */);

    // 状态转换：完成预签名
    logStateTransition({
      entity: 'Presign',
      entityId: ctx.traceId,
      from: 'processing',
      to: 'completed',
      presignedUrl: presignedUrl.slice(0, 50) + '...',  // 截断 URL
    });

    return { statusCode: 200, body: JSON.stringify({ presignedUrl }) };
  } catch (error) {
    // 状态转换：失败
    logStateTransition({
      entity: 'Presign',
      entityId: ctx.traceId,
      from: 'processing',
      to: 'failed',
      error: error.message,
    });
    throw error;
  }
}
```

### CloudWatch Insights 查询变得更简单

```
# 查找所有状态转换
fields @timestamp, entity, entityId, from, to
| filter event = "STATE_TRANSITION"
| sort @timestamp desc

# 查找失败的转换
fields @timestamp, entity, entityId, from, to, error
| filter event = "STATE_TRANSITION" and to = "failed"
| sort @timestamp desc
```

---

## 🎯 总结

**Tauri → Lambda 最有价值的借鉴**：

1. ✅ **logStateTransition**（标准化 FSM 日志）
2. ✅ **安全的 context 获取**（防御性编程）
3. ✅ **设计决策注释**（代码可维护性）

**不适合 Lambda 的**：
- ❌ Debug UI 格式化（无 UI）
- ❌ 本地日志清理（CloudWatch 管理）
- ❌ IPC 持久化（无本地文件系统）

---

**状态**: ✅ Analysis complete
**下一步**: 可以在 Lambda logger 中实施 Phase 1 改进（预计 1 小时）
