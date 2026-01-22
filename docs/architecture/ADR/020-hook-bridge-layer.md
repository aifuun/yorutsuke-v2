# ADR-020: Hook Bridge Layer

**Status**: Accepted
**Date**: 2026-01-22
**Context**: Issue #166 revealed need to formalize Hook's role in architecture

## Context

In our four-layer architecture (React → Service → Adapter → Tauri/AWS), we discovered an implicit layer between React and Service: **the Hook layer**.

While implementing Issue #165 (Settings 4-layer) and Issue #166 (Debug Hook Bridge), we consistently created hooks that:
- Subscribe to Vanilla Zustand stores
- Extract primitive values (per ADR-012)
- Coordinate multiple Services
- Format data for UI consumption

However, this pattern was **never formally documented**, leading to ambiguity about:
- Where to put "composition logic" (coordinating multiple Services)
- Where to put "format logic" (transforming Service data for UI)
- What logic is allowed in Hooks vs must stay in Services

## Decision

Formalize **Hook Bridge Layer** as **Layer 1.5** in the architecture.

### Visual Model

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: React Components (View)                       │
│  - Pure JSX rendering                                   │
│  - Local UI state (modal open, input value)             │
└─────────────────────────────────────────────────────────┘
                         ↓ uses
┌─────────────────────────────────────────────────────────┐
│  Layer 1.5: Hook Bridge (React ↔ Service Bridge)       │
│  - Subscribe to Service stores (Connector)              │
│  - Extract primitive values (Selector)                  │
│  - Coordinate multiple Services (Orchestrator)          │
└─────────────────────────────────────────────────────────┘
                         ↓ calls
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Services (Pure TS Orchestrator)               │
│  - Business logic and flow orchestration                │
│  - Own Vanilla Zustand stores                           │
└─────────────────────────────────────────────────────────┘
```

### Hook's Three Identities

#### 1. Connector (连接器)

Bridges Vanilla JS (Service) to React's reactive system.

**Mechanism**: `useStore()` or `useSyncExternalStore()`

**Job**: Subscribe to Service state changes, notify React to re-render

```typescript
// Hook as Connector
export function useDebugEnabled(): boolean {
  return useStore(debugSettingsStore, debugSettingsSelectors.debugEnabled);
}
```

#### 2. Selector (选择器)

Extracts specific data from Service state to minimize re-renders.

**Mechanism**: Primitive return values (ADR-012 compliance)

**Job**: Return only what component needs, avoid object selectors

```typescript
// Hook as Selector (returns primitive)
export function useTransactionCount(): number {
  return useStore(transactionStore, s => s.transactions.length);
}

// ❌ ANTI-PATTERN: Object selector causes infinite loops
export function useTransactionData() {
  return useStore(transactionStore, s => ({
    count: s.transactions.length,
    total: s.totalAmount
  })); // ❌ New object every render
}
```

#### 3. Orchestrator (编排器)

Coordinates multiple Services or formats data for UI.

**NOT business logic** - only composition and UI-specific transformation.

```typescript
// Hook as Orchestrator (coordinates multiple Services)
export function useOrderProcess() {
  // Connect to multiple Services
  const user = useStore(authService.store, s => s.user);
  const orders = useStore(orderService.store, s => s.orders);

  // Composition logic: coordinate Services
  const handlePurchase = async (productId: string) => {
    if (!user) {
      alert('Please login'); // ✅ UI interaction
      return;
    }
    await orderService.create(user.id, productId); // ✅ Delegate to Service
  };

  // Format logic: UI-specific transformation
  const activeOrders = orders.filter(o => o.status === 'active');

  return { activeOrders, handlePurchase };
}
```

### Logic Boundary Table

| Logic Type | Location | Examples | Reason |
|------------|----------|----------|--------|
| **Business Rules** | Service | Discount calculation, permission checks, API data validation | Core business logic, testable without React |
| **Persistence** | Adapter | LocalStorage access, Axios requests, Tauri IPC | IO boundary, Pillar B validation |
| **Composition** | Hook | Call authService → get userId → pass to orderService | Glue between Services, React-specific |
| **Format for UI** | Hook | Filter list for display, format date for UI | UI-specific transformation, no business rules |
| **UI Interaction** | Hook/Component | Modal open/close, debounce, animations | Pure UI logic, no business impact |

## Examples

### Example 1: Form Validation (Split by Type)

```typescript
// ========== Hook (format validation) ==========
export function useLoginForm() {
  const [email, setEmail] = useState('');

  // ✅ UI validation: format check (no IO)
  const emailError = !email.includes('@') ? 'Invalid email format' : null;

  const handleSubmit = async () => {
    // ✅ Delegate business validation to Service
    await authService.login(email);
  };

  return { email, setEmail, emailError, handleSubmit };
}

// ========== Service (business validation) ==========
class AuthService {
  async login(email: string) {
    // ✅ Business validation: DB check (IO required)
    const user = await userDb.findByEmail(email);
    if (!user) throw new Error('User not found');

    // ✅ Business logic: session management
    this.store.setState({ user, isAuthenticated: true });
  }
}
```

### Example 2: Route Navigation (Hook Handles UI Side Effects)

```typescript
// ========== Hook (navigation is UI concern) ==========
export function useOrderComplete() {
  const navigate = useNavigate(); // React Router hook

  const handleComplete = async (orderId: OrderId) => {
    // ✅ Service does business logic
    await orderService.complete(orderId);

    // ✅ Hook handles UI navigation
    navigate('/success');
  };

  return { handleComplete };
}

