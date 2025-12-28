/**
 * Pillar M: Temporal Integrity (Saga Pattern) Template
 *
 * Every saga step must define a compensating action.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - EVERY step MUST have a compensation
 * - Push compensation BEFORE executing step
 * - Execute compensations in REVERSE order (LIFO)
 * - Log compensation failures as CRITICAL
 * - Never swallow compensation errors silently
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Compensation function - undoes one step.
 */
export type Compensation = () => Promise<void>;

/**
 * Single saga step definition.
 */
export interface SagaStep<TResult = unknown> {
  /** Step name for logging */
  readonly name: string;
  /** Execute the step */
  execute: () => Promise<TResult>;
  /** Undo the step (compensation) */
  compensate: Compensation;
}

/**
 * Saga execution context.
 */
export interface SagaContext {
  readonly sagaName: string;
  readonly traceId: string;
  readonly intentId?: string;
}

/**
 * Saga execution result.
 */
export interface SagaResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: Error;
  readonly completedSteps: string[];
}

/**
 * Saga status for state machine tracking.
 */
export type SagaStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'compensating'
  | 'failed'
  | 'compensation_failed';

/**
 * Persisted saga state for recovery.
 */
export interface SagaState {
  readonly status: SagaStatus;
  readonly completedSteps: string[];
  readonly currentStep: string | null;
  readonly error: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Error from saga step failure.
 */
export class SagaStepError extends Error {
  constructor(
    public readonly sagaName: string,
    public readonly stepName: string,
    public readonly cause: Error
  ) {
    super(`Saga ${sagaName} failed at step ${stepName}: ${cause.message}`);
    this.name = 'SagaStepError';
  }
}

/**
 * Critical error when compensation fails.
 * Requires manual intervention.
 */
export class CompensationFailedError extends Error {
  constructor(
    public readonly sagaName: string,
    public readonly stepName: string,
    public readonly cause: Error,
    public readonly remainingCompensations: number
  ) {
    super(
      `CRITICAL: Compensation failed for ${sagaName}.${stepName}. ` +
      `${remainingCompensations} compensations remaining. Manual intervention required.`
    );
    this.name = 'CompensationFailedError';
  }
}

// =============================================================================
// LOGGER INTERFACE
// =============================================================================

/**
 * Structured logger for saga events.
 * Implement with your logging infrastructure.
 */
export interface SagaLogger {
  json(event: string, data: Record<string, unknown>): void;
  critical(event: string, data: Record<string, unknown>): void;
}

// Default console logger
const defaultLogger: SagaLogger = {
  json: (event, data) => console.log(JSON.stringify({ event, ...data, ts: new Date().toISOString() })),
  critical: (event, data) => console.error(JSON.stringify({ event, level: 'CRITICAL', ...data, ts: new Date().toISOString() })),
};

// =============================================================================
// SAGA EXECUTOR
// =============================================================================

/**
 * Execute a saga with automatic compensation on failure.
 *
 * ⚠️ AI NOTE: This is the core saga pattern. Use this for all T3 workflows.
 *
 * @example
 * ```typescript
 * const result = await executeSaga(
 *   [
 *     {
 *       name: 'RESERVE_INVENTORY',
 *       execute: async () => inventoryAdapter.reserve(items),
 *       compensate: async () => inventoryAdapter.release(reservationId),
 *     },
 *     {
 *       name: 'CHARGE_PAYMENT',
 *       execute: async () => paymentAdapter.charge(amount),
 *       compensate: async () => paymentAdapter.refund(txId),
 *     },
 *   ],
 *   { sagaName: 'Checkout', traceId: ctx.traceId }
 * );
 * ```
 */
export async function executeSaga<T>(
  steps: SagaStep[],
  ctx: SagaContext,
  options: { logger?: SagaLogger } = {}
): Promise<SagaResult<T>> {
  const logger = options.logger ?? defaultLogger;
  const completedCompensations: Compensation[] = [];
  const completedSteps: string[] = [];

  logger.json('SAGA_START', {
    saga: ctx.sagaName,
    traceId: ctx.traceId,
    stepCount: steps.length,
  });

  try {
    for (const step of steps) {
      logger.json('SAGA_STEP_START', {
        saga: ctx.sagaName,
        step: step.name,
        traceId: ctx.traceId,
      });

      // ⚠️ CRITICAL: Push compensation BEFORE executing
      // This ensures compensation exists even if step partially completes
      completedCompensations.push(step.compensate);

      await step.execute();

      completedSteps.push(step.name);

      logger.json('SAGA_STEP_COMPLETE', {
        saga: ctx.sagaName,
        step: step.name,
        traceId: ctx.traceId,
      });
    }

    logger.json('SAGA_COMPLETE', {
      saga: ctx.sagaName,
      traceId: ctx.traceId,
      steps: completedSteps,
    });

    return {
      success: true,
      completedSteps,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.json('SAGA_FAILURE', {
      saga: ctx.sagaName,
      traceId: ctx.traceId,
      error: err.message,
      completedSteps,
      failedStep: steps[completedSteps.length]?.name,
    });

    // Execute compensations in reverse order
    await executeCompensations(completedCompensations, ctx, { logger });

    return {
      success: false,
      error: err,
      completedSteps,
    };
  }
}

/**
 * Execute compensations in reverse order (LIFO).
 *
 * ⚠️ AI NOTE:
 * - Continue even if one compensation fails
 * - Log failures as CRITICAL
 * - Manual intervention required for failed compensations
 */
export async function executeCompensations(
  compensations: Compensation[],
  ctx: SagaContext,
  options: { logger?: SagaLogger } = {}
): Promise<void> {
  const logger = options.logger ?? defaultLogger;
  let compensationIndex = compensations.length;

  logger.json('SAGA_COMPENSATING', {
    saga: ctx.sagaName,
    traceId: ctx.traceId,
    compensationCount: compensations.length,
  });

  // Execute in reverse order (LIFO)
  while (compensations.length > 0) {
    const compensate = compensations.pop()!;
    compensationIndex--;

    try {
      await compensate();

      logger.json('COMPENSATION_SUCCESS', {
        saga: ctx.sagaName,
        traceId: ctx.traceId,
        index: compensationIndex,
      });
    } catch (compError) {
      const err = compError instanceof Error ? compError : new Error(String(compError));

      // CRITICAL: Compensation failed - requires manual intervention
      logger.critical('COMPENSATION_FAILED', {
        saga: ctx.sagaName,
        traceId: ctx.traceId,
        index: compensationIndex,
        error: err.message,
        remainingCompensations: compensations.length,
      });

      // Continue with remaining compensations
      // Don't throw - we want to try all compensations
    }
  }

  logger.json('SAGA_COMPENSATION_COMPLETE', {
    saga: ctx.sagaName,
    traceId: ctx.traceId,
  });
}

// =============================================================================
// INLINE SAGA PATTERN
// =============================================================================

/**
 * Inline saga pattern for simpler cases.
 *
 * ⚠️ AI NOTE: Use this when steps have dynamic compensation based on results.
 *
 * @example
 * ```typescript
 * async function transferFunds(cmd: TransferCommand, ctx: Context) {
 *   const compensations: Compensation[] = [];
 *
 *   try {
 *     // Step 1: Debit
 *     compensations.push(() => ledger.reverseDebit(debitTxId));
 *     const debitTxId = await ledger.debit(cmd.fromAccount, cmd.amount);
 *
 *     // Step 2: Credit
 *     compensations.push(() => ledger.reverseCredit(creditTxId));
 *     const creditTxId = await ledger.credit(cmd.toAccount, cmd.amount);
 *
 *     return { success: true, debitTxId, creditTxId };
 *   } catch (error) {
 *     await runCompensations(compensations);
 *     throw error;
 *   }
 * }
 * ```
 */
export async function runCompensations(compensations: Compensation[]): Promise<void> {
  while (compensations.length > 0) {
    const compensate = compensations.pop()!;
    try {
      await compensate();
    } catch (error) {
      console.error('Compensation failed:', error);
      // Continue with remaining
    }
  }
}

// =============================================================================
// EXAMPLE SAGA IMPLEMENTATION
// =============================================================================

/*
⚠️ AI: Copy this pattern for T3 checkout/payment sagas:

```typescript
// workflows/checkoutSaga.ts

import { executeSaga, SagaContext, SagaStep } from '@/pillar-m/saga';
import { withIdempotency } from '@/pillar-q/idempotency';

interface CheckoutCommand {
  intentId: IntentId;
  orderId: OrderId;
  userId: UserId;
  items: CartItem[];
  amount: Money;
}

export async function checkoutSaga(
  cmd: CheckoutCommand,
  ctx: Context,
  deps: {
    inventory: InventoryAdapter;
    payment: PaymentAdapter;
    orders: OrderRepository;
    notifications: NotificationAdapter;
    idempotencyCache: IdempotencyCache;
  }
): Promise<CheckoutResult> {
  // Pillar Q: Idempotency barrier
  return withIdempotency(deps.idempotencyCache, cmd.intentId, async () => {
    // Mutable state to capture step results
    let reservationId: string | undefined;
    let paymentTxId: string | undefined;

    const sagaCtx: SagaContext = {
      sagaName: 'Checkout',
      traceId: ctx.traceId,
      intentId: cmd.intentId,
    };

    const steps: SagaStep[] = [
      {
        name: 'RESERVE_INVENTORY',
        execute: async () => {
          reservationId = await deps.inventory.reserve(cmd.items);
        },
        compensate: async () => {
          if (reservationId) {
            await deps.inventory.release(reservationId);
          }
        },
      },
      {
        name: 'CHARGE_PAYMENT',
        execute: async () => {
          paymentTxId = await deps.payment.charge({
            amount: cmd.amount,
            userId: cmd.userId,
            idempotencyKey: cmd.intentId,  // External idempotency
          });
        },
        compensate: async () => {
          if (paymentTxId) {
            await deps.payment.refund(paymentTxId);
          }
        },
      },
      {
        name: 'CREATE_ORDER',
        execute: async () => {
          await deps.orders.create({
            id: cmd.orderId,
            userId: cmd.userId,
            items: cmd.items,
            paymentTxId,
            status: 'confirmed',
          });
        },
        compensate: async () => {
          await deps.orders.updateStatus(cmd.orderId, 'cancelled');
        },
      },
      {
        name: 'SEND_NOTIFICATION',
        execute: async () => {
          await deps.notifications.sendOrderConfirmation(cmd.orderId);
        },
        compensate: async () => {
          // Best effort - no compensation needed
          // Or send cancellation notice
        },
      },
    ];

    const result = await executeSaga(steps, sagaCtx);

    if (!result.success) {
      throw result.error;
    }

    return {
      success: true,
      orderId: cmd.orderId,
      paymentTxId,
    };
  });
}
```
*/

// =============================================================================
// COMPENSATION PATTERNS
// =============================================================================

/*
Common compensation patterns:

1. **Reverse operation**
   execute: () => ledger.debit(account, amount)
   compensate: () => ledger.credit(account, amount)

2. **Status change**
   execute: () => order.setStatus('confirmed')
   compensate: () => order.setStatus('cancelled')

3. **Soft delete**
   execute: () => record.create(data)
   compensate: () => record.softDelete(id)

4. **External API refund**
   execute: () => stripe.charge(amount)
   compensate: () => stripe.refund(chargeId)

5. **Best effort (no-op)**
   execute: () => email.send(confirmation)
   compensate: async () => {} // or send cancellation

6. **Conditional compensation**
   compensate: async () => {
     if (resourceId) {
       await resource.release(resourceId);
     }
   }
*/

// =============================================================================
// EXPORTS
// =============================================================================

export {
  defaultLogger,
};
