# ARCHITECTURE.md

> System architecture - How to organize

## Overview

**Architecture**: Local-First + Cloud-Sync
**Pattern**: AI_DEV_PROT v15 (Tauri + React + AWS CDK)
**Last Updated**: 2026-01-05

## Architecture Philosophy

### Core Principle

```
Service 指挥 (Orchestrate)
Tauri 执行 (Execute)
AWS 审计 (Validate)
React 展示 (Display)
```

### Four-Layer Model

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

### Layer Responsibilities

#### 1. React Layer: The View (展示者)

**Position**: Pure UI rendering layer.

| Aspect | Description |
|--------|-------------|
| Subscribe | Listen to Service state via Zustand `useStore()` |
| Trigger | Pass user intent (clicks, drags) to Service methods |
| Local State | Only UI-specific state (modal open, input value) |

**Boundaries**:
- ❌ No global listeners (`tauri::listen`)
- ❌ No direct AWS SDK calls
- ❌ No business logic orchestration
- ❌ No global business state (use Service store)

#### 2. Pure TS Services Layer: The Orchestrator (指挥者)

**Position**: Business logic hub, independent of UI lifecycle.

| Aspect | Description |
|--------|-------------|
| Orchestration | Decide "get URL → upload → update DB" flow |
| Global State | Own business state via Zustand vanilla store |
| Persistent Listeners | Register global events once at app startup |

**Boundaries**:
- ✅ Single exit point for all logic
- ✅ Own global business state (Zustand vanilla)
- ❌ No DOM operations or UI styles
- ❌ No React hooks (use plain TS classes/functions)

**Why This Solves #82**:
- Decoupled lifecycle: Even if user closes upload modal (React unmounts), `uploadService` continues running
- Single registration: Global listeners registered once at Service init, avoiding StrictMode double-registration bug
- Testable: Can unit test Service logic without starting any UI

#### 3. Adapters Layer: The Bridge (桥梁)

**Position**: External capability abstraction.

| Aspect | Description |
|--------|-------------|
| IPC Wrapper | Wrap `invoke("command")` as semantic TS functions |
| SDK Isolation | Encapsulate AWS SDK, hide complex API parameters |

**Boundaries**:
- ❌ No business logic, only "data translation" and "API calls"

#### 4. Tauri Layer: The Executor (执行者)

**Position**: Native capability execution center (Rust).

| Aspect | Description |
|--------|-------------|
| IO/Compute | Stream file read/write, SQLite transactions, image compression |

