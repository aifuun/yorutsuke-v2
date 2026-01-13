# Push/Pull 轮流循环 - 潜在问题分析

## 🔍 可能的问题列表

### 1️⃣ **Timer 溢出问题** ⚠️ 严重

**问题描述**：
```
T=3s   执行 executePush() → 耗时 5 秒（网络慢）
T=6s   本应执行 executePull()，但上一个操作还在进行
       → Timer 继续触发，导致并发执行
```

**症状**：
```
T=3s    auto_sync_cycle_execute (operation: push)
T=6s    auto_sync_cycle_execute (operation: pull)  ← 同时执行！
        (前一个 push 还未完成)
```

**风险**：
- ❌ 数据竞态（Race Condition）
- ❌ 重复推送相同数据
- ❌ Pull 覆盖 Push 结果

**解决方案**：
```typescript
private syncInProgress = false;

private async executeSyncCycle(): Promise<void> {
  if (this.syncInProgress) {
    logger.warn('sync_already_in_progress');
    return;  // ✅ 防止并发
  }
  
  this.syncInProgress = true;
  try {
    if (this.nextOperation === 'push') {
      await this.executePush();
      this.nextOperation = 'pull';
    } else {
      await this.executePull();
      this.nextOperation = 'push';
    }
  } finally {
    this.syncInProgress = false;
  }
}
```

---

### 2️⃣ **网络恢复后状态混乱** ⚠️ 中等

**问题描述**：
```
T=1s    nextOp = 'push'
T=2s    网络断开 → Timer 停止
        nextOp 仍为 'push'
        
T=5s    网络恢复 → Timer 重启
        但不知道上次是 push 还是 pull
```

**症状**：
```
离线时最后是 push → 恢复时还是 push
结果：可能连续 push 两次，skip pull
```

**风险**：
- ❌ 跳过 Pull，漏掉云端新数据
- ❌ 连续 Push，浪费资源
- ❌ Pull/Push 计数不对称

**解决方案**：
```typescript
private restartSyncTimer(): void {
  // 网络恢复时强制执行 Pull
  // 确保获得最新数据
  this.nextOperation = 'pull';
  
  this.syncTimer = setInterval(
    () => this.executeSyncCycle(),
    AUTO_SYNC_DELAY_MS,
  );
}
```

---

### 3️⃣ **Push 持续失败导致脏数据积累** ⚠️ 中等

**问题描述**：
```
T=3s    executePush() → 失败（API 错误）
        dirty_sync 未清除，仍为 1
        nextOp = 'pull'
        
T=6s    executePull() → 成功
        nextOp = 'push'
        
T=9s    executePush() → 再次失败
        脏数据继续积累...
```

**症状**：
```
本地脏数据永远无法推送
而 Pull 在不断从云端拉取旧数据
可能导致本地有未同步的编辑
```

**风险**：
- ❌ 用户编辑的交易永久卡在本地
- ❌ 云端看不到最新的本地编辑
- ❌ 用户不知道有未同步的数据

**日志会显示**：
```
T=3s    auto_sync_push_cycle_failed (error: connection timeout)
T=6s    auto_sync_pull_cycle_complete (synced: 0)
T=9s    auto_sync_push_cycle_failed (error: connection timeout)
...     无限重复
```

**解决方案**：
```typescript
// 需要添加失败重试机制
// 或显示 UI 告知用户有未同步的数据
if (pushResult.failed.length > 0) {
  logger.warn('push_partial_failure', { failedCount: pushResult.failed.length });
  // 不清除 dirty_sync，下次继续重试
}

// 或者添加最大失败次数限制
private pushFailureCount = 0;
if (pushResult.failed.length > 0) {
  this.pushFailureCount++;
  if (this.pushFailureCount > 5) {
    // 通知用户或进行恢复
    emit('sync:data_sync_failed', { failedCount: pushResult.failed.length });
    this.pushFailureCount = 0;
  }
}
```

