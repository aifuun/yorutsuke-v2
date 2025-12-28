# Pillar M: Saga Pattern Checklist

> Use this checklist when implementing T3 multi-step workflows.

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Explicit > Abstract** | Every step explicitly defines its compensation |
| **Copy > Generate** | Copy saga pattern from template |
| **Clear > DRY** | Each step has its own compensation, even if similar |

## When to Apply

- [ ] Operation spans multiple services/resources
- [ ] Partial failure would leave system in bad state
- [ ] Need to undo completed steps on failure
- [ ] Task is classified as **T3** (Saga)

## Creating New Saga

### 1. Define Steps with Compensations

- [ ] Every step has `execute` function
- [ ] Every step has `compensate` function
- [ ] Step names are descriptive (for logging)
- [ ] Compensation handles partial execution

```typescript
// ✅ Correct: Every step has compensation
const steps: SagaStep[] = [
  {
    name: 'RESERVE_INVENTORY',
    execute: async () => { reservationId = await inventory.reserve(items); },
    compensate: async () => {
      if (reservationId) await inventory.release(reservationId);
    },
  },
  {
    name: 'CHARGE_PAYMENT',
    execute: async () => { txId = await payment.charge(amount); },
    compensate: async () => {
      if (txId) await payment.refund(txId);
    },
  },
];

// ❌ Wrong: Steps without compensation
await inventory.reserve(items);  // What if payment fails?
await payment.charge(amount);
```

### 2. Compensation Order (LIFO)

- [ ] Push compensation BEFORE executing step
- [ ] Compensations run in REVERSE order
- [ ] Use stack (pop), not queue (shift)

```typescript
// ✅ Correct: LIFO order
const compensations: Compensation[] = [];

// Step 1
compensations.push(() => undoStep1());  // Push first
await step1();

// Step 2
compensations.push(() => undoStep2());  // Push second
await step2();

// On failure: undoStep2() runs first, then undoStep1()
while (compensations.length) {
  await compensations.pop()();  // LIFO
}
```

### 3. Handle Compensation Failures

- [ ] Log compensation failures as CRITICAL
- [ ] Continue with remaining compensations
- [ ] Don't throw - try all compensations
- [ ] Alert for manual intervention

```typescript
// ✅ Correct: Continue on compensation failure
while (compensations.length) {
  const compensate = compensations.pop()!;
  try {
    await compensate();
  } catch (error) {
    logger.critical('COMPENSATION_FAILED', {
      error: error.message,
      remaining: compensations.length,
    });
    // Continue with remaining - don't throw
  }
}
```

### 4. Integrate with Idempotency (Pillar Q)

- [ ] Wrap saga with `withIdempotency()`
- [ ] Use same `intentId` for retry
- [ ] Cached result returns without re-executing

```typescript
export async function checkoutSaga(cmd, ctx, deps) {
  // Pillar Q: Idempotency wraps entire saga
  return withIdempotency(deps.cache, cmd.intentId, async () => {
    const steps = [/* ... */];
    return executeSaga(steps, ctx);
  });
}
```

## Code Review Checklist

### Step Definition
- [ ] Every step has named `execute` and `compensate`
- [ ] Compensation checks for undefined (partial execution)
- [ ] Step names are SCREAMING_CASE for logs

### Compensation Logic
- [ ] Compensations are idempotent
- [ ] Compensations handle resource not existing
- [ ] Best-effort steps have empty compensation (documented)

### Error Handling
- [ ] Saga step failures are logged
- [ ] Compensation failures are logged as CRITICAL
- [ ] Original error is preserved and thrown
- [ ] Manual intervention path documented

### Integration
- [ ] Saga wrapped with idempotency (Pillar Q)
- [ ] Version check before saga (Pillar F)
- [ ] Structured logging (Pillar R)

## Common Patterns

### 1. Simple Saga with executeSaga

