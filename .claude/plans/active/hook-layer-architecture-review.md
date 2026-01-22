# Hook Layer Architecture Review

**Date**: 2026-01-22
**Context**: Evaluating Hook's role in the four-layer architecture

## User's Proposed Theory: Hook as "Translator/Diplomat"

### Hook's Three Identities

1. **Connector (连接器)**: Bridging Vanilla JS (Service) → React reactive system
   - Tool: `useSyncExternalStore` or Zustand's `useStore`
   - Job: Subscribe to Service changes, notify React to re-render

2. **Selector (选择器)**: Extracting specific data from Service state
   - Avoid unnecessary re-renders by returning only needed primitives
   - Comply with ADR-012 (no object selectors)

3. **Orchestrator/Glue (编排器)**: Coordinating multiple Services
   - NOT business logic
   - Examples: Call AuthService → get userId → pass to OrderService

### Logic Boundary Table (User's Proposal)

| Logic Type | Location | Examples |
|------------|----------|----------|
| **Business Rules** | Service | Discount calculation, permissions, API data cleaning |
| **Persistence** | Db/Adapter | LocalStorage, Axios requests |
| **Composition** | Hook | Call authService → pass ID to orderService |
| **UI Interaction** | Hook/Component | Modal open/close, debounce |

---

## Current Project Practice

### Documented Layers (from ADR-001 & LAYERS.md)

```
Layer 1: React Components (View)
    ↓
Layer 2: Pure TS Services (Orchestrator)
    ↓
Layer 3: Adapters (Bridge)
    ↓
Layer 4: Tauri/AWS (Executor)
```

**Hook is NOT explicitly mentioned as a layer.**

### Actual Directory Structure

```
02_modules/{feature}/
├── stores/         # Vanilla Zustand stores
├── services/       # Business logic orchestration
├── adapters/       # IO boundary (IPC, API)
├── hooks/          # React bridge (✅ EXISTS but not documented as layer)
└── views/          # Pure UI components
```

### Existing ADRs Related to Hooks

#### ADR-001: Service Layer Pattern

- Services own Zustand vanilla stores
- React components subscribe via `useStore()`
- **Gap**: Doesn't mention Hook layer explicitly

#### ADR-012: Zustand Selector Safety

