# Four-Layer Architecture (with Hook Bridge)

> System structure and layer responsibilities

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: React Components (View)                           │
│  - UI 渲染、用户手势响应                                      │
│  - 本地 UI 状态 (modal open, input value)                   │
└─────────────────────────────────────────────────────────────┘
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1.5: Hook Bridge (React ↔ Service Bridge)           │
│  - 订阅 Service stores (Connector)                          │
│  - 提取原始值 (Selector)                                     │
│  - 协调多个 Services (Orchestrator)                          │
└─────────────────────────────────────────────────────────────┘
                              │ calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Pure TS Services (Orchestrator)                   │
│  - 业务流程编排                                              │
│  - 拥有 Vanilla Zustand stores                              │
│  - 全局事件监听 (Tauri drag-drop, 网络状态)                   │
│  - App 启动时初始化，独立于 React 生命周期                     │
└─────────────────────────────────────────────────────────────┘
                              │ calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Adapters (Bridge)                                 │
│  - Tauri IPC 封装                                           │
│  - AWS API 封装                                             │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│  Layer 4a: Tauri        │     │  Layer 4b: AWS              │
│  - 系统能力执行          │     │  - 认证授权                  │
│  - 高性能计算            │     │  - 数据持久化                │
└─────────────────────────┘     └─────────────────────────────┘
```

---

## Layer 1: React (View)

**Position**: Pure UI rendering layer.

| Aspect | Description |
|--------|-------------|
| Subscribe | Listen to Service state via Zustand `useStore()` |
| Trigger | Pass user intent (clicks, drags) to Service methods |
| Local State | Only UI-specific state (modal open, input value) |

### Boundaries

- ❌ No global listeners (`tauri::listen`)
- ❌ No direct AWS SDK calls
- ❌ No business logic orchestration
- ❌ No global business state (use Service store)

### Example

```typescript
// ✅ GOOD: Subscribe to Service state
function ProgressBar() {
  const progress = useStore(uploadStore, (s) => s.progress);
  return <div style={{ width: `${progress}%` }} />;
}

// ❌ BAD: Direct API call in component
function UploadButton() {
  const handleClick = async () => {
    await fetch('/api/upload'); // Should go through Service
  };
}
```

---

## Layer 1.5: Hook Bridge (React ↔ Service Bridge)

**Position**: React-specific bridge to framework-agnostic Services.

**Purpose**: Hook Bridge Layer formalizes the connection between React's reactive system and Vanilla Zustand stores owned by Services. It serves three distinct roles (identities) to maintain clean separation between UI and business logic.

### Hook's Three Identities

| Identity | Description | Mechanism | Job |
|----------|-------------|-----------|-----|
| **Connector (连接器)** | Bridge Vanilla JS (Service) → React reactive system | `useStore()` or `useSyncExternalStore()` | Subscribe to Service state changes, notify React to re-render |
| **Selector (选择器)** | Extract specific data from Service state | Primitive return values (ADR-012) | Return only what component needs, avoid object selectors |
| **Orchestrator (编排器)** | Coordinate multiple Services or format data for UI | Composition logic only | Glue between Services, UI-specific transformation |

### Boundaries

| Logic Type | Location | Examples | Reason |
|------------|----------|----------|--------|
| **Business Rules** | Service | Discount calculation, permission checks, API data validation | Core business logic, testable without React |
| **Persistence** | Adapter | LocalStorage access, Axios requests, Tauri IPC | IO boundary, Pillar B validation |
| **Composition** | Hook | Call authService → get userId → pass to orderService | Glue between Services, React-specific |
| **Format for UI** | Hook | Filter list for display, format date for UI | UI-specific transformation, no business rules |
| **UI Interaction** | Hook/Component | Modal open/close, debounce, animations | Pure UI logic, no business impact |

### Identity 1: Connector Example

```typescript
// Hook as Connector
import { useStore } from 'zustand';
import { debugSettingsStore, debugSettingsSelectors } from '../stores';

export function useDebugEnabled(): boolean {
  return useStore(debugSettingsStore, debugSettingsSelectors.debugEnabled);
}
```

**Mechanism**: `useStore()` subscribes to Vanilla Zustand store, notifies React when state changes.

### Identity 2: Selector Example

```typescript
// ✅ Hook as Selector (returns primitive)
export function useTransactionCount(): number {
  return useStore(transactionStore, s => s.transactions.length);
}

