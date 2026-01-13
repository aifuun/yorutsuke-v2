# Push/Pull 轮流同步循环 - 实现总结

## 问题诊断

🔴 **之前的问题**：
- Push 和 Pull 在同一个 `fullSync()` 中立即执行
- 刚推送的数据被 Pull 阶段的冲突解决覆盖
- 时间戳相同时采用"云优先"策略导致本地数据丢失

## 新方案：连续轮流循环

✅ **核心思想**：
```
每 3 秒轮流执行一个操作，Push 和 Pull 分开进行
T=0s  → Push (如果有脏数据)
T=3s  → Pull (总是执行)
T=6s  → Push (如果有脏数据)
T=9s  → Pull (总是执行)
...  → 持续循环
```

## 实现变更

### 1️⃣ 类成员变量的修改

**之前**：
```typescript
private debounceTimer: ReturnType<typeof setTimeout> | null = null;
private retryTimer: ReturnType<typeof setTimeout> | null = null;
```

**现在**：
```typescript
private syncTimer: ReturnType<typeof setInterval> | null = null;
private nextOperation: 'push' | 'pull' = 'push';
```

**原因**：
- `setInterval` 替代 `setTimeout` → 持续循环而非一次性
- `nextOperation` 追踪轮流状态 → 简化逻辑

### 2️⃣ 初始化方法 - `init()`

**变化**：
```typescript
// 事件监听不再调用 scheduleSync，只是标记状态
on('transaction:confirmed', () => this.markDirty()),
on('transaction:updated', () => this.markDirty()),
on('transaction:deleted', () => this.markDirty()),
```

**原因**：定时器已经在运行，无需通过事件触发

### 3️⃣ 用户设置方法 - `setUser()`

**变化**：
```typescript
setUser(userId: UserId | null): void {
  this.userId = userId;
  if (userId) {
    this.restartSyncTimer();  // ✅ 启动定时器
  } else {
    this.stopSyncTimer();     // ✅ 停止定时器
  }
}
```

**原因**：用户登录时启动循环，登出时停止

### 4️⃣ 核心循环 - `restartSyncTimer()`

```typescript
private restartSyncTimer(): void {
  this.stopSyncTimer();

  if (!this.userId || !networkMonitor.getStatus()) {
    return; // 条件不满足，不启动
  }

  // ⭐ 关键：使用 setInterval 而非 setTimeout
  this.syncTimer = setInterval(
    () => this.executeSyncCycle(),
    AUTO_SYNC_DELAY_MS, // 3000ms
  );
}
```

**优势**：
- ✅ 自动循环，无需手动重新安排
- ✅ 精确的 3 秒间隔
- ✅ 网络感知：离线自动停止

### 5️⃣ 执行周期 - `executeSyncCycle()`

```typescript
private async executeSyncCycle(): Promise<void> {
  // 轮流执行
  if (this.nextOperation === 'push') {
    await this.executePush();
    this.nextOperation = 'pull';  // 切换
  } else {
    await this.executePull();
    this.nextOperation = 'push';  // 切换
  }
}
```

**关键**：简单的状态机，每周期切换一次

### 6️⃣ Push 执行 - `executePush()`

```typescript
private async executePush(): Promise<...> {
  // 1. 检查脏数据
  const dirtyTxs = await fetchDirtyTransactions(userId);
  
  // 2. 没有脏数据时跳过
  if (dirtyTxs.length === 0) {
    logger.debug('auto_sync_push_skip', { reason: 'no_dirty_data' });
    return { synced: 0, failed: [] };
  }
  
  // 3. 有脏数据时推送
  return transactionPushService.syncDirtyTransactions(...);
}
```

**特色**：按需执行，避免无意义的 API 调用

### 7️⃣ Pull 执行 - `executePull()`

```typescript
private async executePull(): Promise<...> {
  // 总是拉取
  return pullTransactions(userId, traceId);
}
```

**特色**：无条件执行，保证与云端同步

## 日志流程

### 场景 1：用户确认交易

```
T=0.0s  [init]        auto_sync_service_initialized
T=0.5s  [user login]  auto_sync_timer_started (intervalMs: 3000)
T=1.2s  [confirm]     auto_sync_dirty_marked
        auto_sync_cycle_execute (operation: push)
        auto_sync_push_skip (reason: no_dirty_data) ← 尚未轮到 Push 周期
        
T=3.0s  auto_sync_cycle_execute (operation: push)
        auto_sync_push_execute (dirtyCount: 1)
        auto_sync_push_cycle_complete (synced: 1)  ✅
        
T=6.0s  auto_sync_cycle_execute (operation: pull)
        auto_sync_pull_execute
        auto_sync_pull_cycle_complete (synced: 1)  ✅ 包含已推送数据
```

### 场景 2：网络中断

```
T=5.0s  [offline]     auto_sync_network_reconnect (action: restart_timer)
        auto_sync_timer_not_started (reason: offline)
        
T=8.5s  [online]      auto_sync_network_reconnect (action: restart_timer)
        auto_sync_timer_started (intervalMs: 3000)
        
T=9.0s  auto_sync_cycle_execute (operation: push)
        auto_sync_push_execute (dirtyCount: 2)  ← 累积的脏数据
        auto_sync_push_cycle_complete (synced: 2)  ✅
```

## 性能对比

| 指标 | 旧方案 | 新方案 | 改进 |
|------|------|------|------|
| **同步延迟** | 0-3s (debounce) | 0-6s (轮流) | ❌ 稍长，但避免冲突 |
| **API 调用** | 事件驱动突发 | 均匀分布 | ✅ 更友好 |
| **冲突概率** | 高 (100% 立即) | 低 (3s 间隔) | ✅ 显著降低 |
| **代码复杂度** | 中等 (防抖) | 简单 (定时器) | ✅ 更清晰 |
| **网络效率** | 不稳定 | 稳定恒定 | ✅ 更可预测 |

## 依赖关系

```
autoSyncService
  ├─ transactionPushService.syncDirtyTransactions()
  ├─ transactionPushService.processQueue()
  ├─ transactionDb.fetchDirtyTransactions()
  ├─ pullTransactions()
  └─ networkMonitor.getStatus()
```

## 文件修改统计

```
app/src/02_modules/sync/services/autoSyncService.ts
  - 174 insertions(+)
  - 120 deletions(-)
  = 主要改变：循环机制和执行流程
```

## 向后兼容性

✅ **兼容**：
- `triggerManualSync()` 仍可用（执行当前待定操作）
- `setUser()` API 不变
- `init()` API 不变
- 所有日志事件保持

❌ **不兼容**：
- 已移除 `scheduleSync()` 方法（不再需要）
- 事件监听不再直接触发同步

## 测试建议

1. **单元测试**：
   - ✅ Timer 启动/停止
   - ✅ 轮流状态切换
   - ✅ Push/Pull 条件判断
   - ✅ 网络状态变化

2. **集成测试**：
   - ✅ 用户登录 → 启动 Timer
   - ✅ 用户登出 → 停止 Timer
   - ✅ 网络离线 → 暂停 → 在线 → 恢复
   - ✅ 脏数据的推送和拉取

3. **性能测试**：
   - ✅ 内存泄漏检查（Timer 清理）
   - ✅ CPU 负荷（持续轮询）
   - ✅ 网络流量（均衡分布）

## 未来优化空间

- 🔷 动态间隔：根据服务器响应时间调整 3 秒
- 🔷 优先级：脏数据多时增加 Push 频率
- 🔷 批处理：累积脏数据后批量推送
- 🔷 智能停止：长时间无活动时暂停 Timer
