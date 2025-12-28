# Pillar M: Temporal Integrity (Saga Pattern)

> Every saga step must define a compensating action

## Rule

Every step in a Tier 3 workflow must define a **Compensating Action** (undo). If step N fails, the system must undo steps N-1...1.

## Purpose

- Ensure atomicity across distributed systems
- Provide rollback capability for partial failures
- Maintain data consistency without distributed transactions
- Clear recovery path for every operation

## Implementation

### Compensation Stack Pattern

```typescript
type Compensation = () => Promise<void>;

async function executeSaga<T>(
  steps: Array<{
    execute: () => Promise<unknown>;
    compensate: () => Promise<void>;
    name: string;
  }>,
  ctx: SagaContext
): Promise<T> {
  const completedCompensations: Compensation[] = [];

  try {
    for (const step of steps) {
      logger.json('SAGA_STEP_START', {
        saga: ctx.sagaName,
        step: step.name,
        traceId: ctx.traceId,
      });

      // Push compensation BEFORE executing
      completedCompensations.push(step.compensate);

      await step.execute();

      logger.json('SAGA_STEP_COMPLETE', {
        saga: ctx.sagaName,
        step: step.name,
        traceId: ctx.traceId,
      });
    }

    return { success: true } as T;
  } catch (error) {
    logger.json('SAGA_FAILURE', {
      saga: ctx.sagaName,
      error: error.message,
      traceId: ctx.traceId,
    });

    // Execute compensations in reverse order
    await executeCompensations(completedCompensations, ctx);

    throw error;
  }
}

async function executeCompensations(
  compensations: Compensation[],
  ctx: SagaContext
): Promise<void> {
  while (compensations.length > 0) {
    const compensate = compensations.pop()!;

    try {
      await compensate();
    } catch (compError) {
      // CRITICAL: Compensation failed
      logger.critical('COMPENSATION_FAILED', {
        saga: ctx.sagaName,
        traceId: ctx.traceId,
        error: compError.message,
        remainingCompensations: compensations.length,
      });

      // Alert for manual intervention
      await alertOps({
        level: 'CRITICAL',
        message: 'Saga compensation failed - manual intervention required',
        context: ctx,
      });

      // Continue with remaining compensations
    }
  }
}
```

### Saga Definition

```typescript
// workflows/checkoutSaga.ts

interface CheckoutSagaContext extends SagaContext {
  orderId: OrderId;
  userId: UserId;
  amount: Money;
  items: OrderItem[];
}

async function checkoutSaga(cmd: CheckoutCommand, ctx: CheckoutSagaContext) {
  let paymentTxId: string | undefined;
  let inventoryReservationId: string | undefined;

  const steps = [
    {
      name: 'RESERVE_INVENTORY',
      execute: async () => {
        inventoryReservationId = await inventoryAdapter.reserve(ctx.items);
      },
      compensate: async () => {
        if (inventoryReservationId) {
          await inventoryAdapter.release(inventoryReservationId);
        }
      },
    },
    {
      name: 'CHARGE_PAYMENT',
      execute: async () => {
        paymentTxId = await paymentAdapter.charge(ctx.amount, ctx.userId);
      },
      compensate: async () => {
        if (paymentTxId) {
          await paymentAdapter.refund(paymentTxId);
        }
      },
    },
    {
      name: 'CREATE_ORDER',
      execute: async () => {
        await orderRepo.create({
          id: ctx.orderId,
          userId: ctx.userId,
          items: ctx.items,
          paymentTxId,
          status: 'confirmed',
        });
      },
      compensate: async () => {
        await orderRepo.update(ctx.orderId, { status: 'cancelled' });
      },
    },
    {
      name: 'SEND_CONFIRMATION',
      execute: async () => {
        await notificationAdapter.sendOrderConfirmation(ctx.orderId);
      },
      compensate: async () => {
        // Notification is best-effort, no compensation needed
        // Or send cancellation email
      },
    },
  ];

  return executeSaga(steps, { ...ctx, sagaName: 'Checkout' });
}
```

### State Machine for Saga

```typescript
type SagaStatus =
  | 'pending'
  | 'inventory_reserved'
  | 'payment_charged'
  | 'order_created'
  | 'completed'
  | 'compensating'
  | 'failed'
  | 'compensation_failed';

interface SagaState {
  status: SagaStatus;
  completedSteps: string[];
  currentStep: string | null;
  error: string | null;
}
```

## Good Example

```typescript
// ✅ Complete compensation for each step

async function transferFunds(cmd: TransferCommand, ctx: Context) {
  let debitTxId: string | undefined;
  let creditTxId: string | undefined;

  const compensations: Compensation[] = [];

  try {
    // Step 1: Debit source account
    compensations.push(async () => {
      if (debitTxId) {
        await ledger.reverseDebit(debitTxId);
      }
    });
    debitTxId = await ledger.debit(cmd.fromAccount, cmd.amount);

    // Step 2: Credit destination account
    compensations.push(async () => {
      if (creditTxId) {
        await ledger.reverseCredit(creditTxId);
      }
    });
    creditTxId = await ledger.credit(cmd.toAccount, cmd.amount);

    // Step 3: Record transfer
    compensations.push(async () => {
      await transfers.markFailed(cmd.transferId);
    });
    await transfers.record({
      id: cmd.transferId,
      debitTxId,
      creditTxId,
      status: 'completed',
    });

    return { success: true };
  } catch (error) {
    // Rollback in reverse order
    while (compensations.length) {
      await compensations.pop()!();
    }
    throw error;
  }
}
```

## Bad Example

```typescript
// ❌ No compensation - partial state on failure
async function checkout(cmd) {
  await inventory.reserve(cmd.items);     // Reserved...
  await payment.charge(cmd.amount);       // Fails here!
  // Inventory still reserved! No rollback!
  await order.create(cmd);
}

// ❌ Incomplete compensation
async function checkout(cmd) {
  try {
    await inventory.reserve(cmd.items);
    await payment.charge(cmd.amount);
    await order.create(cmd);
  } catch (error) {
    // Only compensates last step
    await order.cancel(cmd.orderId);
    // Inventory? Payment? Still in bad state!
  }
}
```

## Anti-Patterns

1. **Missing compensation definition**
   ```typescript
   // ❌ What happens if this fails after step 2?
   await step1();
   await step2();
   await step3();  // Fails
   ```

2. **Compensation that can fail silently**
   ```typescript
   // ❌ Swallowing compensation errors
   try {
     await compensate();
   } catch (e) {
     // Silent failure!
   }
   ```

3. **Wrong compensation order**
   ```typescript
   // ❌ Must be LIFO (reverse order)
   for (const comp of compensations) {
     await comp();  // Should use pop()
   }
   ```

4. **Async compensation without waiting**
   ```typescript
   // ❌ Fire and forget
   compensations.forEach(c => c());  // Not awaited!
   ```

## Exceptions

- Best-effort steps (notifications) may have no-op compensation
- Idempotent operations that are safe to repeat

## Checklist

- [ ] Every saga step has defined compensation
- [ ] Compensations execute in reverse order (LIFO)
- [ ] Compensation failures are logged as CRITICAL
- [ ] Manual intervention path documented
- [ ] Saga state persisted for recovery
- [ ] State machine tracks progress

## References

- Related: Pillar Q (Idempotency) - prevent re-execution
- Related: Pillar F (Concurrency) - version checks
- Related: Pillar R (Observability) - saga logging
- Template: `.prot/pillar-m/saga.ts`
- Checklist: `.prot/pillar-m/checklist.md`
