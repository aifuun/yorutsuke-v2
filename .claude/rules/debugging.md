# Debugging Rules

> 不要猜测，让日志说话。

## 排查顺序

```
1. 本地 Logs → 2. 云端 Logs → 3. 模拟代码流程 → 4. 最小复现
```

### 1. 本地 Logs

```bash
# 查看今日日志
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | tail -50 | jq .

# 按 traceId 追踪完整链路
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.traceId == "trace-xxx")'

# 查看所有错误
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.level == "error")'
```

### 2. 云端 Logs

```bash
# CloudWatch Lambda 日志
aws logs tail /aws/lambda/yorutsuke-instant-processor-dev --follow --profile dev

# 按 traceId 搜索
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-dev \
  --filter-pattern '"trace-xxx"' --profile dev
```

### 3. 模拟代码流程

- 用 LSP `goToDefinition` / `incomingCalls` 追踪调用链
- 检查 `STATE_TRANSITION` 日志确认状态机转换
- 添加临时 `logger.debug()` 缩小范围

### 4. 最小复现

写测试固定 bug，隔离变量逐个排除。

## 黄金法则

1. **先看日志** - 日志比直觉可靠
2. **用 traceId 串联** - 跨系统追踪同一请求
3. **检查状态机** - 很多 bug 是状态转换问题
