---
issue: 165
branch: feature/165-settings-4layer-architecture
status: completed
created: 2026-01-22
completed: 2026-01-22
---

# Issue #165: Settings Module 4-Layer Architecture

## 目标

将 Settings module 重构为完整的 4 层架构：
- **Stores**: Vanilla Zustand store (状态容器)
- **Hooks**: React bridge layer (订阅 + 选择器)
- **Services**: 业务逻辑 + IO 操作
- **Adapters**: SQLite 数据访问

## 现状分析

```
settings/
├── adapters/     ✅ settingsDb.ts
├── hooks/        ⚠️ 只有 useSettingsInit.ts (缺 state hooks)
├── services/     ✅ settingsStateService.ts (但 store 嵌入)
├── views/        ⚠️ 直接使用 useStore(service.store)
└── stores/       ❌ 不存在
```

**问题**:
1. View 直接订阅整个 state 对象 → 违反原子选择器原则
2. View 直接调用 service.update() → 违反 Pillar L
3. Store 嵌入在 service 中 → 职责混淆

## 目标架构

```
settings/
├── stores/
│   └── settingsStore.ts      ← NEW: vanilla store
├── hooks/
│   ├── useSettingsInit.ts    ✅ 保留
│   └── useSettingsState.ts   ← NEW: hook bridge
├── services/
│   ├── settingsService.ts    ✅ 保留 (IO 操作)
│   └── settingsStateService.ts ← UPDATE: 使用外部 store
├── adapters/
│   └── settingsDb.ts         ✅ 保留
└── views/
    ├── SettingsView.tsx      ← UPDATE: 使用 hooks
    └── UserProfileView.tsx   ← UPDATE: 使用 hooks
```

## 实施步骤

### Step 1: 创建 Vanilla Store ✅
- [x] 创建 `stores/settingsStore.ts`
- [x] 定义 `SettingsState` 类型
- [x] 导出 `settingsStore` 和类型

### Step 2: 创建 Hook Bridge ✅
- [x] 创建 `hooks/useSettingsState.ts`
- [x] 实现原子选择器:
  - `useSettingsStatus()` → string
  - `useSettingsLanguage()` → string
  - `useSettingsTheme()` → string
  - `useSettingsError()` → string | null
- [x] 实现 actions wrapper

### Step 3: 更新 Views ✅
- [x] `SettingsView.tsx` 使用 hooks
- [x] `UserProfileView.tsx` - 不需要修改 (使用 auth module)
- [x] 移除直接的 service 调用

### Step 4: 更新 Service ✅
- [x] `settingsStateService` 使用外部 store
- [x] 保持 API 兼容

### Step 5: 更新导出 ✅
- [x] `stores/index.ts`
- [x] `hooks/index.ts`
- [x] 模块 `index.ts`

### Step 6: 测试 ✅
- [x] Vite 构建成功
- [x] 无 TypeScript 编译错误 (settings 模块)

## 参考

- ADR-001: Service Pattern
- ADR-012: Zustand Selector Safety
- Issue #89: Transaction Service Pattern (reference implementation)
- `.claude/rules/zustand-hooks.md`