// ========== Service (no UI dependencies) ==========
class OrderService {
  async complete(orderId: OrderId) {
    // ✅ Pure business logic (no navigation, no alerts)
    const order = await orderDb.get(orderId);
    await paymentAdapter.finalize(order.paymentId);
    await orderDb.update(orderId, { status: 'completed' });
    this.store.setState({ completedOrders: [...this.store.getState().completedOrders, order] });
  }
}
```

### Example 3: Animation (Pure UI Logic)

```typescript
// ========== Hook (animation is UI concern) ==========
export function useMenuAnimation() {
  const [isOpen, setIsOpen] = useState(false);
  const controls = useAnimation();

  const toggle = () => {
    setIsOpen(!isOpen);
    // ✅ Pure UI logic: animation control
    controls.start({ opacity: isOpen ? 0 : 1 });
  };

  return { toggle, controls };
}
```

## Consequences

### Positive

- ✅ **Clear boundaries**: Documented where to put composition/format logic
- ✅ **Consistency**: All modules follow same pattern (Settings, Debug, Transaction)
- ✅ **Maintainability**: Easy to understand Hook's limited responsibilities
- ✅ **AI-friendly**: Clear rules for AI-assisted development
- ✅ **Service purity**: Services stay framework-agnostic (no React dependencies)

### Negative

- ⚠️ **Extra layer**: More indirection (React → Hook → Service)
- ⚠️ **Learning curve**: Team must understand three identities
- ⚠️ **Boilerplate**: More files per feature (store, service, hook, view)

### Trade-offs

| Aspect | Without Hook Layer | With Hook Layer |
|--------|-------------------|-----------------|
| Component complexity | High (direct store access) | Low (use hooks) |
| Service testability | Medium (may have React deps) | High (pure TS) |
| Code organization | Flat (logic scattered) | Layered (clear separation) |
| Reusability | Low (tied to React) | High (Service reusable) |

## Anti-Patterns

### ❌ Anti-Pattern 1: Business Logic in Hook

```typescript
// ❌ WRONG: Discount calculation in Hook
export function useOrderProcess() {
  const calculateDiscount = (total: number, userLevel: string) => {
    return userLevel === 'vip' ? total * 0.9 : total; // ❌ Business rule
  };

  // This belongs in Service!
}

// ✅ CORRECT: Business logic in Service
class OrderService {
  calculateDiscount(total: number, userLevel: string): number {
    return userLevel === 'vip' ? total * 0.9 : total;
  }
}
```

### ❌ Anti-Pattern 2: Direct IO in Hook

```typescript
// ❌ WRONG: Direct API call in Hook
export function useUserData() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(setUser); // ❌ IO in Hook
  }, []);

  return user;
}

// ✅ CORRECT: IO in Service, Hook subscribes
class UserService {
  async load() {
    const user = await userAdapter.fetch(); // ✅ IO in Adapter
    this.store.setState({ user }); // ✅ Update store
  }
}

export function useUserData() {
  return useStore(userService.store, s => s.user); // ✅ Subscribe only
}
```

### ❌ Anti-Pattern 3: Object Selector

```typescript
// ❌ WRONG: Object selector (infinite loop risk)
export function useOrderSummary() {
  return useStore(orderStore, s => ({
    total: s.total,
    count: s.items.length
  })); // ❌ New object every render
}

// ✅ CORRECT: Individual primitive selectors
export function useOrderTotal(): number {
  return useStore(orderStore, s => s.total);
}

export function useOrderCount(): number {
  return useStore(orderStore, s => s.items.length);
}
```

## Implementation Checklist

When creating new hooks:

- [ ] **Identity 1 (Connector)**: Uses `useStore()` or `useSyncExternalStore()`
- [ ] **Identity 2 (Selector)**: Returns primitives (ADR-012 compliance)
- [ ] **Identity 3 (Orchestrator)**: Only composition, no business logic
- [ ] **No IO**: All IO delegated to Service → Adapter
- [ ] **No business rules**: Calculations/validations in Service
- [ ] **File naming**: `use{Feature}State.ts` for state hooks
- [ ] **Export pattern**: Individual hooks + actions object

## Related

- **ADR-001**: Service Layer Pattern (Services own stores)
- **ADR-012**: Zustand Selector Safety (primitive selectors)
- **Issue #165**: Settings 4-layer architecture (first implementation)
- **Issue #166**: Debug Hook Bridge (second implementation)
- **LAYERS.md**: Four-layer architecture overview
- **PATTERNS.md**: State management patterns

## Migration Notes

**Existing modules already follow this pattern** (Settings, Debug, Transaction, Capture, Sync).

No migration needed - this ADR formalizes existing practice.

**New modules should**:
1. Create `stores/` for Vanilla Zustand stores
2. Create `services/` for business logic
3. Create `hooks/` for React bridge (following three identities)
4. Views use hooks, never direct store access

---

**Accepted**: 2026-01-22
**Implementation**: Already practiced, now documented
**Next Review**: When adding new module or refactoring existing ones