---

### 4️⃣ **组件卸载但 Timer 继续运行** ⚠️ 严重

**问题描述**：
```typescript
// 用户登出
setUser(null);  // ← 应该停止 Timer

// 但如果没有调用 destroy()...
// Timer 继续在后台运行！
```

**症状**：
```
内存泄漏：Timer 无法 GC
持续 setInterval 调用
```

**风险**：
- ❌ 内存持续增长
- ❌ CPU 浪费
- ❌ 长时间运行后应用变慢

**解决方案**：
```typescript
// 确保 setUser(null) 也停止 Timer
setUser(userId: UserId | null): void {
  this.userId = userId;
  if (userId) {
    this.restartSyncTimer();
  } else {
    this.stopSyncTimer();  // ✅ 必须停止
  }
}

// 或在 App 卸载时调用
useEffect(() => {
  return () => {
    autoSyncService.destroy();  // ✅ 清理
  };
}, []);
```

---

### 5️⃣ **Push 失败时 nextOperation 还是改为 pull** ⚠️ 中等

**问题描述**：
```typescript
private async executeSyncCycle(): Promise<void> {
  if (this.nextOperation === 'push') {
    await this.executePush();  // ← 失败了！
    this.nextOperation = 'pull';  // ← 但还是改为 pull
  }
}
```

**后果**：
```
T=3s    Push 失败
        nextOp = 'pull'
        
T=6s    执行 Pull（本地脏数据没有推送）
        Pull 可能覆盖本地编辑

T=9s    执行 Push（脏数据仍存在）
        推送旧的脏数据
```

**风险**：
- ❌ 失败的 Push 被忽略了
- ❌ 下一个 Push 间隔太长（6 秒后）

**解决方案**：
```typescript
if (this.nextOperation === 'push') {
  const pushResult = await this.executePush();
  
  if (pushResult.failed.length > 0) {
    // ✅ Push 有失败，不改变状态，继续 push
    logger.warn('push_has_failures', { count: pushResult.failed.length });
    // this.nextOperation 保持 'push'，3 秒后重试
  } else if (pushResult.synced > 0 || pushResult.queued > 0) {
    // ✅ Push 成功或有队列，切换到 pull
    this.nextOperation = 'pull';
  }
  // 如果 synced = 0, failed = 0, queued = 0（无脏数据），保持 'pull'
}
```

---

### 6️⃣ **用户快速切换账户** ⚠️ 中等

**问题描述**：
```
T=0s    用户 A 登录 → Timer 启动
T=0.5s  执行 push (用户 A)
T=1s    用户 A 登出，用户 B 登入 → Timer 重启
        但 Timer 还在处理用户 A 的数据！
T=0.7s  push 返回了 (用户 A 的结果)
        但现在 userId = 用户 B
```

**症状**：
```
auto_sync_push_execute (userId: userA)
  ... 网络延迟 ...
setUser(userB)  // Timer 重启
  ... push 返回 ...
数据被推送给错误的用户！
```

**风险**：
- ❌ 用户 A 的数据推送给了用户 B！
- ❌ 数据混乱

**解决方案**：
```typescript
private executingUserId: UserId | null = null;

private async executeSyncCycle(): Promise<void> {
  if (!this.userId) return;
  
  this.executingUserId = this.userId;  // ✅ 记录执行时的用户
  
  try {
    if (this.nextOperation === 'push') {
      // 再次验证用户未改变
      if (this.userId !== this.executingUserId) {
        logger.warn('user_changed_during_sync');
        return;  // ✅ 中止同步
      }
      await this.executePush();
      // ...
    }
  } finally {
    this.executingUserId = null;
  }
}
```

---

### 7️⃣ **Pull 后产生新脏数据但没有立即 Push** ⚠️ 低

