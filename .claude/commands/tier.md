# Tier Classification Command

Classify task complexity according to AI_DEV_PROT v15.

## When to Use

**Run `*tier` when task involves**:
- ✅ Data writes / mutations
- ✅ State management (forms, wizards)
- ✅ Critical operations (payment, sync)

**Skip for**:
- ❌ Pure UI changes (styling, layout)
- ❌ Text/content updates
- ❌ Simple bug fixes (no state changes)

**Special Cases**:
- **Bug fix with state**: Classify based on fix scope (T1 if read-only, T2 if local state, T3 if distributed)
- **Refactoring**: Usually skip unless changing state patterns (e.g., adding FSM)

## Prerequisites

Read before executing:
- `.prot/CHEATSHEET.md` - Tier classification reference

## Input

Task description from context (current issue or user request).

## Process

1. Read `.prot/CHEATSHEET.md` Tier Classification section
2. Analyze the task requirements
3. Classify into Tier 1/2/3
4. Identify relevant Pillars
5. Recommend Templates
6. Output recommended pattern

## Classification Criteria

### Tier 1: Direct
- Simple data fetch and display
- No local state management
- No data mutations
- **Pillars**: A, I, L
- Example: "Display user profile", "Show settings page"

### Tier 2: Logic
- Form validation
- Local state management (FSM)
- Optimistic UI updates
- Computed/derived values
- **Pillars**: A, D, I, J, L
- Example: "Add to cart", "Filter search results", "Form wizard"

### Tier 3: Saga
- Distributed writes (multiple services)
- Payment processing
- File synchronization
- Critical data consistency required
- **Pillars**: A, B, D, E, F, Q, M, N, R (all critical)
- Example: "Checkout flow", "Multi-file upload", "Account deletion"

## Output Format

```markdown
## Task Classification

**Task**: [Description]
**Tier**: T[1/2/3] - [Direct/Logic/Saga]

### Pillars
| Pillar | Rule | Template |
|--------|------|----------|
| A | Branded Types for IDs | `.prot/pillar-a/branded.ts` |
| D | FSM over boolean flags | `.prot/pillar-d/fsm-reducer.ts` |
| L | Headless separation | `.prot/pillar-l/headless.ts` |

### Pattern
[Recommended architectural pattern]

### Pre-Code Checklist
- [ ] Key check from pre-code.md
- [ ] Key check from pre-code.md

### Files to Create/Modify
| File | Template |
|------|----------|
| `src/.../headless/useXxx.ts` | pillar-l/headless.ts |
| `src/.../adapters/xxxApi.ts` | pillar-b/airlock.ts |
```

## Example Output

```markdown
## Task Classification

**Task**: Implement checkout with Stripe payment
**Tier**: T3 - Saga

### Pillars
| Pillar | Rule | Template |
|--------|------|----------|
| Q | Intent-ID for idempotency | `.prot/pillar-q/idempotency.ts` |
| F | Version check before write | - |
| M | Compensation for each step | `.prot/pillar-m/saga.ts` |
| R | Semantic JSON logging | - |

### Pattern
`View → SagaManager → [PaymentAdapter, InventoryAdapter, NotificationAdapter]`

### Pre-Code Checklist
- [ ] Define Intent-ID generation strategy
- [ ] Plan compensation for each step
- [ ] Identify version-checked entities

### Files to Create/Modify
| File | Template |
|------|----------|
| `src/02_modules/checkout/workflows/checkoutSaga.ts` | pillar-m/saga.ts |
| `src/02_modules/checkout/adapters/stripeAdapter.ts` | pillar-b/airlock.ts |
| `src/02_modules/checkout/headless/useCheckout.ts` | pillar-l/headless.ts |
| `src/02_modules/checkout/views/CheckoutView.tsx` | - |
```

## After Classification

1. Load pre-code checklist: @.prot/checklists/pre-code.md
2. Copy relevant templates from `.prot/pillar-*/`
3. Create TODO.md breakdown with pillar references