- Mandates primitive selectors or manual subscription
- Prevents infinite loop bugs
- **Aligns with User Theory**: Hook as Selector (Identity #2)

---

## Gap Analysis

### ✅ What Aligns

| User Theory | Project Practice | Evidence |
|-------------|------------------|----------|
| Hook as **Connector** | ✅ Implemented | `useStore()`, `useSyncExternalStore()` in hooks |
| Hook as **Selector** | ✅ Documented | ADR-012 mandates primitive selectors |
| Hook NOT for business logic | ✅ Followed | Services contain business logic |
| Hook for composition | ✅ Implicit | `useDebugSettings` calls `debugSettingsStateService` |

### ⚠️ What's Missing

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| Hook not documented as layer | Ambiguity in where to put "glue logic" | Add ADR-020: Hook Bridge Layer |
| No clear "Orchestrator" boundary | Risk of logic creeping into Hook | Define composition vs business logic boundary |
| No mention of "format logic" | Unclear where to transform Service data for UI | Document "adapter pattern" for UI-specific formatting |

---

## Case Study: Current Implementations

### Example 1: useDebugSettings (Issue #166)

**File**: `app/src/02_modules/debug/hooks/useDebugSettings.ts`

```typescript
// ✅ Identity 1: Connector
export function useDebugEnabled(): boolean {
  return useStore(debugSettingsStore, debugSettingsSelectors.debugEnabled);
}

// ✅ Identity 2: Selector (primitive return)
export function useDebugSettingsStatus(): string {
  return useStore(debugSettingsStore, debugSettingsSelectors.status);
}

// ✅ Identity 3: Orchestrator (delegates to Service)
export const debugSettingsActions = {
  updateSetting: <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]): Promise<void> => {
    return debugSettingsStateService.update(key, value);
  },
};
```

**Analysis**:
- ✅ Follows User Theory perfectly
- Hook is thin wrapper over Service
- No business logic in Hook
- Actions delegate to Service for IO

### Example 2: Settings Module (Issue #165)

**File**: `app/src/02_modules/settings/hooks/useSettingsState.ts`

```typescript
// ✅ Connector + Selector
export function useSettingsLanguage(): AppSettings['language'] {
  return useStore(settingsStore, settingsSelectors.language);
}

// ✅ Orchestrator (delegates to Service)
export const settingsActions = {
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> => {
    return settingsStateService.update(key, value);
  },
};
```

**Analysis**:
- ✅ Consistent pattern with Debug module
- Hook exposes primitive selectors
- Actions are thin wrappers calling Service

---

## Proposed Architecture Refinement

### Current (Documented)

```
React → Service → Adapter → Tauri/AWS
```

### Proposed (with Hook Layer)

```
React (JSX)
    ↓ uses
Hook Layer (React Bridge)
    ├─ Identity 1: Connector (useStore, useSyncExternalStore)
    ├─ Identity 2: Selector (primitive return values)
    └─ Identity 3: Orchestrator (thin wrappers, composition)
    ↓ calls
Service Layer (Pure TS)
    └─ Business logic, state management, flow orchestration
    ↓ calls
Adapter Layer (IO Boundary)
    └─ IPC, API, Database
    ↓ calls
Tauri/AWS (Executor)
```

---

## Logic Placement Guidelines

### ✅ Service Layer

```typescript
// ✅ Business Rule
class OrderService {
  calculateDiscount(total: number, userLevel: string): number {
    return userLevel === 'vip' ? total * 0.9 : total;
  }
}

// ✅ Flow Orchestration
class OrderService {
  async checkout(orderId: OrderId) {
    const order = await orderDb.get(orderId);
    const discount = this.calculateDiscount(order.total, order.userLevel);
    const finalAmount = order.total - discount;
    await paymentAdapter.charge(finalAmount);
    await orderDb.update(orderId, { status: 'paid' });
  }
}
```

### ✅ Hook Layer

```typescript
// ✅ Composition (orchestrating multiple Services)
export function useOrderProcess() {
  const user = useStore(authService.store, (s) => s.user);
  const orders = useStore(orderService.store, (s) => s.orders);

  const handlePurchase = async (productId: string) => {
    if (!user) {
      alert('Please login'); // ✅ UI interaction
      return;
    }
    await orderService.create(user.id, productId); // ✅ Delegates to Service
  };

  // ✅ Format logic (UI-specific transformation)
  const activeOrders = orders.filter(o => o.status === 'active');

  return { activeOrders, handlePurchase };
}
```

### ❌ Anti-Pattern: Business Logic in Hook

```typescript
// ❌ WRONG: Discount calculation in Hook
export function useOrderProcess() {
  const calculateDiscount = (total: number, userLevel: string) => {
    return userLevel === 'vip' ? total * 0.9 : total; // ❌ Business rule
  };
  // This belongs in Service!
}
```

---

## Recommendations

### 1. Create ADR-020: Hook Bridge Layer

**Proposed Decision**:
- Formalize Hook as "Layer 1.5" (between View and Service)
- Define Hook's three identities (Connector, Selector, Orchestrator)
- Establish clear boundaries for composition logic

### 2. Update LAYERS.md

Add Hook layer documentation:

```markdown
## Layer 1.5: Hook Bridge (React → Service Bridge)

**Position**: React-specific bridge to Vanilla JS Services

| Identity | Description |
|----------|-------------|
| Connector | Subscribe to Service stores via useStore() |
| Selector | Extract primitive values (ADR-012) |
| Orchestrator | Coordinate multiple Services (composition only) |

### Boundaries

- ✅ Call multiple Services and combine results
- ✅ Format Service data for UI-specific needs
- ✅ Handle UI-specific interactions (modal, alert)
- ❌ No business logic (calculations, validations)
- ❌ No direct IO (must delegate to Service)
```

### 3. Add Examples to PATTERNS.md

Document common Hook patterns:
- Multi-Service composition
- UI-specific formatting
- React lifecycle integration (init, cleanup)

---

## Specific Scenarios (User Asked)

### Form Validation

**Question**: Service or Hook?

**Answer**: **Split by type**

| Type | Location | Reason |
|------|----------|--------|
| **Business validation** | Service | "Email must be unique" (requires DB check) |
| **Format validation** | Hook | "Email format invalid" (pure UI feedback) |

```typescript
// Hook (format validation)
export function useLoginForm() {
  const [email, setEmail] = useState('');
  const emailError = !email.includes('@') ? 'Invalid format' : null; // ✅ UI validation

  const handleSubmit = async () => {
    await authService.login(email); // ✅ Delegates business validation to Service
  };

  return { email, setEmail, emailError, handleSubmit };
}

// Service (business validation)
class AuthService {
  async login(email: string) {
    const user = await userDb.findByEmail(email);
    if (!user) throw new Error('User not found'); // ✅ Business validation
  }
}
```

### Route Navigation

**Answer**: **Hook** (UI-specific side effect)

```typescript
// ✅ Hook handles navigation
export function useOrderComplete() {
  const navigate = useNavigate();

  const handleComplete = async (orderId: OrderId) => {
    await orderService.complete(orderId); // ✅ Service does business logic
    navigate('/success'); // ✅ Hook handles UI navigation
  };

  return { handleComplete };
}
```

### Complex Animation

**Answer**: **Hook** (UI-specific, no business logic)

```typescript
// ✅ Hook manages animation state
export function useMenuAnimation() {
  const [isOpen, setIsOpen] = useState(false);
  const controls = useAnimation();

  const toggle = () => {
    setIsOpen(!isOpen);
    controls.start({ opacity: isOpen ? 0 : 1 }); // ✅ Pure UI logic
  };

  return { toggle, controls };
}
```

---

## Conclusion

### Verdict: ✅ User Theory is CORRECT and Should Be Adopted

**Current Practice**: 90% aligned, but undocumented
**User Theory**: Provides clear mental model and boundaries
**Action Items**:
1. Create ADR-020 to formalize Hook Bridge Layer
2. Update LAYERS.md with Hook layer documentation
3. Add composition/orchestration examples to PATTERNS.md

### Benefits of Adopting This Model

✅ **Clarity**: Clear boundary between business logic (Service) and composition (Hook)
✅ **Consistency**: All modules follow same pattern (Settings, Debug already do)
✅ **Maintainability**: Easier to onboard new developers
✅ **AI-Friendly**: Clear rules for AI-assisted development

---

**Last Updated**: 2026-01-22
**Status**: Proposal for ADR-020
**Next Action**: Create formal ADR if approved