**问题描述**：
```
T=6s    executePull() 获取云端数据
        本地有冲突 → 需要手动编辑
        用户手动编辑了一条交易
        dirty_sync = 1
        
T=9s    executePush() 应该推送
        ...
```

**这个其实不是问题**，但如果 Pull 处理太复杂可能导致延迟。

---

### 8️⃣ **错误恢复不足** ⚠️ 中等

**问题描述**：
```typescript
private async executeSyncCycle(): Promise<void> {
  try {
    // ...
  } catch (error) {
    logger.error('auto_sync_cycle_failed', { error });
    // 但没有恢复逻辑
  }
}
```

**症状**：
```
如果一个 cycle 出错，timer 继续运行
但错误可能会积累
```

**解决方案**：
```typescript
try {
  // ...
} catch (error) {
  // ✅ 错误恢复
  logger.error('auto_sync_cycle_failed', { error });
  
  // 不改变 nextOperation，保持当前操作
  // 下次重试时还会执行相同的操作
  
  // 或者主动跳过失败的操作
  if (this.retryCount++ > MAX_RETRIES) {
    this.nextOperation = this.nextOperation === 'push' ? 'pull' : 'push';
    this.retryCount = 0;
  }
}
```

---

## 📊 问题严重级别总结

| 问题 | 级别 | 影响 | 建议 |
|------|------|------|------|
| Timer 并发 | 🔴 严重 | 数据不一致 | ✅ 必须修复 |
| 网络恢复状态 | 🟡 中等 | 漏数据 | ✅ 应该修复 |
| Push 失败堆积 | 🟡 中等 | 本地数据卡住 | ⚠️ 需要考虑 |
| Timer 泄漏 | 🔴 严重 | 内存泄漏 | ✅ 确保调用 destroy() |
| Push 失败后改状态 | 🟡 中等 | 重试延迟 | ✅ 应该修复 |
| 用户快速切换 | 🟡 中等 | 数据混乱 | ✅ 应该修复 |
| 冲突处理 | 🟢 低 | 可接受 | ⚠️ 监控 |
| 错误恢复 | 🟡 中等 | 持续失败 | ✅ 应该改进 |

---

## ✅ 推荐修复方案

### 立即修复（Critical）

```typescript
class AutoSyncService {
  private syncInProgress = false;  // ✅ 防止并发
  private executingUserId: UserId | null = null;  // ✅ 防止用户混乱

  private async executeSyncCycle(): Promise<void> {
    // 防止并发
    if (this.syncInProgress) {
      logger.warn('sync_already_in_progress');
      return;
    }
    
    // 防止用户切换
    if (!this.userId || this.userId !== this.executingUserId) {
      this.executingUserId = this.userId;
    }
    
    this.syncInProgress = true;
    try {
      // ... 主逻辑 ...
    } finally {
      this.syncInProgress = false;
    }
  }
}
```

### 应该修复（Important）

```typescript
// 网络恢复时强制 Pull
private restartSyncTimer(): void {
  this.nextOperation = 'pull';  // ✅ 确保拉取最新数据
  // ...
}

// Push 失败时不改变状态
if (pushResult.failed.length > 0) {
  // 保持 'push'，继续重试
} else {
  this.nextOperation = 'pull';
}
```

### 监控指标（Monitoring）

```
- Timer 并发计数
- Push 失败率
- Push 失败持续时间
- 脏数据积累数量
- 用户切换频率
```

---

## 🎯 建议行动

**优先级 1 - 必须修复**：
- [ ] 添加 `syncInProgress` 防止并发
- [ ] 添加 `executingUserId` 防止用户混乱
- [ ] 确保 destroy() 在适当地方调用

**优先级 2 - 应该修复**：
- [ ] Push 失败时保持状态，继续重试
- [ ] 网络恢复时强制 Pull
- [ ] 添加失败计数和通知

**优先级 3 - 监控**：
- [ ] 添加性能日志
- [ ] 监控脏数据堆积
- [ ] 追踪同步成功率
