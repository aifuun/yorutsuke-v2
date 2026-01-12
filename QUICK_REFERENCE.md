# 快速参考卡 - Push/Pull 轮流同步

## 🎯 核心逻辑（3 行总结）

```typescript
// 每 3 秒执行一次
setInterval(() => this.executeSyncCycle(), 3000);

// 每次只执行 Push 或 Pull，不同时执行
if (nextOperation === 'push') { push(); nextOp = 'pull'; }
else { pull(); nextOp = 'push'; }
```

---

## 📅 时间表

| 时间 | 操作 | 条件 | 下次 |
|------|------|------|------|
| 0s | PUSH | 有脏数据? | → Pull |
| 3s | PULL | 总是执行 | → Push |
| 6s | PUSH | 有脏数据? | → Pull |
| 9s | PULL | 总是执行 | → Push |

---

## 🔄 状态机

```
Initial: nextOp = 'push'

Timer: every 3s
  ┌─────────────────┐
  │  executeSyncCycle()
  │
  ├─ if push?
  │  ├─ executePush()
  │  └─ nextOp = 'pull'
  │
  ├─ else
  │  ├─ executePull()
  │  └─ nextOp = 'push'
  │
  └─ repeat
```

---

## 💡 为什么有效

```
旧方案：Push ─立即─→ Pull ─冲突→ 覆盖 ❌
新方案：Push ─3秒─→ Pull ─成功→ 同步 ✅
```

---

## 📊 指标

| 指标 | 值 |
|------|-----|
| 循环周期 | 3 秒 |
| 单个操作时长 | ~0.1-0.5 秒 |
| Push/Pull 频率 | 每 6 秒轮流 |
| 推送延迟 | 0-6 秒 |
| 拉取延迟 | 3-9 秒 |

---

## 🛠️ 关键方法

```typescript
init()                    // 注册事件，初始化
setUser(userId)          // 启动/停止 Timer
restartSyncTimer()        // 启动 3s 定时器
executeSyncCycle()        // 主循环：轮流执行
executePush()             // Push 脏数据
executePull()             // Pull 云端数据
stopSyncTimer()           // 清理 Timer
```

---

## 📝 日志关键词

- `auto_sync_timer_started` - Timer 启动
- `auto_sync_cycle_execute` - 周期执行
- `auto_sync_push_execute` - 执行 Push
- `auto_sync_push_skip` - 跳过 Push
- `auto_sync_pull_execute` - 执行 Pull
- `auto_sync_cycle_failed` - 周期失败

---

## ✅ 验证命令

```bash
# 查看修改
git diff app/src/02_modules/sync/services/autoSyncService.ts

# 检查类型
npx tsc --noEmit

# 查看日志
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | grep auto_sync
```

---

## 🚨 常见问题

**Q: 为什么不同时执行？**
A: if-else 结构保证互斥，避免冲突覆盖

**Q: 为什么 3 秒间隔？**
A: 给服务器充分时间处理，避免时间戳冲突

**Q: 为什么 Pull 总是执行？**
A: 需要同步服务器上的新数据

**Q: 为什么 Push 条件执行？**
A: 无脏数据时跳过，节省网络资源

**Q: 离线怎么办？**
A: Timer 自动停止，脏数据累积，上线时继续

---

## 📂 相关文档

- `TRAIN_MODE_SYNC.md` - 详细设计说明
- `PUSH_PULL_SOLUTION.md` - 完整实现文档
- `SINGLE_OPERATION_PER_SLOT.md` - 代码验证
- `SYNC_SCHEDULE.txt` - 时间表可视化
- `IMPLEMENTATION_SUMMARY.md` - 技术细节
