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

## Hook Bridge Patterns (Layer 1.5)

**Purpose**: Hook Bridge Layer connects React to Services without violating separation of concerns. Hooks serve three distinct roles: Connector, Selector, and Orchestrator.

### Pattern 1: Connector (Subscribe to Service Store)

**Use when**: React component needs to display Service state.

```typescript
// ========== Service Layer (Pure TS) ==========
import { createStore } from 'zustand/vanilla';

export const debugSettingsStore = createStore<DebugSettingsStore>((set) => ({
  status: 'idle',
  settings: null,
  setReady: (settings) => set({ status: 'ready', settings }),
}));

export const debugSettingsSelectors = {
  debugEnabled: (state: DebugSettingsStore) =>
    state.status === 'ready' ? state.settings.debugEnabled : false,
};

// ========== Hook Bridge Layer (React Connector) ==========
import { useStore } from 'zustand';

export function useDebugEnabled(): boolean {
  return useStore(debugSettingsStore, debugSettingsSelectors.debugEnabled);
}

// ========== View Layer (React Component) ==========
export function DebugView() {
  const debugEnabled = useDebugEnabled(); // ✅ Uses Hook, not direct store

  return <div>{debugEnabled ? 'Debug Mode ON' : 'Debug Mode OFF'}</div>;
}
```

**Key Points**:
- Hook subscribes to Vanilla Zustand store using `useStore()`
- Selector returns **primitive value** (ADR-012 compliance)
- Component gets reactive updates when store changes

### Pattern 2: Selector (Extract Primitive Values)

**Use when**: Need to extract specific data without causing re-renders.

```typescript
// ✅ CORRECT: Individual primitive selectors
export function useTransactionCount(): number {
  return useStore(transactionStore, s => s.transactions.length);
}

export function useTransactionTotal(): number {
  return useStore(transactionStore, s => s.totalAmount);
}

// Component only re-renders when specific value changes
export function TransactionSummary() {
  const count = useTransactionCount(); // Only re-render if count changes
  const total = useTransactionTotal(); // Only re-render if total changes

  return <div>{count} transactions, total: ¥{total}</div>;
}
```

**Anti-Pattern: Object Selector (Causes Infinite Loops)**

```typescript
// ❌ WRONG: Object selector creates new reference every render
export function useTransactionData() {
  return useStore(transactionStore, s => ({
    count: s.transactions.length,
    total: s.totalAmount,
  })); // ⚠️ New object = infinite re-renders
}

// Component re-renders infinitely!
export function TransactionSummary() {
  const data = useTransactionData(); // ⚠️ Always new object reference
  return <div>{data.count} transactions, total: ¥{data.total}</div>;
}
```

**See**: [ADR-012: Zustand Selector Safety](./ADR/012-zustand-selector-safety.md)

### Pattern 3: Orchestrator (Coordinate Multiple Services)

**Use when**: Component needs data/actions from multiple Services, OR needs to add UI-specific logic.

#### Example A: Multi-Service Coordination

```typescript
// ========== Hook Bridge Layer (Orchestrator) ==========
export function useOrderProcess() {
  // Connect to multiple Services
  const user = useStore(authService.store, s => s.user);
  const orders = useStore(orderService.store, s => s.orders);

  // Composition logic: coordinate Services
  const handlePurchase = async (productId: string) => {
    if (!user) {
      alert('Please login'); // ✅ UI interaction (Hook responsibility)
      return;
    }
    await orderService.create(user.id, productId); // ✅ Delegate to Service
  };

  // Format logic: UI-specific transformation
  const activeOrders = orders.filter(o => o.status === 'active');

  return { activeOrders, handlePurchase };
}

// ========== View Layer ==========
export function OrderView() {
  const { activeOrders, handlePurchase } = useOrderProcess();

  return (
    <div>
      {activeOrders.map(order => (
        <OrderCard key={order.id} order={order} />
      ))}
      <button onClick={() => handlePurchase('prod-123')}>
        Purchase
      </button>
    </div>
  );
}
```

**Key Points**:
- Hook coordinates `authService` and `orderService`
- Hook handles UI interaction (alert)
- Hook filters data for display (activeOrders)
- Business logic stays in Service (`orderService.create`)

