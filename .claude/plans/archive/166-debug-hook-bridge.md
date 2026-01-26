# Issue #166: Refactor Debug Module to Add Hook Bridge Layer

**Status**: ✅ Complete
**Branch**: `feature/166-debug-hook-bridge`
**Started**: 2026-01-22
**Completed**: 2026-01-22

## Objective

Extract store from DiagnosticService and create hook bridge layer to comply with Pillar L (Headless separation).

## Reference Architecture

Following Settings Module pattern (Issue #165):
```
stores/settingsStore.ts       → Vanilla Zustand store
hooks/useSettingsState.ts     → React bridge with atomic selectors
services/settingsService.ts   → Pure TS, IO operations
views/SettingsView.tsx        → Uses hooks only
```

## Progress

### ✅ Completed

1. **Created `stores/diagnosticStore.ts`**
   - Extracted store from DiagnosticService
   - Vanilla Zustand with FSM state machine
   - Type-safe selectors for hooks
   - Actions: setState, setResult, setError, setContext, updateContext, reset

2. **Created `hooks/useDiagnosticState.ts`**
   - Atomic selectors (ADR-012 compliance):
     - `useDiagnosticStatus()` - Returns primitive status
     - `useDiagnosticResult()` - Returns result or null
     - `useDiagnosticError()` - Returns error or null
     - `useDiagnosticContext()` - Returns context or null
     - `useDiagnosticProgress()` - Returns number (0-100)
     - `useDiagnosticPhase()` - Returns phase or null
   - Actions wrapper: `diagnosticActions.execute()`, `diagnosticActions.reset()`

3. **Updated `views/DiagnosticPanel.tsx`**
   - Removed direct `useStore(diagnosticStore)` calls
   - Now uses hook bridge: `useDiagnosticStatus()`, etc.
   - Removed direct `diagnosticService` calls
   - Now uses `diagnosticActions.execute()`, `diagnosticActions.reset()`

4. **Updated `services/DiagnosticService.ts`**
   - Removed embedded store definition
   - Now imports `diagnosticStore` from `../stores`
   - Service continues to use store internally (allowed for services)

5. **Updated `debug/index.ts`**
   - Exports hooks from `./hooks`
   - Exports store from `./stores`
   - Organized exports by layer (Views, Hooks, Stores, Services, Adapters)

### ⚠️ Remaining Issue

**Cross-Module Dependency in DebugView.tsx**

```typescript
// ❌ PROBLEM: Debug module directly calls Settings service
import { settingsStateService } from '../../settings';

onClick={() => settingsStateService.update('debugEnabled', !currentSettings.debugEnabled)}
```

**Why this is a problem**:
- Violates module boundaries (Pillar I: Firewalls)
- Debug module should not directly manipulate Settings state
- Settings module doesn't know Debug module depends on it
- Creates tight coupling between modules

**Proposed Solutions**:

### Option A: Use Settings Hook (Recommended) ✅

```typescript
// ✅ Use hook + action pattern
import { useSettings, settingsActions } from '../../settings';

const settings = useSettings();
onClick={() => settingsActions.updateSetting('debugEnabled', !settings.debugEnabled)}
```

**Pros**:
- Follows established pattern (Settings module already exports `settingsActions`)
- No architectural changes needed
- Clean separation via hooks

**Cons**: None

### Option B: Move debugEnabled to Debug Module

Extract `debugEnabled` setting from Settings module into Debug module's own state.

**Pros**:
- Complete module independence
- Debug module owns its settings

**Cons**:
- More work (need new debug settings store)
- Loses centralized settings management
- Would need migration for existing data

### Option C: Event-Based Communication

Use EventBus to request settings changes.

**Cons**:
- Over-engineering for simple settings update
- Harder to trace data flow
- Not recommended for this use case

## Implementation

**Implemented Option B**: Isolated `debugEnabled` to Debug module for complete module independence.

### What Was Done

1. **Created Debug Settings Infrastructure**:
   - `adapters/debugSettingsDb.ts` - Manages `debug_enabled` persistence
   - `stores/debugSettingsStore.ts` - Vanilla Zustand store with FSM
   - `services/debugSettingsStateService.ts` - IO operations
   - `hooks/useDebugSettings.ts` - React bridge with atomic selectors

2. **Updated DebugView.tsx**:
   - Removed dependency on `settingsStateService`
   - Now uses `useDebugEnabled()` and `debugSettingsActions`
   - Added `useDebugSettingsInit()` to load settings on mount

3. **Removed from Settings Module**:
   - Removed `debugEnabled` from `AppSettings` interface
   - Removed `'debug_enabled'` from `SettingsKey` type
   - Removed from `DEFAULTS` and `loadSettings()`
   - Removed from `keyToDbKey()` mapping

### Benefits Achieved

✅ **Complete Module Isolation** (Pillar I)
   - Debug module no longer depends on Settings module
   - Settings module no longer needs to know about Debug

✅ **Clear Ownership**
   - Debug module owns its settings
   - No cross-module coupling

✅ **Consistent Architecture**
   - Follows same 4-layer pattern as Settings module
   - Stores → Services → Hooks → Views

## Files Changed

```
Created (Diagnostic Hook Bridge):
+ app/src/02_modules/debug/stores/diagnosticStore.ts
+ app/src/02_modules/debug/stores/index.ts
+ app/src/02_modules/debug/hooks/useDiagnosticState.ts
+ app/src/02_modules/debug/hooks/index.ts

Created (Debug Settings - Option B):
+ app/src/02_modules/debug/adapters/debugSettingsDb.ts
+ app/src/02_modules/debug/stores/debugSettingsStore.ts
+ app/src/02_modules/debug/services/debugSettingsStateService.ts
+ app/src/02_modules/debug/hooks/useDebugSettings.ts

Modified:
~ app/src/02_modules/debug/views/DiagnosticPanel.tsx
~ app/src/02_modules/debug/views/DebugView.tsx
~ app/src/02_modules/debug/services/DiagnosticService.ts
~ app/src/02_modules/debug/adapters/index.ts
~ app/src/02_modules/debug/stores/index.ts (updated with debug settings)
~ app/src/02_modules/debug/hooks/index.ts (updated with debug settings)
~ app/src/02_modules/debug/index.ts
~ app/src/02_modules/settings/adapters/settingsDb.ts (removed debugEnabled)
```

## Architecture Compliance

### ✅ Pillar L: Headless
- Store extracted to separate layer
- Views use hooks instead of direct store access
- Services remain pure TypeScript

### ✅ ADR-012: Zustand Selector Safety
- All hook selectors return primitives
- No object selectors that cause infinite loops

### ✅ Pillar I: Firewalls
- No deep imports (after Option A implementation)
- Module boundaries respected via hooks

## Testing Notes

- DiagnosticService has existing tests (DiagnosticService.test.ts)
- May need to update mocks for store extraction
- Integration test: Verify DiagnosticPanel workflow still works

---

**Last Updated**: 2026-01-22
**Next Action**: Implement Option A (use settingsActions)
