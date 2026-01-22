# ADR 019: Service Singleton Pattern

**Date**: 2026-01-22
**Status**: ACCEPTED
**Related**: ADR-001 (Service Pattern)

## Problem

Services were being initialized with public `init()` methods called from multiple locations in the codebase:
- App.tsx
- DashboardView.tsx
- ReportView.tsx
- Multiple test files

This led to:
1. **Multiple initialization calls** - Services could be initialized multiple times
2. **Hidden dependencies** - Not clear where services are initialized
3. **Scattered initialization logic** - No single initialization order or sequence
4. **Test complexity** - Tests had to manually call init() to set up state

## Decision

**All services shall follow the singleton pattern with automatic initialization:**

1. **Private constructor** - Prevents `new Service()` instantiation
2. **Static getInstance()** - Guarantees single instance
3. **Auto-initialization** - Service initializes in constructor, no manual init() needed
4. **Ordered initialization in main.tsx** - All services initialized once at app startup
5. **Direct export** - Export the singleton instance, not the class

## Pattern

```typescript
class MyService {
  private static instance: MyService | null = null;

  // Private constructor - only getInstance() can create instances
  private constructor() {
    this._initialize();
  }

  static getInstance(): MyService {
    if (!MyService.instance) {
      MyService.instance = new MyService();
    }
    return MyService.instance;
  }

  private _initialize(): void {
    // Initialization logic (event listeners, state setup)
    logger.info('SERVICE_INITIALIZED', { service: 'MyService' });
  }

  // Other methods...
}

// Export singleton instance
export const myService = MyService.getInstance();
```

## Initialization Order

In `main.tsx` or app startup, initialize all services in dependency order:

```typescript
// Initialize in order: services with fewer dependencies first
transactionService;              // Imported but auto-initializes (no deps)
authStateService.init();         // Depends on nothing
settingsStateService.init();     // Depends on authStateService
manualSyncService.init();        // Depends on transactionService
autoSyncService.init();          // Depends on transactionService
```

### Important: Import order matters

Importing a singleton service triggers its initialization:
```typescript
// Simply importing triggers getInstance() and constructor
import { transactionService } from '...';  // Auto-initialized NOW
```

## Benefits

| Benefit | Explanation |
|---------|-------------|
| **Single source of truth** | One instance per service, guaranteed |
| **Clear initialization** | All initialization happens in main.tsx |
| **No manual init()** | Remove scattered init() calls everywhere |
| **Test friendly** | destroy() resets singleton for clean test state |
| **Predictable lifecycle** | Service lives for app lifetime (like singleton) |
| **Clear dependencies** | Import order reflects init order |

## Affected Services

All services should follow this pattern:

- ✅ `transactionService` (implemented)
- `authStateService`
- `settingsStateService`
- `manualSyncService`
- `autoSyncService`
- `transactionSyncService`
- `transactionPushService`
- `transactionPullService`
- And any other global services

## Migration Steps

1. **Convert to singleton** - Add private constructor, getInstance()
2. **Move init logic to constructor** - No public init() method
3. **Update exports** - Export getInstance() result, not class
4. **Remove all init() calls** - From views, tests, everywhere
5. **Update test cleanup** - Call destroy() to reset singleton

### Test Pattern

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  myService.destroy();  // Reset singleton
});

afterEach(() => {
  myService.destroy();
});

describe('tests', () => {
  it('should work', () => {
    // Service auto-initializes, no manual init() needed
    const result = myService.someMethod();
    expect(result).toBe(expected);
  });
});
```

## Implementation Checklist

For each service:

- [ ] Make constructor private
- [ ] Add static getInstance() method
- [ ] Add private static instance field
- [ ] Move init() logic to private _initialize()
- [ ] Remove public init() method
- [ ] Export singleton: `export const myService = MyService.getInstance()`
- [ ] Add destroy() method for testing
- [ ] Remove all init() calls from codebase
- [ ] Update tests to use destroy() in beforeEach/afterEach
- [ ] Verify service initializes automatically

## Non-Breaking Change

This is a **localized refactoring**:
- Existing code calling `service.init()` still works (temporarily)
- gradual migration is safe
- Tests need updating but implementation is unchanged

## Rationale

The singleton pattern aligns with:
- **Pillar K (Locality)** - State near usage (single instance)
- **ADR-001 (Service Pattern)** - Global services own global state
- **Dependency Injection** - Import order = initialization order
- **RAII principle** - Resource initialization in constructor

---

## Related

- **ADR-001**: Service Pattern
- **Rule**: `.claude/rules/service-layer.md`
- **Pattern**: `Pillar K: Locality`

## References

- Singleton pattern: https://en.wikipedia.org/wiki/Singleton_pattern
- Service Pattern: ADR-001
- Test cleanup: `.prot/pillar-k/testing.ts`