#### Example B: Form Validation Split

**Rule**: Format validation → Hook, Business validation → Service.

```typescript
// ========== Hook Bridge Layer (Format Validation) ==========
export function useLoginForm() {
  const [email, setEmail] = useState('');

  // ✅ UI validation: format check (no IO)
  const emailError = !email.includes('@') ? 'Invalid email format' : null;

  const handleSubmit = async () => {
    // ✅ Delegate business validation to Service
    await authService.login(email);
  };

  return { email, setEmail, emailError, handleSubmit };
}

// ========== Service Layer (Business Validation) ==========
class AuthService {
  async login(email: string) {
    // ✅ Business validation: DB check (IO required)
    const user = await userDb.findByEmail(email);
    if (!user) throw new Error('User not found'); // Business rule

    // ✅ Business logic: session management
    this.store.setState({ user, isAuthenticated: true });
  }
}

// ========== View Layer ==========
export function LoginView() {
  const { email, setEmail, emailError, handleSubmit } = useLoginForm();

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      {emailError && <span className="error">{emailError}</span>}
      <button type="submit">Login</button>
    </form>
  );
}
```

**Boundaries**:

| Validation Type | Location | Reason |
|----------------|----------|--------|
| Format validation | Hook | Pure UI feedback, no IO |
| Business validation | Service | Requires DB check, business rules |

#### Example C: Navigation (UI Side Effect)

**Rule**: Navigation is a UI concern → Handle in Hook.

```typescript
// ========== Hook Bridge Layer (Navigation) ==========
export function useOrderComplete() {
  const navigate = useNavigate(); // React Router hook

  const handleComplete = async (orderId: OrderId) => {
    // ✅ Service does business logic
    await orderService.complete(orderId);

    // ✅ Hook handles UI navigation
    navigate('/success');
  };

  return { handleComplete };
}

// ========== Service Layer (Pure Business Logic) ==========
class OrderService {
  async complete(orderId: OrderId) {
    // ✅ Pure business logic (no navigation, no alerts)
    const order = await orderDb.get(orderId);
    await paymentAdapter.finalize(order.paymentId);
    await orderDb.update(orderId, { status: 'completed' });
    this.store.setState({ completedOrders: [...this.store.getState().completedOrders, order] });
  }
}

// ========== View Layer ==========
export function OrderView() {
  const { handleComplete } = useOrderComplete();

  return <button onClick={() => handleComplete(orderId)}>Complete Order</button>;
}
```

**Key Points**:
- Service stays pure (no React Router, no UI dependencies)
- Hook wraps Service action with UI-specific side effect (navigation)
- Service is testable without React

#### Example D: Animation (Pure UI Logic)

**Rule**: Animation is UI-only → Handle in Hook.

```typescript
// ========== Hook Bridge Layer (Animation) ==========
export function useMenuAnimation() {
  const [isOpen, setIsOpen] = useState(false);
  const controls = useAnimation(); // Framer Motion

  const toggle = () => {
    setIsOpen(!isOpen);
    // ✅ Pure UI logic: animation control
    controls.start({ opacity: isOpen ? 0 : 1 });
  };

  return { toggle, controls };
}

// ========== View Layer ==========
export function Menu() {
  const { toggle, controls } = useMenuAnimation();

  return (
    <motion.div animate={controls}>
      <button onClick={toggle}>Toggle Menu</button>
    </motion.div>
  );
}
```

**Key Points**:
- No Service involvement (pure UI concern)
- Hook manages animation state
- No business logic

### Logic Boundary Summary

| Logic Type | Location | Examples | Reason |
|------------|----------|----------|--------|
| **Business Rules** | Service | Discount calculation, permissions, API data validation | Core logic, testable without React |
| **Persistence** | Adapter | LocalStorage, Axios, Tauri IPC | IO boundary, Pillar B validation |
| **Composition** | Hook | Call authService → pass ID to orderService | Glue between Services, React-specific |
| **Format for UI** | Hook | Filter list, format date for display | UI-specific transformation |
| **UI Interaction** | Hook/Component | Modal, alert, debounce, animations | Pure UI, no business impact |

### Anti-Patterns

**❌ Anti-Pattern 1: Business Logic in Hook**