**Boundaries**:
- ❌ No decision-making (doesn't judge "should I delete?", only "execute delete")
- ❌ No UI state management

#### 5. AWS Layer: The Authority (权威者)

**Position**: Final security and data validation.

| Aspect | Description |
|--------|-------------|
| Auth & Persist | Validate tokens, store S3 objects |

**Boundaries**:
- ❌ Never trust client-side validation
- ❌ No temporary UI interaction states

### Layer Comparison

| Feature | React | Services | Adapters | Tauri | AWS |
|---------|-------|----------|----------|-------|-----|
| Position | UI Renderer | App Brain | Translator | Native Worker | Authority |
| Logic Type | None | Orchestration | None | IO/Compute | Validation |
| State Type | Local UI | Global Business | Stateless | N/A | Persistent |
| Lifecycle | Component | App Startup | Stateless | App Process | Cloud |
| Performance Focus | FPS | Flow Control | None | CPU/Memory | Latency/Cost |

### State Ownership (状态归属)

Logic and State are separate concerns with different homes:

#### Logic: All in Service Layer

| Logic Type | Examples | Home |
|------------|----------|------|
| Business Logic | "If file > 1GB, check disk space first" | Service |
| Flow Logic | "Login AWS → get token → init local DB" | Service |
| Async Logic | Timers, polling, Promise chains | Service |
| Event Listeners | Tauri native events (file drop, window focus) | Service |

#### State: Split by Lifecycle

| State Type | Home | Examples | Reason |
|------------|------|----------|--------|
| **Global Business State** | Zustand vanilla store | User info, task list, upload progress, network status | Truth center: must persist even if UI unmounts |
| **Local UI State** | React useState | Modal open, input text, selected tab index | Visual only: reset on component unmount is OK |
| **One-time Notifications** | EventBus | Show toast, trigger scroll, open modal once | Fire-and-forget: no need to persist |

#### Zustand vs EventBus Comparison

| 维度 | Zustand (Vanilla Store) | EventBus (Emitter) |
|------|------------------------|-------------------|
| 性质 | 持久真相 (Persistence) | 瞬时信号 (Transient) |
| 隐喻 | **存折**：随时查，余额都在 | **敲门声**：响过就没，错过就错过 |
| React 行为 | 自动同步 UI：状态变 → 组件重绘 | 触发一次性动作：弹 Toast、播音效 |
| 典型案例 | 任务列表、进度条、用户余额 | 上传完成通知、报错弹窗、滚动到底部 |

#### Zustand vs EventBus Decision Tree

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

#### Writer vs Observer Principle

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

**规则**:
- ✅ Service 是唯一能修改 Zustand 和发送 EventBus 的层
- ✅ React 只读取 Zustand，只监听 EventBus
- ❌ React 不能直接调用 `store.setState()`
- ❌ React 不能发送业务相关的 EventBus 事件

#### Anti-Pattern: 错误信息存入 Zustand

```typescript
// ❌ BAD: 把报错信息存入 Zustand
const syncStore = createStore(() => ({
  status: 'idle',
  errorMessage: null,  // ← 问题根源
}));

// React 组件
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

// React 组件
function ToastContainer() {
  useAppEvent('toast:error', (msg) => {
    showToast(msg);  // 弹一次就没了，不会重复
  });
}
```

#### Example: Delete File Flow (Zustand + EventBus 配合)

```
1. React: 用户点击删除按钮
   → fileService.delete(id)

2. Service: 执行删除
   → adapter.deleteFile(id)  // 调用 Tauri

3. Tauri: 物理删除文件
   → 返回成功

4. Service: 更新状态 + 发送通知
   → fileStore.setState({
       files: files.filter(f => f.id !== id)  // 移除该项
     })
   → eventBus.emit('toast:success', '删除成功')

5. React 响应:
   ├── FileList: 因 Zustand 变化自动减少一项（无需手动刷新）
   └── ToastContainer: 监听到事件，弹出提示（一次性）
```

**为什么这样设计**:
- 列表状态是"持久真相"：即使 Toast 组件没挂载，列表仍然正确
- Toast 是"瞬时信号"：弹过就没，不会重复触发

#### Service → React Communication Pattern

```typescript
// ========== Service Layer (Pure TS) ==========
// uploadService.ts - runs independently of React

import { createStore } from 'zustand/vanilla';

// Global state store (not a React hook)
export const uploadStore = createStore(() => ({
  tasks: [] as UploadTask[],
  progress: 0,
}));

class UploadService {
  start(file: string) {
    // 1. Logic: prepare work
    // 2. Update global state
    uploadStore.setState({ progress: 0 });
    // 3. Call Adapter → Tauri
  }
}

export const uploadService = new UploadService();

// ========== React Layer (View) ==========
// ProgressBar.tsx - subscribes to Service state

import { useStore } from 'zustand';
import { uploadStore } from './uploadService';

export function ProgressBar() {
  // Subscribe to Service layer state
  const progress = useStore(uploadStore, (s) => s.progress);

  return <div style={{ width: `${progress}%` }} />;
}
```

#### Why This Solves #82 Permanently

| Aspect | React Hook Pattern | Service Pattern |
|--------|-------------------|-----------------|
| Listener Lifecycle | useEffect (re-runs on mount) | Service.init() (once at app start) |
| State Persistence | Lost on unmount | Persists in store |
| Testability | Needs React testing library | Plain unit tests |
| StrictMode | Double registration bug | No issue |

### Example: S3 Large File Upload Flow

```
1. React (Trigger):
   User clicks UploadButton → call uploadService.startUpload(file)

2. Service (Decide):
   - Check local task queue (from Zustand store)
   - Get Presigned URL via awsAdapter
   - Call tauriAdapter to start native upload

3. Tauri (Execute):
   Rust spawns tokio thread for streaming upload
   → emit("upload_progress") every second

4. Service (Listen & Update State):
   Service listens to upload_progress (registered at init)
   → Calculate global progress
   → uploadStore.setState({ progress: 50 })  ← Zustand (持续状态)

5. React (Display):
   useStore(uploadStore) automatically re-renders
   → User sees progress bar moving

6. Service (Complete):
   Upload finished
   → uploadStore.setState({ status: 'success' })  ← Zustand (持续状态)
   → eventBus.emit('upload:complete', { id })     ← EventBus (一次性通知)
```

**Zustand vs EventBus 使用场景**:

| 场景 | 技术 | 原因 |
|------|------|------|
| 上传进度 (0-100%) | Zustand Store | 持续变化，React 需要随时读取当前值 |
| 上传完成通知 | EventBus | 一次性事件，触发 toast 或跳转 |
| 任务列表 | Zustand Store | 持续状态，多组件共享 |
| 显示错误弹窗 | EventBus | 一次性触发，阅后即焚 |

### Migration Note

> **Issue #82**: Current `useDragDrop.ts` has temporary workaround (ignore flag pattern).
> TODO: Refactor to Service pattern after MVP1 testing.

---

## System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Device                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Yorutsuke Desktop App                              │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐                                                   │  │
│  │  │  React (View)   │  UI Components only                               │  │
│  │  │  - Render UI    │  Subscribe to Zustand Store (state)               │  │
│  │  │  - User gestures│  Subscribe to EventBus (notifications)            │  │
│  │  └────────┬────────┘                                                   │  │
│  │           │ call                                                       │  │
│  │           ▼                                                            │  │
│  │  ┌─────────────────┐                                                   │  │
│  │  │  Services       │  Business orchestration                           │  │
│  │  │  - captureService│ Init at app startup                              │  │
│  │  │  - uploadService │ Listen to Tauri events                           │  │
│  │  └────────┬────────┘                                                   │  │
│  │           │ call                                                       │  │
│  │           ▼                                                            │  │
│  │  ┌─────────────────┐                                                   │  │
│  │  │  Adapters       │  External capability abstraction                  │  │
│  │  │  - tauriAdapter │  IPC wrapper                                      │  │
│  │  │  - awsAdapter   │  AWS API wrapper                                  │  │
│  │  └────────┬────────┘                                                   │  │
│  │           │                                                            │  │
│  │           ├──────────────────────────────┐                             │  │
│  │           ▼                              │                             │  │
│  │  ┌─────────────────┐                     │                             │  │
│  │  │  Tauri (Rust)   │                     │                             │  │
│  │  │  - Compression  │                     │ HTTPS                       │  │
│  │  │  - File I/O     │                     │                             │  │
│  │  │  - SQLite       │                     │                             │  │
│  │  └─────────────────┘                     │                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Cognito   │  │   Lambda    │  │     S3      │  │     DynamoDB        │ │
│  │   (Auth)    │  │  (Presign)  │  │  (Images)   │  │   (Transactions)    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                          │                  ▲                ▲              │
│                          │ 02:00 JST        │                │              │
│                          ▼                  │ Presigned PUT  │              │
│                   ┌─────────────┐           │ (from Tauri)   │              │
│                   │   Lambda    │───────────┴────────────────┘              │
│                   │   (Batch)   │                                            │
│                   │  + Bedrock  │                                            │
│                   │  Nova Lite  │                                            │
│                   └─────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Communication Rules

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

**React 订阅方式**:
```typescript
// 订阅持续状态 (Zustand)
const progress = useStore(uploadStore, s => s.progress);

// 订阅一次性通知 (EventBus)
useAppEvent('upload:complete', ({ id }) => showToast('Done!'));
```

## Layer Structure

### Frontend Layers (app/src/)

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
│   │   ├── stores/     # Zustand vanilla stores [TARGET]
│   │   ├── services/   # captureService.ts (Orchestrator) [TARGET]
│   │   ├── adapters/   # IPC + S3 API (Bridge)
│   │   ├── headless/   # React hooks [CURRENT → migrate to services/]
│   │   └── views/      # Pure UI components
│   ├── report/         # T1: Morning report display
│   │   ├── stores/     # reportStore.ts [TARGET]
│   │   ├── services/   # reportService.ts [TARGET]
│   │   ├── adapters/   # Report API
│   │   └── views/      # ReportView
│   └── transaction/    # T2: Transaction management
│       ├── stores/     # transactionStore.ts [TARGET]
│       ├── services/   # transactionService.ts [TARGET]
│       ├── adapters/   # SQLite DB
│       ├── headless/   # React hooks [CURRENT]
│       └── views/      # TransactionView
│
└── 03_migrations/      # Data version upcasters
```

> **Migration Note**:
> - `headless/` currently contains React hooks that orchestrate business logic
> - After MVP1, migrate to `services/` + `stores/` pattern
> - `services/`: Pure TS classes for orchestration
> - `stores/`: Zustand vanilla stores for global state
> - `headless/`: React hooks that only subscribe to stores

### Infrastructure Layer (infra/)

```
infra/
├── lib/
│   └── yorutsuke-stack.ts    # Main CDK stack
├── lambda/
│   ├── presign/              # S3 presigned URL generation
│   ├── batch/                # Nightly batch trigger
│   └── batch-process/        # Nova Lite OCR processing
└── bin/
    └── infra.ts              # CDK entry point
```

## Data Flow

### 1. Receipt Capture Flow (Target Architecture)

```
React: User drops image
      │
      │ call captureService.handleDrop(file)
      ▼
┌─────────────────┐
│ Service:        │  Orchestration
│ - Generate IDs  │  imageId, traceId, intentId
│ - Check quota   │  from Zustand store
│ - Update store  │  captureStore.setState()
└─────────────────┘
      │
      │ call tauriAdapter.compress()
      ▼
┌─────────────────┐
│ Tauri: Compress │  WebP, < 100KB
│ + Calculate MD5 │
└─────────────────┘
      │
      │ return result to Service
      ▼
┌─────────────────┐
│ Service:        │
│ - Check MD5 dup │  via sqliteAdapter
│ - Save to DB    │  status = 'compressed'
│ - Update store  │  captureStore.setState()
└─────────────────┘
      │
      │ call awsAdapter.getPresignedUrl()
      ▼
┌─────────────────┐
│ Lambda: Presign │  Get S3 upload URL
└─────────────────┘
      │
      │ call tauriAdapter.streamUpload()
      ▼
┌─────────────────┐
│ Tauri → S3      │  Streaming PUT
│ emit progress   │
└─────────────────┘
      │
      │ Service listens, updates store
      ▼
┌─────────────────┐
│ Service:        │
│ - Update store  │  status = 'uploaded'
│ - Emit event    │  'upload:complete'
└─────────────────┘
      │
      │ React subscribes to store
      ▼
┌─────────────────┐
│ React: Display  │  Progress bar, status
└─────────────────┘
```

### 2. Nightly Batch Flow (02:00 JST)

```
EventBridge trigger
      │
      ▼
┌─────────────────┐
│ Lambda: Batch   │
│ - Check limits  │  ¥1,000/day, 50/user
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Scan S3 bucket  │  Today's uploads
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Bedrock: OCR    │  Nova Lite Vision
│ ~¥0.015/image   │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ DynamoDB: Write │  transactions table
└─────────────────┘
```

> Note: Batch flow runs entirely in AWS, no client Service layer involved.

### 3. Morning Report Flow (Target Architecture)

```
React: App launch / Navigate to Report
      │
      │ call reportService.loadReport(date)
      ▼
┌─────────────────┐
│ Service:        │  Orchestration
│ - Check cache   │  from Zustand store
└─────────────────┘
      │ cache miss
      │ call sqliteAdapter.getCache()
      ▼
┌─────────────────┐
│ SQLite: Check   │  transactions_cache
└─────────────────┘
      │ DB miss
      │ call awsAdapter.fetchReport()
      ▼
┌─────────────────┐
│ Lambda → Dynamo │  Fetch transactions
└─────────────────┘
      │
      │ return to Service
      ▼
┌─────────────────┐
│ Service:        │
│ - Cache in DB   │  via sqliteAdapter
│ - Update store  │  reportStore.setState()
└─────────────────┘
      │
      │ React subscribes to store
      ▼
┌─────────────────┐
│ React: Render   │  ReportView
└─────────────────┘
```

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop Framework | Tauri 2 | < 5MB app size, Rust performance |
| Frontend | React 19 | Familiar, good ecosystem |
| Local DB | SQLite | Offline-first, simple |
| Cloud Storage | S3 | Cost-effective, lifecycle rules |
| Cloud DB | DynamoDB | Serverless, pay-per-request |
| Auth | Cognito | Managed, secure |
| AI | Bedrock Nova Lite | Cheap (~¥0.015/image), good OCR |
| IaC | AWS CDK | TypeScript, type-safe |

## Module Tiers

| Module | Tier | Current Pattern | Target Pattern | Complexity |
|--------|------|-----------------|----------------|------------|
| capture | T2 | View → Headless → Adapter | View → Service → Adapter | Queue management, FSM |
| report | T1 | View → Adapter | View → Service → Adapter | Simple fetch/render |
| transaction | T2 | View → Headless → Adapter | View → Service → Adapter | CRUD, confirmation flow |
| batch | T3 | Saga | Saga (in Service) | Compensation, idempotency |

> **Target Pattern**: `View` triggers `Service`, `Service` orchestrates via `Adapter`, `View` subscribes to EventBus.

## Security

- **Auth**: Cognito JWT tokens
- **Data at rest**: S3 + DynamoDB encryption
- **Data in transit**: HTTPS only
- **CSP**: Strict content security policy
- **IAM**: Least privilege Lambda roles

## Cost Control

| Control | Limit | Enforcement |
|---------|-------|-------------|
| Global daily | ¥1,000 | Lambda hard stop |
| Per-user daily | 50 images | Quota check in presign |
| Rate limit | 1 image/10s | Frontend throttle |
| S3 lifecycle | 30 days | Auto-delete old images |

## Control Strategy

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Control Flow (Target)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Action (React)                                        │
│       │                                                     │
│       │ call service method                                 │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │  Service    │  ← Business orchestration                  │
│  │             │     - Decide what to do                    │
│  │             │     - Coordinate adapters                  │
│  └─────────────┘     - Manage FSM state                     │
│       │                                                     │
│       │ call adapter                                        │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │  Adapter    │  ← Boundary validation (Pillar B)          │
│  └─────────────┘                                            │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │  Storage    │  ← SQLite (local) / S3+DynamoDB (cloud)    │
│  └─────────────┘                                            │
│       │                                                     │
│       │ emit result                                         │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │  EventBus   │  ← Cross-component notification            │
│  └─────────────┘                                            │
│       │                                                     │
│       │ subscribe                                           │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │  React Hook │  ← Update UI state                         │
│  └─────────────┘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Current vs Target

| Aspect | Current (Headless) | Target (Service) |
|--------|-------------------|------------------|
| Orchestration | React hooks | Pure TS Service |
| Event Listeners | useEffect | Service.init() |
| State Management | useReducer | Service internal or Zustand |
| Lifecycle | Component mount/unmount | App startup/shutdown |

### State Management Pattern

**Principle**: Single source of truth via FSM reducer

```typescript
// FSM State - no boolean flag pairs
type QueueState =
  | { status: 'idle'; tasks: Task[] }
  | { status: 'processing'; tasks: Task[]; currentId: ImageId }
  | { status: 'paused'; tasks: Task[]; reason: 'offline' | 'quota' };

// Current: Reducer in React hook (useReducer)
// Target: Reducer in Service, exposed via Zustand or EventBus
function reducer(state: QueueState, action: Action): QueueState {
  switch (action.type) {
    case 'START_UPLOAD':
      return { status: 'processing', tasks: [...], currentId: action.id };
    // ...
  }
}
```

**Rules**:
- FSM state transitions only via dispatch/action
- No external refs for tracking (avoid dual source of truth)
- Impossible states should be unrepresentable

**Current vs Target**:
| Aspect | Current | Target |
|--------|---------|--------|
| State Location | React hook (useReducer) | Service class or Zustand store |
| Access | Hook return value | EventBus subscription or store selector |
| Mutations | dispatch() in hook | service.doAction() method |

### Concurrency Control

#### 1. Database Transactions

SQLite operations should use explicit transactions for atomicity:

```typescript
// Recommended pattern
export async function withTransaction<T>(
  fn: (db: Database) => Promise<T>
): Promise<T> {
  const database = await getDb();
  await database.execute('BEGIN TRANSACTION');
  try {
    const result = await fn(database);
    await database.execute('COMMIT');
    return result;
  } catch (e) {
    await database.execute('ROLLBACK');
    throw e;
  }
}
```

#### 2. Upload Queue Processing

Sequential processing with FSM guards:

```typescript
// Current: In React hook
// Only process when idle
if (state.status !== 'idle') return;
dispatch({ type: 'START_UPLOAD', id: task.id });
try {
  await uploadToS3(...);
  dispatch({ type: 'UPLOAD_SUCCESS', id: task.id });
} catch (e) {
  dispatch({ type: 'UPLOAD_FAILURE', id: task.id, error: e });
}

// Target: In Service class
class UploadService {
  async processNext() {
    if (this.state.status !== 'idle') return;
    this.dispatch({ type: 'START_UPLOAD', id: task.id });
    try {
      await this.adapter.uploadToS3(...);
      this.dispatch({ type: 'UPLOAD_SUCCESS', id: task.id });
      this.eventBus.emit('upload:success', { id: task.id });
    } catch (e) {
      this.dispatch({ type: 'UPLOAD_FAILURE', id: task.id, error: e });
      this.eventBus.emit('upload:failure', { id: task.id, error: e });
    }
  }
}
```

#### 3. Quota Enforcement

Multi-layer defense with single authoritative checkpoint:

| Layer | Location (Current) | Location (Target) | Type | Purpose |
|-------|-------------------|-------------------|------|---------|
| Client | `useCaptureLogic.ts` | `captureService.ts` | Soft/UX | Fast feedback |
| Client | `useUploadQueue.ts` | `uploadService.ts` | Soft/UX | Prevent wasted API calls |
| **Cloud** | `presign/index.mjs` | (same) | **HARD** | Authoritative enforcement |
| Cloud | `quota/index.mjs` | (same) | Info | Query API for frontend sync |

**Design Rationale**:
- Client checks may be stale (wrong day, cached count) - acceptable for UX hints
- Lambda presign is the single authoritative checkpoint (increments quota atomically)
- Quota Lambda allows client to refresh local understanding on demand

**Note**: Moving quota check from React hooks to Service layer doesn't change the fundamental design - Lambda remains authoritative.

### Event Bus

Type-safe cross-component communication:

```typescript
// Emit event (fire-and-forget)
emit('upload:complete', { id, s3Key });

// Subscribe to event
const unsubscribe = on('upload:complete', (data) => {
  // Handle event
});
```

**Event Types**:

| Event | Trigger | Listeners |
|-------|---------|-----------|
| `upload:complete` | S3 upload success | Transaction sync |
| `upload:failed` | S3 upload failure | Error UI |
| `network:changed` | Connectivity change | Queue pause/resume |

### Known Issues & Improvements

#### Resolved Issues

| Issue | Location | Resolution | Date |
|-------|----------|------------|------|
| processingRef + state dual tracking | `useUploadQueue.ts` | Added 'retrying' FSM state, removed processingRef | 2026-01-02 |
| No explicit DB transactions | `db.ts` | Added `withTransaction()` wrapper | 2026-01-02 |
| Stale closure in quota check | `useUploadQueue.ts` | Documented as acceptable (Lambda is authoritative) | 2026-01-02 |
| emitSync misleading name | `eventBus.ts` | Renamed to `broadcast` | 2026-01-02 |
| StrictMode double listener (#82) | `useDragDrop.ts` | Temporary fix: ignore flag pattern | 2026-01-05 |

#### Improvement Roadmap

**P1 - Data Integrity**: ✅ Complete
- [x] Add `withTransaction()` wrapper to db.ts (#24)
- [x] Remove `processingRef`, use FSM `currentId` instead (#25)

**P2 - Reliability**: ✅ Complete
- [x] Document quota checkpoint strategy (#27)
- [x] Rename `emitSync` to `broadcast` (#26)

**P3 - Robustness**: ✅ Complete
- [x] Add Intent-ID for idempotency (Pillar Q) (#28) - 2026-01-02
- [x] ~~Add request-response pattern to EventBus~~ (#29) - Closed: over-engineering

**P4 - Architecture Refactor**: 🔄 Pending (Post-MVP1)
- [ ] Refactor `useDragDrop.ts` to Service pattern (#82)
- [ ] Create `captureService.ts` to replace `useCaptureLogic.ts`
- [ ] Create `uploadService.ts` to replace `useUploadQueue.ts`
- [ ] Move Tauri event listeners to Service init
- [ ] React hooks only subscribe to EventBus

## ID Management Strategy

### ID Types Overview

| ID Type | Purpose | Format | Created | Scope |
|---------|---------|--------|---------|-------|
| `imageId` | Unique image identifier | `{uuid}` | On drop | Single image |
| `traceId` | Observability & logging | `trace-{uuid}` | On drop | Receipt lifecycle |
| `intentId` | Idempotency (retry-safe) | `intent-{uuid}` | On drop | Upload operation |
| `md5` | Content deduplication | `{32-char-hash}` | After compress | Image content |

### Three Scenarios

| Scenario | What Happens | Which ID? |
|----------|--------------|-----------|
| **Content Dedup** | Same image dropped twice | **MD5 hash** |
| **Network Retry** | Same upload retried | **intentId** |
| **Log Tracing** | Track operation flow | **traceId** |

### Duplicate Detection Flow

```
First drop (receipt.jpg):
  imageId-1, traceId-1, intentId-1
  → Compress → MD5: abc123
  → DB check: not found
  → Save to DB → Upload ✓

Second drop (same receipt.jpg):
  imageId-2, traceId-2, intentId-2  ← All new IDs
  → Compress → MD5: abc123
  → DB check: found! (imageId-1)
  → emit image:duplicate {
      id: imageId-2,
      traceId: traceId-2,      ← Still logs this attempt
      duplicateWith: imageId-1  ← Points to existing
    }
  → Skip upload, remove from queue
```

### Key Design Decisions

**1. MD5 for Deduplication (not imageId)**
- Content-based: same image = same hash regardless of when dropped
- Calculated AFTER compression (WebP bytes) for consistency
- Stored in SQLite with index for fast lookup

**2. traceId Continues on Duplicate**
- Even skipped images get logged with their traceId
- Enables debugging: "why was this image skipped?"
- Format: `trace-{uuid}` for easy grep in logs

**3. intentId for Backend Idempotency**
- Passed to Lambda presign for server-side dedup
- Same intentId on retry = same operation (no double upload)
- Format: `intent-{uuid}` to distinguish from traceId

**4. All IDs Generated at Drop Time**
- Current: IDs created in tauriDragDrop.ts (adapter) + CaptureView.tsx (React)
- Target: IDs created in captureService.ts (Service layer)
- No ID generation during async operations
- Prevents race conditions

### Pillar Alignment

| ID | Pillar | Purpose |
|----|--------|---------|
| `traceId` | N (Context) | Log correlation, distributed tracing |
| `intentId` | Q (Idempotency) | Prevent duplicate operations on retry |
| `imageId` | A (Nominal) | Type-safe entity identifier |

## References

- Schema: `./SCHEMA.md`
- Interfaces: `./INTERFACES.md`
- AI_DEV_PROT: `../../.prot/CHEATSHEET.md`
- Test Scenarios: `../tests/`
