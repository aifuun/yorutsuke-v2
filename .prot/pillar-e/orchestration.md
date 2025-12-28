# Pillar E: Adaptive Orchestration

> Match architectural pattern to task complexity tier

## Rule

The architectural pattern must match the **Complexity Tier** of the task. Over-engineering is as harmful as under-engineering.

## Purpose

- Balance rigor with development velocity
- Prevent over-engineering simple features
- Ensure critical operations have proper safeguards
- Clear decision framework for architecture

## Implementation

### Tier Classification

| Tier | Complexity | Pattern | When to Use |
|------|------------|---------|-------------|
| T1 | Direct | `View → Adapter` | Read-only, simple fetch |
| T2 | Logic | `View → Headless → Adapter` | Local state, validation |
| T3 | Saga | `View → Saga → [Adapters]` | Distributed writes, $$$ |

### Tier 1: Direct Pattern

```typescript
// Simple fetch, no state management needed
function UserProfile({ userId }: { userId: UserId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),  // Direct to adapter
  });

  if (isLoading) return <Loading />;
  return <div>{data?.name}</div>;
}
```

### Tier 2: Logic Pattern

```typescript
// State + validation required
// headless/useCartLogic.ts
function useCartLogic() {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = (item: CartItem) => {
    // Validation logic
    if (item.quantity <= 0) return;
    dispatch({ type: 'ADD', payload: item });
  };

  return { state, addItem };
}

// views/CartView.tsx
function CartView() {
  const { state, addItem } = useCartLogic();
  return <Cart items={state.items} onAdd={addItem} />;
}
```

### Tier 3: Saga Pattern

```typescript
// Distributed writes with compensation
async function checkoutSaga(cmd: CheckoutCommand, ctx: Context) {
  // 1. Idempotency check (Pillar Q)
  // 2. Concurrency check (Pillar F)
  // 3. Execute with compensation stack (Pillar M)
  // 4. Semantic logging (Pillar R)

  const compensations: Compensation[] = [];

  try {
    compensations.push(() => refundPayment(txId));
    const txId = await chargePayment(cmd.amount);

    compensations.push(() => restoreInventory(cmd.items));
    await reserveInventory(cmd.items);

    // ... more steps
  } catch (error) {
    await executeCompensations(compensations);
    throw error;
  }
}
```

## Decision Matrix

```
                    ┌─────────────────────────────────────┐
                    │         Is it a write operation?     │
                    └─────────────────────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                        No                        Yes
                         │                         │
                         ▼                         ▼
                    ┌─────────┐           ┌─────────────────────┐
                    │   T1    │           │ Multiple services?   │
                    │ Direct  │           └─────────────────────┘
                    └─────────┘                    │
                                      ┌────────────┴────────────┐
                                      │                         │
                                     No                        Yes
                                      │                         │
                                      ▼                         ▼
                              ┌─────────────┐           ┌─────────┐
                              │ Local state? │           │   T3    │
                              └─────────────┘           │  Saga   │
                                      │                 └─────────┘
                         ┌────────────┴────────────┐
                         │                         │
                        No                        Yes
                         │                         │
                         ▼                         ▼
                    ┌─────────┐               ┌─────────┐
                    │   T1    │               │   T2    │
                    │ Direct  │               │  Logic  │
                    └─────────┘               └─────────┘
```

## Good Example

```typescript
// ✅ T1 for simple display
function ProductCard({ productId }) {
  const { data } = useQuery(['product', productId], fetchProduct);
  return <Card>{data?.name}</Card>;
}

// ✅ T2 for form with validation
function useContactForm() {
  const [state, dispatch] = useReducer(formReducer, initial);
  const validate = () => { /* validation logic */ };
  return { state, validate, submit };
}

// ✅ T3 for payment
async function processPayment(cmd) {
  // Full saga with idempotency, locking, compensation
}
```

## Bad Example

```typescript
// ❌ Over-engineering: Saga for simple display
async function fetchProductSaga(productId) {
  const compensations = [];
  try {
    // ... unnecessary complexity for a read operation
  }
}

// ❌ Under-engineering: No saga for payment
async function processPayment(amount) {
  await stripe.charge(amount);  // No idempotency!
  await updateOrder();          // No compensation!
  await sendEmail();            // What if this fails?
}
```

## Anti-Patterns

1. **Saga for read operations**
   ```typescript
   // ❌ Over-engineering
   const fetchUserSaga = createSaga(/* ... */);
   ```

2. **Direct call for distributed writes**
   ```typescript
   // ❌ Under-engineering
   await api.charge();
   await api.updateInventory();
   // No atomicity, no rollback
   ```

3. **One pattern for everything**
   ```typescript
   // ❌ Using same architecture regardless of complexity
   ```

## Exceptions

- Prototype/MVP phase may use simpler patterns temporarily
- Well-documented technical debt for time-critical features

## Checklist

- [ ] Task tier identified before implementation
- [ ] Pattern matches tier complexity
- [ ] T1: No unnecessary state management
- [ ] T2: Headless hook separates logic
- [ ] T3: Full saga with all safeguards

## References

- Related: `.prot/CHEATSHEET.md` - tier classification reference
- Related: Pillar Q, F, M, R - T3 requirements
- Templates:
  - T1: `.prot/pillar-e/tier1-fetcher.ts`
  - T2: `.prot/pillar-e/tier2-headless.ts`
  - T3: `.prot/pillar-e/tier3-saga.ts`
- Checklist: `.prot/pillar-e/checklist.md`
