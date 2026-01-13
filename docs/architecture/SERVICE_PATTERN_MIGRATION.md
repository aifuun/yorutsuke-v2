# Service Pattern Migration (Issue #141)

**Status**: ✅ Complete
**Date**: 2026-01-12
**Related**: ADR-001 Service Pattern

## Summary

Migrated all business logic from Headless pattern to Service pattern for better separation of concerns and framework independence.

## Architecture Change

### Before: Headless Pattern
```
View → useXxxLogic (React hook) → Adapter
       ↓
       useState/useReducer (local state)
```

**Problems**:
- Business logic tied to React lifecycle
- State management scattered across hooks
- Difficult to test without React
- Hooks couldn't be reused outside React

### After: Service Pattern
```
View → useStore(xxxService.store) (thin React bridge)
       ↓
       xxxService (Pure TypeScript class)
       ↓
       Zustand vanilla store (state)
       ↓
       Adapter
```

**Benefits**:
- Business logic independent of React
- Centralized state management (Zustand vanilla stores)
- Testable without React
- Services can be used anywhere (CLI, tests, other frameworks)
- Single source of truth per domain

## Migrated Modules

| Module | Before | After | LOC |
|--------|--------|-------|-----|
| **Sync** | `useSyncLogic.ts` (171 lines) | `manualSyncService.ts` (174 lines) + `useSyncTrigger.ts` (42 lines) | +45 |
| **Auth** | `useAuth.ts` (285 lines) | `authStateService.ts` (232 lines) + `useAuthInit.ts` (27 lines) | -26 |
| **Settings** | `useSettings.ts` (132 lines) | `settingsStateService.ts` (115 lines) + `useSettingsInit.ts` (27 lines) | +10 |
| **Dashboard** | `useChartData.ts` (kept as-is) | Renamed `headless/` → `hooks/` | 0 |

**Total**: 588 lines → 617 lines (+29 lines, +5% for better architecture)

## Service Pattern Rules

### 1. Service Structure

```typescript
import { createStore } from 'zustand/vanilla';

// FSM State (union type, not interface)
type MyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: MyData }
  | { status: 'error'; error: string };

class MyService {
  // Zustand vanilla store
  store = createStore<MyState>(() => ({ status: 'idle' }));

  // Initialize (load persisted state)
  async init(): Promise<void> {
    // Load from localStorage, etc.
  }

  // Business methods
  async doSomething(): Promise<void> {
    this.store.setState({ status: 'loading' });
    try {
      const result = await adapter.fetch();
      this.store.setState({ status: 'success', data: result });
    } catch (e) {
      this.store.setState({ status: 'error', error: String(e) });
    }
  }
}

export const myService = new MyService();
```

### 2. React Bridge (Thin Hook)

```typescript
import { useEffect, useRef } from 'react';
import { myService } from '../services/myService';

/**
 * Initializes myService on mount
 * Pure side-effect hook - returns nothing
 */
export function useMyServiceInit(): void {
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    myService.init();
  }, []);
}
```

### 3. View Usage

```typescript
import { useStore } from 'zustand';
import { myService } from '../services/myService';

function MyView() {
  // Subscribe to state (primitive selectors to avoid infinite loops)
  const status = useStore(myService.store, s => s.status);
  const data = useStore(myService.store, s => s.status === 'success' ? s.data : null);

  // Call service methods directly
  const handleAction = () => {
    myService.doSomething();
  };

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'error') return <div>Error</div>;
  if (!data) return <div>No data</div>;

  return <div>{data.name}</div>;
}
```

## Key Differences

| Aspect | Headless Pattern | Service Pattern |
|--------|------------------|-----------------|
| **State** | useState/useReducer | Zustand vanilla store |
| **Framework** | React-dependent | Framework-independent |
| **Testability** | Requires React Testing Library | Pure TypeScript tests |
| **Lifecycle** | useEffect hooks | Explicit init() method |
| **Reusability** | React components only | Anywhere (CLI, tests, etc.) |
| **State Access** | Via hook return value | Via store subscription |

## Testing Impact

### Before (Headless)
```typescript
// Required React Testing Library
import { renderHook, act } from '@testing-library/react';

test('sync logic', async () => {
  const { result } = renderHook(() => useSyncLogic(userId, true));
  await act(async () => {
    await result.current.sync();
  });
  expect(result.current.state.status).toBe('success');
});
```

### After (Service)
```typescript
// Pure TypeScript test
import { manualSyncService } from './manualSyncService';

test('sync service', async () => {
  await manualSyncService.sync(userId);
  const state = manualSyncService.store.getState();
  expect(state.status).toBe('success');
});
```

## Zustand Selector Safety

**CRITICAL**: Object selectors cause infinite loops. Always use primitive selectors or `useShallow`.

```typescript
// ❌ INFINITE LOOP - Returns new object every render
const { status, data } = useStore(service.store, s => ({
  status: s.status,
  data: s.data,
}));

// ✅ CORRECT - Primitive selectors
const status = useStore(service.store, s => s.status);
const data = useStore(service.store, s => s.data);

// ✅ ALTERNATIVE - useShallow for objects
import { useShallow } from 'zustand/react/shallow';
const { status, data } = useStore(service.store, useShallow(s => ({
  status: s.status,
  data: s.data,
})));
```

## Service Initialization

All services must be initialized in `App.tsx`:

```typescript
import { manualSyncService } from './02_modules/sync';
import { authStateService } from './02_modules/auth';
import { settingsStateService } from './02_modules/settings';

function AppContent() {
  // Initialize services (load persisted state from localStorage)
  useEffect(() => {
    manualSyncService.init();
    authStateService.init();
    settingsStateService.init();
  }, []);

  // ...rest of app
}
```

## Files Changed

### Created
- `app/src/02_modules/sync/services/manualSyncService.ts`
- `app/src/02_modules/sync/hooks/useSyncTrigger.ts`
- `app/src/02_modules/auth/services/authStateService.ts`
- `app/src/02_modules/auth/hooks/useAuthInit.ts`
- `app/src/02_modules/settings/services/settingsStateService.ts`
- `app/src/02_modules/settings/hooks/useSettingsInit.ts`

### Deleted
- `app/src/02_modules/transaction/headless/useSyncLogic.ts`
- `app/src/02_modules/auth/headless/useAuth.ts`
- `app/src/02_modules/settings/headless/useSettings.ts`
- `app/src/02_modules/settings/headless/` (directory removed)

### Modified
- `app/src/App.tsx` - Added service initialization
- `app/src/02_modules/transaction/views/TransactionView.tsx` - Uses manualSyncService
- `app/src/02_modules/settings/views/SettingsView.tsx` - Uses settingsStateService
- `app/src/02_modules/settings/views/UserProfileView.tsx` - Uses authStateService
- `app/src/02_modules/debug/views/DebugView.tsx` - Uses both services
- `app/src/02_modules/auth/headless/useEffectiveUserId.ts` - Uses authStateService
- `app/src/02_modules/dashboard/` - Renamed `headless/` → `hooks/` (useChartData is pure computation)

## Future Work

Modules still using headless pattern (OK to keep for now):
- `transaction/headless/useTransactionLogic.ts` - Uses service pattern internally, can be migrated later
- `capture/hooks/*` - Already uses service pattern (capture uses Services from the start)

## References

- **ADR-001**: Service Pattern (`.claude/ADR/ADR-001-service-pattern.md`)
- **Issue #141**: Service Pattern Migration
- **Zustand Safety**: `.claude/rules/zustand-hooks.md`
- **Service Rules**: `.claude/rules/service-layer.md`
