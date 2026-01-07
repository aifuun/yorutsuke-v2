# Core Patterns

> State management, events, and communication patterns

## State Ownership

Logic and State are separate concerns with different homes.

### Logic: All in Service Layer

| Logic Type | Examples | Home |
|------------|----------|------|
| Business Logic | "If file > 1GB, check disk space first" | Service |
| Flow Logic | "Login AWS → get token → init local DB" | Service |
| Async Logic | Timers, polling, Promise chains | Service |
| Event Listeners | Tauri native events (file drop, window focus) | Service |

### State: Split by Lifecycle

| State Type | Home | Examples | Reason |
|------------|------|----------|--------|
| **Global Business State** | Zustand vanilla store | User info, task list, upload progress | Persists even if UI unmounts |
| **Local UI State** | React useState | Modal open, input text, tab index | Reset on unmount is OK |
| **One-time Notifications** | EventBus | Show toast, trigger scroll | Fire-and-forget |

---

## Zustand vs EventBus

| 维度 | Zustand (Vanilla Store) | EventBus (Emitter) |
|------|------------------------|-------------------|
| 性质 | 持久真相 (Persistence) | 瞬时信号 (Transient) |
| 隐喻 | **存折**：随时查，余额都在 | **敲门声**：响过就没，错过就错过 |
| React 行为 | 自动同步 UI：状态变 → 组件重绘 | 触发一次性动作：弹 Toast、播音效 |
| 典型案例 | 任务列表、进度条、用户余额 | 上传完成通知、报错弹窗、滚动到底部 |

### Decision Tree

```
需要传递数据到 React?
    │
    ├─ 数据需要"记忆"吗？（后来挂载的组件也要拿到）
    │       │
    │       ├─ YES → Zustand Store
    │       │         例：上传进度、任务列表、用户信息
    │       │
    │       └─ NO  → EventBus
    │                 例：显示 Toast、触发动画、一次性弹窗
    │
    └─ 不需要传到 React（纯 Service 内部）→ 普通变量/类属性
```

### Usage Examples

| 场景 | 技术 | 原因 |
|------|------|------|
| 上传进度 (0-100%) | Zustand Store | 持续变化，React 需要随时读取 |
| 上传完成通知 | EventBus | 一次性事件，触发 toast |
| 任务列表 | Zustand Store | 持续状态，多组件共享 |
| 显示错误弹窗 | EventBus | 一次性触发，阅后即焚 |

---

## Writer vs Observer Principle

```
┌─────────────────────────────────────────────────────────────┐
│  Service Layer = 唯一写入者 (Single Writer)                  │
│  ├── store.setState({ ... })   写入 Zustand                 │
│  └── eventBus.emit('event')    发送 EventBus                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  React Layer = 观察者 (Observer)                             │
│  ├── useStore(store)           观察持续状态                  │
│  └── useAppEvent('event')      响应一次性动作                │
└─────────────────────────────────────────────────────────────┘
```

### Rules

- ✅ Service 是唯一能修改 Zustand 和发送 EventBus 的层
- ✅ React 只读取 Zustand，只监听 EventBus
- ❌ React 不能直接调用 `store.setState()`
- ❌ React 不能发送业务相关的 EventBus 事件

---

## Anti-Pattern: Error in Zustand

```typescript
// ❌ BAD: 把报错信息存入 Zustand
const syncStore = createStore(() => ({
  status: 'idle',
  errorMessage: null,  // ← 问题根源
}));

function SyncStatus() {
  const error = useStore(syncStore, s => s.errorMessage);
  // 用户关闭弹窗后，errorMessage 仍然存在
  // 下次组件挂载时，弹窗会再次弹出！（UI Bug）
  if (error) return <ErrorModal message={error} />;
}

// ✅ GOOD: 用 EventBus 发送一次性通知
class SyncService {
  async sync() {
    try {
      await this.adapter.sync();
      syncStore.setState({ status: 'success' });
    } catch (e) {
      syncStore.setState({ status: 'error' });  // 状态（持久）
      eventBus.emit('toast:error', e.message);  // 通知（瞬时）
    }
  }
}
```

---

## Service → React Communication

```typescript
// ========== Service Layer (Pure TS) ==========
import { createStore } from 'zustand/vanilla';

export const uploadStore = createStore(() => ({
  tasks: [] as UploadTask[],
  progress: 0,
}));

class UploadService {
  start(file: string) {
    uploadStore.setState({ progress: 0 });
    // Call Adapter → Tauri
  }
}

export const uploadService = new UploadService();

// ========== React Layer (View) ==========
import { useStore } from 'zustand';
import { uploadStore } from './uploadService';

export function ProgressBar() {
  const progress = useStore(uploadStore, (s) => s.progress);
  return <div style={{ width: `${progress}%` }} />;
}
```

---

## Example: Delete File Flow

```
1. React: 用户点击删除按钮
   → fileService.delete(id)

2. Service: 执行删除
   → adapter.deleteFile(id)  // 调用 Tauri

3. Tauri: 物理删除文件
   → 返回成功

4. Service: 更新状态 + 发送通知
   → fileStore.setState({
       files: files.filter(f => f.id !== id)
     })
   → eventBus.emit('toast:success', '删除成功')

5. React 响应:
   ├── FileList: 因 Zustand 变化自动减少一项
   └── ToastContainer: 监听到事件，弹出提示
```

---

## FSM State Pattern

**Principle**: Single source of truth via FSM, no boolean flags.

```typescript
// ✅ GOOD: FSM State
type QueueState =
  | { status: 'idle'; tasks: Task[] }
  | { status: 'processing'; tasks: Task[]; currentId: ImageId }
  | { status: 'paused'; tasks: Task[]; reason: 'offline' | 'quota' };

// ❌ BAD: Boolean flags
const [isLoading, setIsLoading] = useState(false);
const [isPaused, setIsPaused] = useState(false);
const [hasError, setHasError] = useState(false);
```

---

## Event Types

All events are one-time notifications:

| Event | Trigger | Listeners | UI Effect |
|-------|---------|-----------|-----------|
| `toast:success` | Operation success | ToastContainer | Show toast |
| `toast:error` | Operation failure | ToastContainer | Show toast |
| `upload:complete` | S3 upload success | Transaction sync | Trigger sync |
| `file:duplicate` | MD5 match found | CaptureView | Show notice |
| `quota:exceeded` | At daily limit | CaptureView | Block uploads |
| `network:changed` | Connectivity change | Service layer | Pause/resume |

See [INTERFACES.md](./INTERFACES.md) for full event type definitions.

---

## Related

- [LAYERS.md](./LAYERS.md) - Where code goes
- [FLOWS.md](./FLOWS.md) - How data moves
- [README.md](./README.md) - Architecture index

---

*Extracted from ARCHITECTURE.md per #94*
