# Bootstrap Pattern - Unified Service Initialization

## 概述

在 React 应用启动之前，统一初始化所有 service 和 state。确保应用第一次渲染时所有数据都已准备好。

## 问题

### 之前的方案（分散初始化）
```typescript
// main.tsx
networkMonitor.initialize();
captureService.init();
// ...

// App.tsx - useEffect
useEffect(() => {
  authStateService.init();  // ← 在 React 渲染后初始化
}, []);
```

**问题**：
1. **闪烁**：应用第一次渲染时用户信息不完整，React 重新渲染时才填充 → 用户看到闪烁
2. **难以维护**：初始化逻辑分散在两个文件
3. **容易遗漏**：新增 service 容易忘记添加初始化
4. **依赖不清晰**：难以看出 service 之间的初始化依赖

## 解决方案

### 统一初始化文件：bootstrap.ts

```typescript
// app/src/00_kernel/bootstrap.ts
export async function bootstrapServices(): Promise<void> {
  // 第一阶段：同步初始化（无依赖的 service）
  networkMonitor.initialize();
  quotaService.init();
  captureService.init();  // 内部调用 uploadService.init()
  autoSyncService.init();
  transactionSyncService.init();
  manualSyncService.init();

  // 第二阶段：异步初始化（加载持久化数据）
  await authStateService.init();   // ← 重要：必须等待
  await settingsStateService.init(); // ← 重要：必须等待
}
```

### 在 main.tsx 中使用

```typescript
// app/src/main.tsx
import { bootstrapServices } from "./00_kernel/bootstrap";

bootstrapServices().then(() => {
  // 所有 service 初始化完毕后再渲染 React
  ReactDOM.createRoot(rootElement).render(<App />);
}).catch((error) => {
  // 初始化失败处理
  console.error("Failed to bootstrap app:", error);
});
```

### App.tsx 保持简洁

```typescript
// app/src/App.tsx
// 所有 service 都已初始化，不需要额外的 init() 调用
function AppContent() {
  const { userId, isLoading } = useAppContext();

  // 仅处理 userId 变化时的业务逻辑
  useEffect(() => {
    transactionSyncService.setUser(userId);
    autoSyncService.setUser(userId);
  }, [userId]);

  // ... 其他逻辑
}
```

## 初始化顺序

### 为什么这个顺序很重要

```
1. networkMonitor       ← 必须第一个，autoSyncService 会依赖它
2. quotaService        ← 无依赖
3. captureService      ← 内部调用 uploadService.init()
4. autoSyncService     ← 依赖 networkMonitor ✓
5. transactionSyncService ← 无依赖
6. manualSyncService   ← 无依赖
7. authStateService    ← async，加载用户 session
8. settingsStateService ← async，加载应用设置
```

### 依赖关系图

```
networkMonitor
    ↓
autoSyncService

quotaService
    ↓
captureService → uploadService

transactionSyncService
manualSyncService

authStateService
settingsStateService

transactionService (auto-init on import)
```

## 好处

| 方面 | 改进 |
|------|------|
| **用户体验** | ✅ 无闪烁 - 第一次渲染时所有状态都已准备 |
| **代码清晰度** | ✅ 所有初始化逻辑集中在一个地方 |
| **可维护性** | ✅ 添加新 service 时一眼看出应该放在哪儿 |
| **错误处理** | ✅ 统一的错误处理和错误报告 |
| **日志记录** | ✅ 完整的初始化过程日志 |

## 实现细节

### bootstrap.ts 结构

```typescript
export async function bootstrapServices(): Promise<void> {
  // 第一阶段：同步初始化
  // - 无依赖或依赖关系在此解决
  // - 快速执行

  // 第二阶段：异步初始化
  // - 加载本地存储数据（localStorage）
  // - 恢复持久化状态
  // - 必须 await

  // 错误处理
  // - 如果任何初始化失败，显示错误并阻止渲染
}
```

### main.tsx 中的错误处理

```typescript
bootstrapServices()
  .then(() => {
    // ✅ 所有 service 就绪
    ReactDOM.createRoot(rootElement).render(<App />);
  })
  .catch((error) => {
    // ❌ 初始化失败
    // 显示错误信息给用户
    rootElement.innerHTML = '<div>Failed to initialize app</div>';
  });
```

## 集成点

### Service 需要什么

Service 只需提供标准的 init() 方法：

```typescript
class MyService {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 初始化逻辑
  }
}
```

### bootstrap.ts 集成新 Service

只需在对应的阶段添加一行代码：

```typescript
// 同步阶段
myService.init();

// 或异步阶段
await myService.init();
```

## 监控和调试

### 日志输出

```
BOOTSTRAP_START { phase: 'services' }
BOOTSTRAP_INIT { service: 'networkMonitor' }
BOOTSTRAP_INIT { service: 'quotaService' }
...
BOOTSTRAP_COMPLETE { phase: 'services', servicesCount: 9 }
```

### 检查初始化状态

```typescript
import { getBootstrapStatus } from "./00_kernel/bootstrap";

const status = getBootstrapStatus();
console.log('All services ready:', status.allServicesReady);
```

## 与 ADR-001 的关系

- **ADR-001**: Service Pattern - 全局单例 service，在应用启动时注册监听器
- **Bootstrap Pattern**: ADR-001 的实现细节 - 如何统一管理多个 service 的初始化

## 参考

- 实现：`app/src/00_kernel/bootstrap.ts`
- 使用：`app/src/main.tsx`
- 依赖关系：详见 `BOOTSTRAP.md` 中的初始化顺序