```typescript
async function transferSaga(cmd: TransferCommand, ctx: Context) {
  let debitTxId: string | undefined;
  let creditTxId: string | undefined;

  const steps: SagaStep[] = [
    {
      name: 'DEBIT_SOURCE',
      execute: async () => {
        debitTxId = await ledger.debit(cmd.fromAccount, cmd.amount);
      },
      compensate: async () => {
        if (debitTxId) await ledger.reverseDebit(debitTxId);
      },
    },
    {
      name: 'CREDIT_DESTINATION',
      execute: async () => {
        creditTxId = await ledger.credit(cmd.toAccount, cmd.amount);
      },
      compensate: async () => {
        if (creditTxId) await ledger.reverseCredit(creditTxId);
      },
    },
  ];

  return executeSaga(steps, { sagaName: 'Transfer', traceId: ctx.traceId });
}
```

### 2. Inline Compensation Stack

```typescript
async function orderSaga(cmd: OrderCommand, ctx: Context) {
  const compensations: Compensation[] = [];

  try {
    // Step 1
    compensations.push(() => inventory.release(reservationId));
    const reservationId = await inventory.reserve(cmd.items);

    // Step 2
    compensations.push(() => payment.refund(txId));
    const txId = await payment.charge(cmd.amount);

    // Step 3
    compensations.push(() => orders.cancel(orderId));
    const orderId = await orders.create(cmd);

    return { success: true, orderId };
  } catch (error) {
    await runCompensations(compensations);
    throw error;
  }
}
```

### 3. External API with Idempotency Key

```typescript
{
  name: 'STRIPE_CHARGE',
  execute: async () => {
    chargeId = await stripe.charges.create(
      { amount: cmd.amount },
      { idempotencyKey: cmd.intentId }  // External idempotency
    );
  },
  compensate: async () => {
    if (chargeId) {
      await stripe.refunds.create({ charge: chargeId });
    }
  },
}
```

### 4. Best-Effort Step (No Compensation)

```typescript
{
  name: 'SEND_NOTIFICATION',
  execute: async () => {
    await notifications.sendConfirmation(orderId);
  },
  compensate: async () => {
    // Best effort - notification is not critical
    // Optionally send cancellation notice
  },
}
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| No compensation | Partial state on failure | Add compensation to every step |
| Wrong order (FIFO) | Incomplete rollback | Use LIFO (pop not shift) |
| Swallowing comp errors | Silent data corruption | Log as CRITICAL, continue |
| Undefined check missing | Error in compensation | Check `if (resourceId)` |
| No idempotency | Duplicate execution | Wrap with Pillar Q |
| Fire-and-forget comp | Race conditions | Always await compensations |

## Anti-Patterns

```typescript
// ❌ 1. No compensation defined
await step1();
await step2();  // Fails - step1 still committed

// ❌ 2. Wrong order
for (const comp of compensations) {  // FIFO - wrong!
  await comp();
}

// ❌ 3. Silent failure
try {
  await compensate();
} catch (e) {}  // Silent!

// ❌ 4. Not awaiting
compensations.forEach(c => c());  // Not awaited!

// ❌ 5. Throwing on comp failure
try {
  await compensate();
} catch (e) {
  throw e;  // Stops remaining compensations!
}
```

## Compensation Decision Tree

```
Step executed successfully?
├─ NO → Skip compensation (nothing to undo)
└─ YES
   └─ Step has side effect?
      ├─ NO → No-op compensation OK
      └─ YES
         └─ Side effect is reversible?
            ├─ YES → Implement reverse operation
            └─ NO → Mark as failed, alert for manual fix
```

## Template Reference

Copy from: `.prot/pillar-m/saga.ts`

Key exports:
- `SagaStep` - Step interface
- `SagaContext` - Context interface
- `Compensation` - Compensation type
- `executeSaga()` - Main executor
- `executeCompensations()` - Compensation runner
- `runCompensations()` - Inline helper
