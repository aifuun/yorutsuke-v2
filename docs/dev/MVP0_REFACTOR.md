# MVP0 - 架构重构 (Service Pattern)

> **目标**: 将 capture 模块从 headless hooks 迁移到 Service 模式，解决 #82 StrictMode 问题

### 重构范围

| 当前文件 | 目标文件 | 说明 | 状态 |
|----------|----------|------|------|
| `useDragDrop.ts` | `captureService.ts` | Tauri 事件监听移到 Service.init() | [x] |
| `useCaptureLogic.ts` | `fileService.ts` | 压缩、去重、DB 操作 | [x] |
| `useUploadQueue.ts` | `uploadService.ts` | 上传队列、重试逻辑 | [x] |
| React `useReducer` | Zustand vanilla store | `captureStore.ts`, `uploadStore.ts` | [x] |
| `emit()` in hooks | `eventBus.emit()` in Service | 一次性通知 | [x] |

### 目录结构变化

```
app/src/02_modules/capture/
├── headless/                    # [删除] 迁移后删除
│   ├── useDragDrop.ts          → services/captureService.ts
│   ├── useCaptureLogic.ts      → services/fileService.ts
│   └── useUploadQueue.ts       → services/uploadService.ts
│
├── services/                    # [新增] 业务逻辑
│   ├── captureService.ts        # Tauri 监听 + 流程编排
│   ├── fileService.ts           # 压缩 + 去重 + DB
│   └── uploadService.ts         # 上传队列 + 重试
│
├── stores/                      # [新增] 状态管理
│   ├── captureStore.ts          # 拖放队列状态
│   └── uploadStore.ts           # 上传队列状态
│
├── hooks/                       # [新增] React 桥接
│   ├── useCaptureState.ts       # useStore(captureStore)
│   └── useUploadState.ts        # useStore(uploadStore)
│
├── adapters/                    # [保留] 无变化
│   ├── imageIpc.ts
│   ├── imageDb.ts
│   └── uploadApi.ts
│
└── views/                       # [保留] 调用方式变化
    └── CaptureView.tsx          # service.method() 替代 hook()
```

### 重构步骤

#### Phase 1: 创建 Stores

```typescript
// stores/captureStore.ts
import { createStore } from 'zustand/vanilla';

interface CaptureState {
  status: 'idle' | 'processing' | 'error';
  queue: QueuedImage[];
  currentId: ImageId | null;
}

export const captureStore = createStore<CaptureState>(() => ({
  status: 'idle',
  queue: [],
  currentId: null,
}));
```

- [x] 创建 `captureStore.ts`
- [x] 创建 `uploadStore.ts`
- [x] 定义状态类型（从 useReducer 提取）

#### Phase 2: 创建 Services

```typescript
// services/captureService.ts
class CaptureService {
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // 一次性注册，不受 React 生命周期影响
    listen('tauri://drag-drop', this.handleDrop.bind(this));
  }

  async handleDrop(event: TauriDropEvent) {
    // 业务逻辑...
    captureStore.setState({ ... });
    eventBus.emit('file:dropped', { ... });
  }
}

export const captureService = new CaptureService();
```

- [x] 创建 `captureService.ts` (Tauri 监听)
- [x] 创建 `fileService.ts` (压缩 + 去重)
- [x] 创建 `uploadService.ts` (上传队列)
- [x] 在 `main.tsx` 调用 `captureService.init()`

#### Phase 3: 创建 React Hooks

```typescript
// hooks/useCaptureState.ts
import { useStore } from 'zustand';
import { captureStore } from '../stores/captureStore';

export function useCaptureState() {
  return useStore(captureStore);
}

export function useCaptureActions() {
  return {
    handleDrop: captureService.handleDrop.bind(captureService),
    // ...
  };
}
```

- [x] 创建 `useCaptureState.ts`
- [x] 创建 `useUploadState.ts`
- [x] View 组件改用新 hooks

#### Phase 4: 迁移 View 组件

```typescript
// views/CaptureView.tsx
function CaptureView() {
  // 读取状态
  const { queue, status } = useCaptureState();

  // 触发动作（不再是 hook 返回的函数）
  const handleRetry = () => uploadService.retry(id);

  // 一次性事件
  useAppEvent('file:duplicate', ({ id }) => {
    toast.info('重复图片已跳过');
  });

  return <DropZone>...</DropZone>;
}
```

- [x] 更新 `CaptureView.tsx`
- [x] 更新 `UploadProgress.tsx` (暂无，队列显示在 CaptureView)
- [x] 移除旧 headless hooks 引用

#### Phase 5: 清理

- [x] 删除 `headless/` 目录 (保留 useQuota.ts)
- [x] 更新 barrel exports (`index.ts`)
- [x] 运行 TypeScript 检查
- [x] 关闭 #82

### 验收标准

| 检查项 | 验证方法 | 状态 |
|--------|----------|------|
| StrictMode 无双重注册 | Dev 模式下拖放一次只触发一次 | [x] |
| 状态持久化 | 关闭 Modal 再打开，队列状态保留 | [x] |
| 事件监听一次性 | App 启动只注册一次 Tauri 监听 | [x] |
| TypeScript 编译通过 | `npm run build` | [x] |
| 现有功能不变 | 拖放→压缩→显示缩略图 | [x] |

### 不包含

- ❌ 新功能开发
- ❌ 新测试场景（复用 MVP1 场景验证）
- ❌ report/transaction 模块重构（在各自 MVP 阶段进行）

### 环境配置

```bash
# 开发模式（StrictMode 开启）
cd app
npm run tauri dev

# 验证 StrictMode 问题已解决
# 1. 拖放图片
# 2. 检查控制台无重复日志
# 3. 检查队列只有一个条目
```

### 依赖

- 无后端依赖
- 无新 npm 包（zustand 已安装）

### 参考

- [architecture/README.md](../architecture/README.md) - 四层模型、状态归属
- [INTERFACES.md](../architecture/INTERFACES.md) - Service 接口定义
- [PROGRAM_PATHS.md](./PROGRAM_PATHS.md) - 当前代码流程（重构后需更新）