```typescript
// ❌ WRONG: Discount calculation in Hook
export function useOrderProcess() {
  const calculateDiscount = (total: number, userLevel: string) => {
    return userLevel === 'vip' ? total * 0.9 : total; // ❌ Business rule
  };
  // This belongs in Service!
}

// ✅ CORRECT: Business logic in Service
class OrderService {
  calculateDiscount(total: number, userLevel: string): number {
    return userLevel === 'vip' ? total * 0.9 : total;
  }
}
```

**❌ Anti-Pattern 2: Direct IO in Hook**

```typescript
// ❌ WRONG: Direct API call in Hook
export function useUserData() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(setUser); // ❌ IO in Hook
  }, []);

  return user;
}

// ✅ CORRECT: IO in Service, Hook subscribes
class UserService {
  async load() {
    const user = await userAdapter.fetch(); // ✅ IO in Adapter
    this.store.setState({ user }); // ✅ Update store
  }
}

export function useUserData() {
  return useStore(userService.store, s => s.user); // ✅ Subscribe only
}
```

### Real-World Example: Sync Module

**Module**: `app/src/02_modules/sync` (Issue #167)

The Sync module demonstrates complete Hook Bridge Layer implementation with all three identities:

| Identity | Hooks | Purpose |
|----------|-------|---------|
| **Connector** | `useIsOnline()`, `usePendingCount()`, `useLastSyncedAt()` | Subscribe to syncStore primitives |
| **Selector** | `useIsSyncing()`, `useHasError()` | Derive boolean state from status |
| **Orchestrator** | `useSyncActions()` | Coordinate manualSyncService, transactionPushService, pullTransactions |

**Example Implementation**:

```typescript
// Connector + Selector (primitives only)
export function usePendingCount(): number {
  return useStore(syncStore, (s) => s.pendingCount);
}

export function useIsSyncing(): boolean {
  return useStore(syncStore, (s) => s.status === 'syncing');
}

// Orchestrator (service coordination)
export function useSyncActions(): SyncActions {
  const triggerFullSync = useCallback(async (userId: UserId) => {
    await manualSyncService.sync(userId);
  }, []);

  const triggerPushSync = useCallback(async (userId: UserId) => {
    await transactionPushService.syncDirtyTransactions(userId, traceId);
  }, []);

  return { triggerFullSync, triggerPushSync, clearQueue };
}
```

**View Layer Usage**:

```typescript
export function SyncStatusIndicator() {
  const pendingCount = usePendingCount();  // Identity 1: Connector
  const isSyncing = useIsSyncing();        // Identity 2: Selector

  return (
    <div>
      {isSyncing && <span>⟳ Syncing...</span>}
      {!isSyncing && pendingCount > 0 && <span>{pendingCount} pending</span>}
    </div>
  );
}
```

**Benefits**:
- ✅ Complete 4.5-layer architecture (Views → Hook Bridge → Services → Adapters → Tauri/AWS)
- ✅ No object selectors (ADR-012 compliance)
- ✅ Pure JSX views (Pillar L)
- ✅ Service coordination in dedicated hooks
- ✅ Firewall boundaries between modules (Pillar I)

**Files**:
- Hooks: `app/src/02_modules/sync/hooks/useSyncState.ts`
- Views: `app/src/02_modules/sync/views/SyncStatusIndicator.tsx`
- Services: `app/src/02_modules/sync/services/`
- Adapters: `app/src/02_modules/sync/adapters/`

**See Also**:
- [ADR-020: Hook Bridge Layer](./ADR/020-hook-bridge-layer.md) - Full specification
- [LAYERS.md](./LAYERS.md) - Layer 1.5 documentation

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

- [LAYERS.md](./LAYERS.md) - Where code goes (Layer 1.5: Hook Bridge)
- [FLOWS.md](./FLOWS.md) - How data moves
- [README.md](./README.md) - Architecture index
- [ADR-020: Hook Bridge Layer](./ADR/020-hook-bridge-layer.md) - Hook's three identities
- [ADR-012: Zustand Selector Safety](./ADR/012-zustand-selector-safety.md) - Primitive selectors

---

*Last Updated: 2026-01-22 - Added Hook Bridge Patterns per ADR-020*
