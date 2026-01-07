# Four-Layer Architecture

> System structure and layer responsibilities

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  React Components (View)                                    │
│  - UI 渲染、用户手势响应                                      │
│  - 订阅 Zustand Store 获取持续状态                            │
│  - 订阅 EventBus 接收一次性通知                               │
└─────────────────────────────────────────────────────────────┘
                              │ 调用
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Pure TS Services (Orchestrator)                            │
│  - 业务流程编排                                              │
│  - 全局事件监听 (Tauri drag-drop, 网络状态)                   │
│  - App 启动时初始化，独立于 React 生命周期                     │
└─────────────────────────────────────────────────────────────┘
                              │ 调用
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Adapters (Bridge)                                          │
│  - Tauri IPC 封装                                           │
│  - AWS API 封装                                             │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│  Tauri (Executor)       │     │  AWS (Authority)            │
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

| Feature | React | Services | Adapters | Tauri | AWS |
|---------|-------|----------|----------|-------|-----|
| Position | UI Renderer | App Brain | Translator | Native Worker | Authority |
| Logic Type | None | Orchestration | None | IO/Compute | Validation |
| State Type | Local UI | Global Business | Stateless | N/A | Persistent |
| Lifecycle | Component | App Startup | Stateless | App Process | Cloud |
| Performance Focus | FPS | Flow Control | None | CPU/Memory | Latency/Cost |

---

## Communication Rules

| From | To | Allowed? | Mechanism |
|------|----|----------|-----------|
| React | Service | ✅ | Direct method call: `captureService.handleDrop()` |
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
│   │   ├── stores/     # Zustand vanilla stores
│   │   ├── services/   # captureService.ts (Orchestrator)
│   │   ├── adapters/   # IPC + S3 API (Bridge)
│   │   ├── hooks/      # React hooks (subscribe to stores)
│   │   └── views/      # Pure UI components
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

---

*Extracted from ARCHITECTURE.md per #94*
