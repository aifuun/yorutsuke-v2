# Pillar E: Adaptive Orchestration Checklist

> Use this checklist when starting a new feature to classify tier and select pattern

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Classify First** | Determine tier BEFORE writing any code |
| **Match > Force** | Use the pattern that fits, don't force one pattern |
| **Simple > Complex** | Start with T1, escalate only when needed |

## Tier Decision Flow

```
Is it a write operation?
├── No → T1 (Direct)
└── Yes → Multiple services need consistency?
    ├── Yes → T3 (Saga)
    └── No → Local state/validation needed?
        ├── Yes → T2 (Logic)
        └── No → T1 (Direct)
```

## Before Implementation

### 1. Classify the Task

- [ ] Answer: Is this a read or write operation?
- [ ] Answer: Does it touch multiple services/tables?
- [ ] Answer: Does it need local state or validation?
- [ ] **Determine Tier**: T1 / T2 / T3

### 2. Select Pattern

| Tier | Pattern | Files to Create |
|------|---------|-----------------|
| **T1** | View → Headless → Adapter | `views/XxxView.tsx`, `headless/useXxxData.ts`, `adapters/xxxApi.ts` |
| **T2** | View → Headless → Adapter | `views/XxxView.tsx`, `headless/useXxxLogic.ts`, `adapters/xxxApi.ts` |
| **T3** | View → Saga → Adapters | + `workflows/xxxSaga.ts` |

> ⚠️ **AI-First Rule**: T1 MUST also use Headless, even if it only wraps `useQuery`.
> Consistency > Minimalism. Remove AI's choice, prevent logic erosion in View layer.

- [ ] Pattern selected matches tier
- [ ] File structure planned
- [ ] **All tiers use Headless** (no exceptions)

### 3. T3 Additional Requirements

If T3 (Saga), ensure these pillars are followed:

- [ ] **Pillar Q**: Idempotency key for retries
- [ ] **Pillar F**: Concurrency control (CAS/locking)
- [ ] **Pillar M**: Compensation stack for rollback
- [ ] **Pillar R**: Semantic logging with trace ID

## During Implementation

### T1 Checklist

- [ ] **Headless hook wraps adapter** (e.g., `useProductData`)
- [ ] View only calls headless hook, not adapter directly
- [ ] Using react-query or similar for caching (inside headless)
- [ ] No reducer/context for simple data

### T2 Checklist

- [ ] Logic in headless hook, not in view
- [ ] View only renders, no business logic
- [ ] FSM for state (Pillar D)
- [ ] Validation in headless hook

### T3 Checklist

- [ ] Saga function is idempotent
- [ ] Each step has compensation
- [ ] Version check before writes
- [ ] Trace ID passed through context
- [ ] Semantic logs at each step

## Code Review Checklist

### Pattern Matching

- [ ] Tier is documented in PR description
- [ ] Pattern matches the tier
- [ ] No over-engineering (saga for reads)
- [ ] No under-engineering (direct call for payments)

### T1 Reviews

- [ ] **Headless hook exists** (not direct adapter call from View)
- [ ] No state management added unnecessarily
- [ ] Adapter returns validated data (Pillar B)
- [ ] Branded types for IDs (Pillar A)

### T2 Reviews

- [ ] Headless hook has no JSX (Pillar L)
- [ ] State uses FSM pattern (Pillar D)
- [ ] Logic is testable without React

### T3 Reviews

- [ ] Idempotency key present and checked
- [ ] Compensation stack implemented
- [ ] All external calls have error handling
- [ ] Saga is resumable after failure

## Common Patterns

### T1: Simple Fetch (with Headless)

```typescript
// headless/useProductData.ts
function useProductData(productId: ProductId) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId),
  });
}

// views/ProductCard.tsx
function ProductCard({ productId }: { productId: ProductId }) {
  const { data } = useProductData(productId);  // ← Via headless
  return <Card>{data?.name}</Card>;
}
```

### T2: Form with Validation

```typescript
// headless/useContactForm.ts
function useContactForm() {
  const [state, dispatch] = useReducer(formReducer, { status: 'editing', ... });

  const submit = async () => {
    if (!validate(state.data)) return;
    dispatch({ type: 'SUBMIT' });
    await submitContact(state.data);
  };

  return { state, submit };
}

// views/ContactForm.tsx
function ContactForm() {
  const { state, submit } = useContactForm();
  // Render only, no logic
}
```

### T3: Payment Saga

```typescript
// workflows/checkoutSaga.ts
async function checkoutSaga(cmd: CheckoutCommand, ctx: Context) {
  // 1. Idempotency
  const cached = await Cache.get(`checkout:${cmd.intentId}`);
  if (cached) return cached;

  // 2. Version check
  const order = await OrderRepo.get(cmd.orderId);
  if (order.version !== cmd.expectedVersion) {
    throw new StaleDataError();
  }

  // 3. Execute with compensation
  const compensations = [];
  try {
    compensations.push(() => refund(txId));
    const txId = await charge(cmd.amount);

    compensations.push(() => restoreStock(cmd.items));
    await reserveStock(cmd.items);

    // ...
  } catch (error) {
    await runCompensations(compensations);
    throw error;
  }
}
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| Saga for GET | Over-engineering | Use T1 direct fetch |
| Direct call for payment | No compensation | Use T3 saga |
| useState for forms | Missing FSM | Use T2 with reducer |
| Logic in View | Hard to test | Move to headless hook |
| Same pattern everywhere | Mismatched complexity | Classify tier first |

## Escalation Signals

When to upgrade tier:

| From | To | Signal |
|------|-----|--------|
| T1 | T2 | Need validation, local state, derived data |
| T2 | T3 | Writing to multiple services, money involved |

## Template Reference

- T1: `.prot/pillar-e/tier1-fetcher.ts`
- T2: `.prot/pillar-e/tier2-headless.ts`
- T3: `.prot/pillar-e/tier3-saga.ts`
