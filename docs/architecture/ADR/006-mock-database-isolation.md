# ADR-006: Mock Database Isolation Pattern

**Status**: Accepted  
**Date**: 2026-01  
**Issue**: #138  
**Author**: Claude (AI Assistant)

## Context

When developing locally with mock data, the app needs to:
1. Switch between mock and production modes without losing data
2. Allow users to seed test data in mock mode
3. Keep mock and production databases completely isolated
4. Auto-reload views when switching modes

**Problem**: Initial implementation mixed mock and production data:
- Seeded mock data appeared in production mode after switching
- Views cached transactions in memory and didn't reload on mode switches
- `getDb()` didn't properly initialize mock database
- ReportView auto-seeded data regardless of mode

**Impact**: 
- User confusion (test data bleeding into production view)
- Data corruption risk
- Unreliable testing environment

## Decision

Implement a **dual-database pattern with automatic isolation and reload**:

### Architecture

```
App Initialization
    ↓
00_kernel/storage/db.ts
    ├─ getDb() → Check mock mode
    ├─ If mock: getMockDb() → Initialize mock SQLite
    └─ If prod: Initialize production SQLite
    ↓
Views Subscribe to Mock Mode Changes
    ├─ useTransactionLogic → subscribeMockMode()
    └─ Auto-reload data on switch
    ↓
Mock Data Generators (Centralized)
    ├─ mockOnline.ts (successful API responses)
    └─ mockOffline.ts (error scenarios)
```

### Key Design Decisions

1. **Empty by default**: Mock database starts empty (users manually seed via Debug panel)
2. **No auto-seeding**: Prevents confusion about what's real vs test data
3. **Auto-reload**: Views subscribe to mock mode changes and reload immediately
4. **Settings in production DB**: `mock_mode` setting always in production DB (survives switches)
5. **Centralized mock data**: All mock generators in `00_kernel/mocks/` (not inline)

### Implementation

**db.ts Changes**:
```typescript
export function getDb(): Database {
  const isMock = getMockModeSetting(); // Read from production DB
  if (isMock) {
    return getMockDb(); // Properly initialize mock DB
  }
  return getProductionDb();
}
```

**useTransactionLogic.ts Changes**:
```typescript
subscribeMockMode((newMode) => {
  // Auto-reload transactions when mode switches
  reloadTransactions();
});
```

**Mock Data Location**:
- `app/src/00_kernel/mocks/mockOnline.ts` (167 lines) - Successful API responses
- `app/src/00_kernel/mocks/mockOffline.ts` (86 lines) - Error scenarios

### Database Switching Behavior

| Action | Result |
|--------|--------|
| Switch to mock mode | Views reload from mock DB (empty initially) |
| Seed test data | Written to mock DB only |
| Switch to production mode | Views reload from production DB |
| Data crossing | Never (complete isolation) |

## Consequences

**Positive**:
- ✅ No data mixing between modes
- ✅ Views stay in sync with mode changes
- ✅ Predictable testing environment
- ✅ Easy to reproduce issues with mock data
- ✅ All 105 tests passing

**Negative**:
- ❌ Two separate databases to manage (minor)
- ❌ Must manually seed mock data (could auto-seed with toggle)

**Pillar Compliance**:
- **C (Mocking)**: ✅ Centralized mock data generation
- **L (Headless)**: ✅ Views handle empty state gracefully
- **D (FSM)**: ✅ Explicit mode switching (production ↔ mock)

## Related Files

- `app/src/00_kernel/storage/db.ts` - Dual-database logic
- `app/src/00_kernel/mocks/mockOnline.ts` - Mock API responses
- `app/src/00_kernel/mocks/mockOffline.ts` - Mock errors
- `app/src/02_modules/transaction/headless/useTransactionLogic.ts` - Mode subscription
- `app/src/02_modules/report/views/ReportView.tsx` - Removed auto-seeding
- `docs/tests/MOCKING.md` - Test documentation

## Testing

- ✅ 105 unit tests passing
- ✅ Mock mode toggle verified
- ✅ Data isolation confirmed
- ✅ Auto-reload on switch verified

## References

- Issue #138: Mock Database Isolation  
- Pillar C: Mocking patterns
- Pillar L: Headless architecture
