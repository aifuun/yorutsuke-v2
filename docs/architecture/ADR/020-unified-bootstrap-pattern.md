# ADR-020: Unified Bootstrap Pattern for Service Initialization

**Status**: ACCEPTED
**Date**: 2026-01-22
**Author**: Claude Haiku 4.5
**Related**: ADR-001 (Service Pattern), Issue #89 (Service Pattern Migration)

## 问题陈述

当前应用的服务初始化分散在多个文件中（main.tsx 和 App.tsx），导致以下问题：

1. **UI 闪烁**：authStateService 在 React 渲染后才初始化，导致第一次渲染时用户信息不完整
2. **维护困难**：初始化逻辑分散，难以看出完整的初始化流程
3. **依赖管理混乱**：service 之间的初始化依赖关系不清晰
4. **容易遗漏**：新增 service 时容易忘记添加初始化代码

## 上下文

### Issue #89 背景
Issue #89 的 Service Pattern 重构要求将所有 service 转为 singleton 模式。在这个过程中发现：

- autoSyncService 初始化时调用 networkMonitor.subscribe()
- captureService 初始化时调用 uploadService.init()
- 初始化顺序不当会导致运行时错误

### 前次修复
在 commit 826d7d6 中修复了 main.tsx 的初始化顺序，但问题仍未完全解决：
- App.tsx 中仍有冗余的异步初始化
- authStateService 和 settingsStateService 在 React 渲染后初始化

## 决策

**采用统一的 Bootstrap Pattern**，在一个集中的文件中管理所有 service 的初始化。

### 关键特点

1. **统一初始化文件**：`app/src/00_kernel/bootstrap.ts`
   - 集中所有 service 的初始化逻辑
   - 清晰的初始化顺序注释
   - 完整的错误处理

2. **两阶段初始化**
   - **Phase 1**: 同步初始化（networkMonitor, quotaService, captureService, etc.）
   - **Phase 2**: 异步初始化（authStateService, settingsStateService）
   - 阶段 2 完成后才渲染 React

3. **在 main.tsx 中使用**
   ```typescript
   bootstrapServices().then(() => {
     ReactDOM.createRoot(rootElement).render(<App />);
   });
   ```

4. **App.tsx 保持简洁**
   - 移除所有初始化代码
   - 仅保留业务逻辑 useEffect

## 替代方案

### 方案 A：继续分散初始化（当前状态）
- ❌ 保留 UI 闪烁问题
- ❌ 维护困难
- ❌ 容易遗漏 service

### 方案 B：在 App.tsx 中初始化（前次尝试）
- ⚠️ 部分解决闪烁问题（仍在 React 渲染后）
- ⚠️ 混合了 UI 逻辑和初始化逻辑

### 方案 C：统一 Bootstrap 文件（选择方案）
- ✅ 完全消除闪烁
- ✅ 初始化逻辑完全分离
- ✅ 易于维护和扩展

## 实现

### 文件结构
```
app/src/00_kernel/
├── bootstrap.ts          ← 新增：统一初始化
├── main.tsx              ← 修改：使用 bootstrap
└── App.tsx               ← 修改：移除初始化代码
```

### 关键改动

#### 1. 创建 bootstrap.ts
```typescript
export async function bootstrapServices(): Promise<void> {
  // Phase 1: 同步初始化
  networkMonitor.initialize();
  quotaService.init();
  captureService.init();      // 内部调用 uploadService
  autoSyncService.init();
  transactionSyncService.init();
  manualSyncService.init();

  // Phase 2: 异步初始化
  await authStateService.init();
  await settingsStateService.init();
}
```

#### 2. 修改 main.tsx
```typescript
bootstrapServices()
  .then(() => {
    ReactDOM.createRoot(rootElement).render(<App />);
  })
  .catch(error => {
    // 错误处理
  });
```

#### 3. 清理 App.tsx
```typescript
// 移除 useEffect(() => { init(), init(), init() })
// 仅保留业务逻辑 useEffect
```

## 影响

### 正面影响
- ✅ 消除 UI 闪烁（更好的用户体验）
- ✅ 初始化逻辑集中管理（易维护）
- ✅ 清晰的依赖顺序（易扩展）
- ✅ 完整的错误处理（更健壮）
- ✅ 更好的日志记录（易调试）

### 对性能的影响
- 🟢 **无负面影响**：bootstrap 依然在 React 渲染前执行
- 🟢 **时序改进**：async 初始化不会中断 React 首次渲染

### 对测试的影响
- 🟢 **测试清晰**：mock bootstrap 更容易
- 🟢 **单元测试**：service 无需关心初始化顺序

## 验收标准

- [x] bootstrap.ts 已创建并包含所有 service
- [x] main.tsx 已修改为使用 bootstrap
- [x] App.tsx 已清理（移除冗余初始化）
- [x] 应用正常启动，无闪烁
- [x] 所有 service 正确初始化
- [x] 错误处理完整

## 文档

- 详细说明：`docs/architecture/BOOTSTRAP.md`
- 实现代码：`app/src/00_kernel/bootstrap.ts`

## 后续

### 推荐操作
1. **监控应用启动**：确保首次渲染时所有状态都已准备
2. **添加更多日志**：在 bootstrap 中添加性能指标
3. **考虑 Suspense**：将来可能使用 React 18 Suspense 进一步改进

### 相关 ADR
- ADR-001: Service Pattern
- ADR-019: Singleton Pattern for Services
