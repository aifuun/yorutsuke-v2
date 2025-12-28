# Pillar Q: Idempotency Checklist

> Use this checklist when implementing T3 (saga) operations that modify state.

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Explicit > Abstract** | Every T3 command explicitly declares intentId field |
| **Copy > Generate** | Copy withIdempotency pattern from template |
| **Verify > Generate** | Audit script checks T3 files for idempotency usage |

## When to Apply

- [ ] Task is classified as **T3** (distributed writes, payments, external API calls)
- [ ] Operation has **side effects** that cannot be safely repeated
- [ ] Failure could result in **duplicate charges/actions**

## Creating New T3 Command

### 1. Define Command Interface

- [ ] Command extends `IdempotentCommand`
- [ ] Has `intentId: IntentId` field
- [ ] Has `expectedVersion: number` for optimistic locking (Pillar F)

```typescript
// ✅ Correct
interface CheckoutCommand extends IdempotentCommand {
  readonly intentId: IntentId;      // Required
  readonly orderId: OrderId;
  readonly expectedVersion: number; // For concurrency
}

// ❌ Wrong: No intentId
interface CheckoutCommand {
  readonly orderId: OrderId;
}
```

### 2. Wrap Saga with Idempotency Barrier

- [ ] Use `withIdempotency()` wrapper at saga entry point
- [ ] All saga logic is INSIDE the barrier
- [ ] Compensations are defined INSIDE the barrier

```typescript
// ✅ Correct
async function checkoutSaga(cmd: CheckoutCommand) {
  return withIdempotency(cache, cmd.intentId, async () => {
    // All logic here
  });
}

// ❌ Wrong: Logic outside barrier
async function checkoutSaga(cmd: CheckoutCommand) {
  await validate(cmd);  // This runs even on cached response!
  return withIdempotency(cache, cmd.intentId, async () => {
    // ...
  });
}
```

### 3. Client-Side Intent Generation

- [ ] IntentId generated ONCE per user action
- [ ] Same intentId reused on retry
- [ ] New intentId after successful completion + new action

```typescript
// ✅ Correct: Hook manages intentId lifecycle
const { execute, reset } = useIdempotentAction(
  (intentId) => api.checkout({ intentId, ...data })
);

// On success, user clicks "New Order" → reset() → new intentId
// On error, user clicks "Retry" → same intentId

// ❌ Wrong: New intentId per request
const handleSubmit = () => {
  api.checkout({ intentId: createIntentId(), ...data });
  // Retry creates duplicate!
}
```

## Code Review Checklist

### Command Layer
- [ ] All T3 commands have `intentId` field
- [ ] IntentId type is branded (not raw string)
- [ ] Command interface is immutable (readonly fields)

### Saga Layer
- [ ] Saga uses `withIdempotency()` wrapper
- [ ] No side effects outside the barrier
- [ ] Cache check happens FIRST
- [ ] Lock acquired BEFORE execution
- [ ] Result stored AFTER success
- [ ] Lock released on failure

### Cache Layer
- [ ] Cache implementation is atomic (Redis SETNX or equivalent)
- [ ] TTL set on processing lock (prevent orphaned locks)
- [ ] TTL set on result cache (cleanup old entries)
- [ ] PROCESSING marker distinguishes in-flight from completed

### Client Layer
- [ ] UI uses `useIdempotentAction` hook or equivalent
- [ ] Retry button sends same intentId
- [ ] Success triggers reset for new action
- [ ] Loading state disables submit button

## Common Patterns

### 1. Simple T3 Saga

```typescript
async function transferSaga(cmd: TransferCommand) {
  return withIdempotency(cache, cmd.intentId, async () => {
    const compensations: Compensation[] = [];

    // Debit source
    compensations.push(() => credit(cmd.fromAccount, cmd.amount));
    await debit(cmd.fromAccount, cmd.amount);

    // Credit destination
    compensations.push(() => debit(cmd.toAccount, cmd.amount));
    await credit(cmd.toAccount, cmd.amount);

    return { success: true };
  });
}
```

### 2. With External API

```typescript
async function paymentSaga(cmd: PaymentCommand) {
  return withIdempotency(cache, cmd.intentId, async () => {
    // Pass intentId to external API as idempotency key
    const result = await stripe.charges.create(
      { amount: cmd.amount },
      { idempotencyKey: cmd.intentId }  // Stripe's built-in support
    );

    await orderRepo.markPaid(cmd.orderId, result.id);
    return { transactionId: result.id };
  });
}
```

### 3. React Form

```tsx
function CheckoutForm() {
  const { execute, state, canRetry, reset } = useIdempotentAction(
    (intentId) => api.checkout({ intentId, ...formData })
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); execute(); }}>
      {/* form fields */}
      <button type="submit" disabled={state === 'loading'}>
        {canRetry ? 'Retry Payment' : 'Pay Now'}
      </button>
      {state === 'success' && (
        <button type="button" onClick={reset}>
          New Order
        </button>
      )}
    </form>
  );
}
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| `intentId: string` | No type safety | Use branded `IntentId` type |
| New intentId per request | Retry creates duplicate | Generate once, reuse on retry |
| `if (processed) return` | Race condition | Use atomic SETNX |
| No TTL on lock | Orphaned lock blocks retries | Set lock TTL (e.g., 300s) |
| No cache on success | Retry re-executes | Store result after success |
| Logic outside barrier | Runs even on cache hit | Move ALL logic inside |
| UI disable only | Page refresh bypasses | Server-side check required |

## Anti-Patterns to Catch

```typescript
// ❌ 1. No idempotency at all
async function processPayment(cmd) {
  return stripe.charge(cmd.amount);  // Double charge on retry!
}

// ❌ 2. Check-then-act (race condition)
async function processPayment(cmd) {
  const order = await db.get(cmd.orderId);
  if (order.paid) return;  // Gap between check and update!
  await stripe.charge();
  order.paid = true;
}

// ❌ 3. Request-scoped ID
async function processPayment(cmd) {
  const requestId = generateId();  // Different ID each request!
  await checkIdempotency(requestId);
}

// ❌ 4. Missing result cache
async function processPayment(cmd) {
  const cached = await cache.get(cmd.intentId);
  if (cached) return cached;
  const result = await execute();
  // Forgot to cache! Next request re-executes
  return result;
}
```

## Template Reference

Copy from: `.prot/pillar-q/idempotency.ts`

Key exports:
- `IntentId` - Branded type
- `createIntentId()` - Generate new ID
- `withIdempotency()` - Barrier wrapper
- `IdempotencyCache` - Interface
- `RedisIdempotencyCache` - Production implementation
- `InMemoryIdempotencyCache` - Test implementation
- `useIdempotentAction()` - React hook