// ❌ ANTI-PATTERN: Object selector causes infinite loops
export function useTransactionData() {
  return useStore(transactionStore, s => ({
    count: s.transactions.length,
    total: s.totalAmount
  })); // ❌ New object every render
}
```

**Mechanism**: Primitive return values (ADR-012 compliance) minimize re-renders.

### Identity 3: Orchestrator Example

```typescript
// Hook as Orchestrator (coordinates multiple Services)
export function useOrderProcess() {
  // Connect to multiple Services
  const user = useStore(authService.store, s => s.user);
  const orders = useStore(orderService.store, s => s.orders);

  // Composition logic: coordinate Services
  const handlePurchase = async (productId: string) => {
    if (!user) {
      alert('Please login'); // ✅ UI interaction
      return;
    }
    await orderService.create(user.id, productId); // ✅ Delegate to Service
  };

  // Format logic: UI-specific transformation
  const activeOrders = orders.filter(o => o.status === 'active');

  return { activeOrders, handlePurchase };
}
```

**Mechanism**: NOT business logic - only composition and UI-specific transformation.

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

**❌ Anti-Pattern 3: Object Selector**

```typescript
// ❌ WRONG: Object selector (infinite loop risk)
export function useOrderSummary() {
  return useStore(orderStore, s => ({
    total: s.total,
    count: s.items.length
  })); // ❌ New object every render
}

// ✅ CORRECT: Individual primitive selectors
export function useOrderTotal(): number {
  return useStore(orderStore, s => s.total);
}

export function useOrderCount(): number {
  return useStore(orderStore, s => s.items.length);
}
```

### Why Hook Layer Exists

| Aspect | Without Hook Layer | With Hook Layer |
|--------|-------------------|-----------------|
| Component complexity | High (direct store access) | Low (use hooks) |
| Service testability | Medium (may have React deps) | High (pure TS) |
| Code organization | Flat (logic scattered) | Layered (clear separation) |
| Reusability | Low (tied to React) | High (Service reusable) |

**See Also**: [ADR-020: Hook Bridge Layer](./ADR/020-hook-bridge-layer.md)

---

## Layer 2: Pure TS Services (Orchestrator)

**Position**: Business logic hub, independent of UI lifecycle.

| Aspect | Description |
|--------|-------------|
| Orchestration | Decide "get URL → upload → update DB" flow |
| Global State | Own business state via Zustand vanilla store |
| Persistent Listeners | Register global events once at app startup |

### Boundaries

- ✅ Single exit point for all logic
- ✅ Own global business state (Zustand vanilla)
- ❌ No DOM operations or UI styles
- ❌ No React hooks (use plain TS classes/functions)

### Why This Solves #82

| Aspect | React Hook Pattern | Service Pattern |
|--------|-------------------|-----------------|
| Listener Lifecycle | useEffect (re-runs on mount) | Service.init() (once at app start) |
| State Persistence | Lost on unmount | Persists in store |
| Testability | Needs React testing library | Plain unit tests |
| StrictMode | Double registration bug | No issue |

### Example

```typescript
// Service layer (Pure TS)
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
```

---

## Layer 3: Adapters (Bridge)

**Position**: External capability abstraction.

| Aspect | Description |
|--------|-------------|
| IPC Wrapper | Wrap `invoke("command")` as semantic TS functions |
| SDK Isolation | Encapsulate AWS SDK, hide complex API parameters |

### Boundaries

- ❌ No business logic, only "data translation" and "API calls"

### Example

```typescript
// adapters/imageIpc.ts
export async function compressImage(path: string): Promise<CompressResult> {
  return invoke('compress_image', { path });
}

