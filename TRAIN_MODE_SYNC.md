# Alternating Sync Loop (Issue #117)

## 问题

之前的同步模式在一个 `fullSync()` 中同时执行 Push 和 Pull，导致刚推送的数据被覆盖。

### 日志证据
```
08:42:57.534Z - auto_sync_started
08:42:57.539Z - SYNC_STARTED (dirtyCount:1)
08:42:57.682Z - SYNC_COMPLETED (synced:1) ✅ Push 成功
08:42:57.835Z - sync_conflict_resolved (strategy: cloud_default) ❌ 被覆盖
```

## 解决方案：连续循环 + 轮流执行

采用简洁的持续循环模式：

```
时间线：
  T=0s    → 检查脏数据 → Push (如果有) → 切换到 Pull
  T=3s    → Pull 云端数据 → 切换到 Push
  T=6s    → 检查脏数据 → Push (如果有) → 切换到 Pull
  T=9s    → Pull 云端数据 → 切换到 Push
  ...
  循环继续，直到用户退出或网络离线
```

**关键特性：**
- ✅ **连续运行**：不需要事件触发，一旦设置就持续工作
- ✅ **轮流执行**：Push 和 Pull 交替，每个 3 秒
- ✅ **按需执行**：Push 时检查是否有脏数据，没有就跳过
- ✅ **网络感知**：离线时暂停，在线时重启
- ✅ **避免覆盖**：Push 和 Pull 分开 3 秒执行，不会立即冲突

## 实现细节

### 修改文件
- [autoSyncService.ts](app/src/02_modules/sync/services/autoSyncService.ts)

### 核心逻辑

#### 1. 初始化与用户设置

```typescript
class AutoSyncService {
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private nextOperation: 'push' | 'pull' = 'push';

  setUser(userId: UserId | null): void {
    this.userId = userId;
    if (userId) {
      this.restartSyncTimer(); // 启动定时器
    } else {
      this.stopSyncTimer();    // 停止定时器
    }
  }
}
```

#### 2. 启动定时器

```typescript
private restartSyncTimer(): void {
  this.stopSyncTimer();
  
  if (!this.userId || !networkMonitor.getStatus()) {
    return; // 不满足条件，不启动
  }

  // 每 3 秒执行一次周期
  this.syncTimer = setInterval(
    () => this.executeSyncCycle(),
    AUTO_SYNC_DELAY_MS, // 3000ms
  );
}
```

#### 3. 执行一个周期

```typescript
private async executeSyncCycle(): Promise<void> {
  if (this.nextOperation === 'push') {
    // 推送阶段
    const pushResult = await this.executePush();
    
    // 检查是否有脏数据
    if (pushResult.synced > 0) {
      logger.info('pushed data to cloud', { synced: pushResult.synced });
    } else {
      logger.debug('no dirty data, skipping push');
    }
    
    // 切换到 Pull
    this.nextOperation = 'pull';
  } else {
    // 拉取阶段
    const pullResult = await this.executePull();
    logger.info('pulled from cloud', { synced: pullResult.synced });
    
    // 切换到 Push
    this.nextOperation = 'push';
  }
}
```

#### 4. Push 阶段（按需执行）

```typescript
private async executePush(): Promise<{ synced: number; failed: string[] }> {
  // 检查是否有脏数据
  const dirtyTxs = await fetchDirtyTransactions(this.userId);
  
  if (dirtyTxs.length === 0) {
    // 没有脏数据，跳过此周期
    logger.debug('no_dirty_data');
    return { synced: 0, failed: [] };
  }

  // 有脏数据，执行推送
  const result = await transactionPushService.syncDirtyTransactions(...);
  return result;
}
```

#### 5. Pull 阶段（总是执行）

```typescript
private async executePull(): Promise<{ synced: number; conflicts: number; errors: string[] }> {
  // 总是拉取云端数据
  const result = await pullTransactions(this.userId, traceId);
  return result;
}
```

## 日志示例

启用新模式后，日志会显示：

```
T=0s   auto_sync_cycle_execute (operation: push)
T=0s   auto_sync_push_skip (reason: no_dirty_data)
       auto_sync_cycle_execute (operation: pull)

T=3s   auto_sync_pull_execute
       auto_sync_pull_cycle_complete (synced: 1, conflicts: 0)

T=6s   auto_sync_cycle_execute (operation: push)
       auto_sync_push_execute (dirtyCount: 1)
       auto_sync_push_cycle_complete (synced: 1)

T=9s   auto_sync_cycle_execute (operation: pull)
       auto_sync_pull_execute
       auto_sync_pull_cycle_complete (synced: 0, conflicts: 0)
```

## 网络感知

```typescript
networkMonitor.subscribe((online) => {
  if (online) {
    // 网络恢复，重启定时器
    this.restartSyncTimer();
  }
});
```

## 优势对比

| 特性 | 旧方案 | 新方案 |
|------|------|------|
| 触发机制 | 事件驱动 + 防抖 | 连续定时器 |
| Push/Pull | 同时执行 | 轮流执行 |
| 脏数据处理 | 总是推送 | 按需推送 |
| 冲突风险 | 高（即时覆盖） | 低（3秒间隔） |
| 网络效率 | 事件突发 | 均匀分布 |
| 概念复杂度 | 中等 | 简洁 |

## 用户体验

- 确认交易后，下一个 3 秒周期会推送到云端
- 3 秒后的周期会从云端拉取（不会被立即覆盖）
- 总延迟：0-6 秒（取决于与定时器的对齐）
- 后续同步轮流进行，保证数据一致性