// adapters/uploadApi.ts
export async function getPresignedUrl(userId: UserId): Promise<string> {
  const response = await fetch(`${API_URL}/presign?userId=${userId}`);
  return PresignSchema.parse(await response.json()).url;
}
```

---

## Layer 4a: Tauri (Executor)

**Position**: Native capability execution center (Rust).

| Aspect | Description |
|--------|-------------|
| IO/Compute | Stream file read/write, SQLite transactions, image compression |

### Boundaries

- ❌ No decision-making (doesn't judge "should I delete?", only "execute delete")
- ❌ No UI state management

---

## Layer 4b: AWS (Authority)

**Position**: Final security and data validation.

| Aspect | Description |
|--------|-------------|
| Auth & Persist | Validate tokens, store S3 objects |

### Boundaries

- ❌ Never trust client-side validation
- ❌ No temporary UI interaction states

---

## Layer Comparison

| Feature | React | Hook Bridge | Services | Adapters | Tauri | AWS |
|---------|-------|-------------|----------|----------|-------|-----|
| Position | UI Renderer | React Bridge | App Brain | Translator | Native Worker | Authority |
| Logic Type | None | Composition | Orchestration | None | IO/Compute | Validation |
| State Type | Local UI | Stateless | Global Business | Stateless | N/A | Persistent |
| Lifecycle | Component | Component | App Startup | Stateless | App Process | Cloud |
| Performance Focus | FPS | Re-render | Flow Control | None | CPU/Memory | Latency/Cost |
| Dependencies | Hook | Service Store | Adapter | Tauri/AWS | OS | Region |

---

## Communication Rules

| From | To | Allowed? | Mechanism |
|------|----|----------|-----------|
| React | Hook | ✅ | Import hook: `const data = useDebugEnabled()` |
| React | Service | ❌ | Must go through Hook layer |
| Hook | Service | ✅ | Subscribe via `useStore(service.store, selector)` |
| Hook | Service | ✅ | Call actions: `serviceActions.execute()` |
| Service | React | ✅ | Zustand store update: `store.setState()` (state) |
| Service | React | ✅ | EventBus emit: `emit('event')` (notification) |
| React | Adapter | ❌ | Must go through Service |
| React | AWS | ❌ | Must go through Service → Adapter |
| Service | Adapter | ✅ | Direct method call |
| Service | Tauri events | ✅ | Listen at init (not in useEffect) |
| Tauri | S3 | ✅ | Presigned URL PUT (streaming) |
| Tauri | AWS API | ❌ | No Cognito tokens in Rust |

---

## Frontend Directory Structure

```
app/src/
├── 00_kernel/          # Infrastructure (no business logic)
│   ├── types/          # Branded types (UserId, ImageId, etc.)
│   ├── eventBus/       # One-time event notifications
│   ├── storage/        # SQLite database access
│   ├── network/        # Network status detection
│   ├── context/        # React Context (Auth provider)
│   └── telemetry/      # Logging, error tracking
│
├── 01_domains/         # Pure business logic (no I/O, no UI)
│   ├── receipt/        # Receipt entity, status FSM, rules
│   └── transaction/    # Transaction entity, calculations
│
├── 02_modules/         # Feature modules
│   ├── capture/        # T2: Image capture & upload queue
│   │   ├── stores/     # Zustand vanilla stores (Layer 2)
│   │   ├── services/   # captureService.ts (Orchestrator - Layer 2)
│   │   ├── adapters/   # IPC + S3 API (Bridge - Layer 3)
│   │   ├── hooks/      # React bridge (Connector/Selector/Orchestrator - Layer 1.5)
│   │   └── views/      # Pure UI components (Layer 1)
│   ├── debug/          # T1: Debug & diagnostics
│   │   ├── stores/     # debugSettingsStore, diagnosticStore
│   │   ├── services/   # debugSettingsStateService, diagnosticService
│   │   ├── adapters/   # debugSettingsDb, diagnosticApi
│   │   ├── hooks/      # useDebugSettings, useDiagnosticState
│   │   └── views/      # DebugView, DiagnosticPanel
│   ├── settings/       # T1: App settings management
│   │   ├── stores/     # settingsStore
│   │   ├── services/   # settingsStateService
│   │   ├── adapters/   # settingsDb
│   │   ├── hooks/      # useSettingsState
│   │   └── views/      # SettingsView
│   ├── report/         # T1: Morning report display
│   └── transaction/    # T2: Transaction management
│
└── 03_migrations/      # Data version upcasters
```

---

## Related

- [README.md](./README.md) - Architecture index
- [PATTERNS.md](./PATTERNS.md) - State management patterns
- [FLOWS.md](./FLOWS.md) - Data flow diagrams
- [PROGRAM_PATHS.md](./PROGRAM_PATHS.md) - Full directory structure
- [ADR-020: Hook Bridge Layer](./ADR/020-hook-bridge-layer.md) - Formalization of Hook's three identities
- [ADR-012: Zustand Selector Safety](./ADR/012-zustand-selector-safety.md) - Primitive selector requirements

---

*Last Updated: 2026-01-22 - Added Layer 1.5 (Hook Bridge) per ADR-020*
