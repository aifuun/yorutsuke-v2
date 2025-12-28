/**
 * Tier 3: Saga Template
 * Pattern: View → Saga Manager → [Adapters]
 *
 * Use for: Distributed writes, payments, critical operations
 * Pillars: Q (Idempotency), F (Concurrency), M (Saga), R (Observability)
 *
 * CRITICAL: All checks must be present!
 *
 * ============================================
 * ⚠️ AI GUIDANCE: INLINE vs STRUCTURED SAGA (BUG-001)
 * ============================================
 *
 * This template uses INLINE compensation pattern.
 * Pillar M provides STRUCTURED `executeSaga()` pattern.
 *
 * WHEN TO USE EACH:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ INLINE (this file)                                         │
 * │ - Compensation needs step result (e.g., refund(txId))      │
 * │ - Steps have dynamic dependencies                          │
 * │ - More control over compensation logic                     │
 * ├─────────────────────────────────────────────────────────────┤
 * │ STRUCTURED (Pillar M: executeSaga)                         │
 * │ - Steps are independent and pre-defined                    │
 * │ - Compensation doesn't need step results                   │
 * │ - Cleaner, more declarative code                           │
 * └─────────────────────────────────────────────────────────────┘
 *
 * EXAMPLE DECISION:
 * - Payment saga → INLINE (refund needs transactionId from charge)
 * - User onboarding → STRUCTURED (steps are independent)
 *
 * SEE ALSO: `.prot/pillar-m/saga.ts` for structured pattern
 */

// ============================================
// Types (Pillar A)
// ============================================

type OrderId = string & { readonly __brand: 'OrderId' };
type IntentId = string & { readonly __brand: 'IntentId' };

interface Order {
  id: OrderId;
  version: number;  // For optimistic locking (Pillar F)
  status: OrderStatus;
  amount: number;
}

type OrderStatus =
  | 'pending'
  | 'processing'
  | 'charged'
  | 'fulfilled'
  | 'failed'
  | 'compensating';

interface CheckoutCommand {
  intentId: IntentId;        // Pillar Q: Idempotency
  orderId: OrderId;
  expectedVersion: number;   // Pillar F: Concurrency
  amount: number;
}

interface SagaResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// ============================================
// Context (Pillar N)
// ============================================

interface SagaContext {
  traceId: string;
  userId: string;
  startTime: Date;
}

// ============================================
// Logger (Pillar R: Semantic Observability)
// ============================================

const logger = {
  transition(ctx: SagaContext, saga: string, from: string, to: string, intentId: string) {
    console.log(JSON.stringify({
      event: 'STATE_TRANSITION',
      saga,
      traceId: ctx.traceId,
      intentId,
      from,
      to,
      timestamp: new Date().toISOString(),
    }));
  },

  critical(ctx: SagaContext, message: string, data: Record<string, unknown>) {
    console.error(JSON.stringify({
      event: 'CRITICAL_INCONSISTENCY',
      traceId: ctx.traceId,
      message,
      ...data,
      timestamp: new Date().toISOString(),
    }));
  },
};

// ============================================
// Mock Services (Replace with real adapters)
// ============================================

const Cache = {
  async get(key: string): Promise<SagaResult | null> {
    // Redis/DynamoDB in production
    return null;
  },
  async set(key: string, value: SagaResult): Promise<void> {
    // Redis/DynamoDB in production
  },
};

const OrderRepo = {
  async get(id: OrderId): Promise<Order> {
    // Database call
    return {} as Order;
  },
  async save(order: Order): Promise<void> {
    // Database call
  },
};

const PaymentAdapter = {
  async charge(amount: number): Promise<string> {
    // Stripe/Payment API
    return 'tx_123';
  },
  async refund(txId: string): Promise<void> {
    // Refund API
  },
};

const NotificationAdapter = {
  async sendConfirmation(orderId: OrderId): Promise<void> {
    // Email/SMS
  },
};

// ============================================
// Saga Implementation
// ============================================

async function processCheckout(
  cmd: CheckoutCommand,
  ctx: SagaContext
): Promise<SagaResult> {

  // ========================================
  // Step 1: IDEMPOTENCY BARRIER (Pillar Q)
  // ========================================
  const cached = await Cache.get(`intent:${cmd.intentId}`);
  if (cached) {
    logger.transition(ctx, 'Checkout', 'entry', 'cached', cmd.intentId);
    return cached;
  }

  // ========================================
  // Step 2: OPTIMISTIC LOCKING (Pillar F)
  // ========================================
  const order = await OrderRepo.get(cmd.orderId);
  if (order.version !== cmd.expectedVersion) {
    logger.transition(ctx, 'Checkout', 'entry', 'stale', cmd.intentId);
    return {
      success: false,
      error: 'StaleDataError: Order was modified. Please refresh.',
    };
  }

  // ========================================
  // Step 3: SAGA EXECUTION (Pillar M)
  // ========================================
  const compensations: Array<() => Promise<void>> = [];
  let transactionId: string | undefined;

  try {
    logger.transition(ctx, 'Checkout', 'pending', 'processing', cmd.intentId);

    // --- Step 3.1: Charge Payment ---
    // Push compensation BEFORE action
    compensations.push(async () => {
      if (transactionId) {
        await PaymentAdapter.refund(transactionId);
      }
    });
    transactionId = await PaymentAdapter.charge(cmd.amount);
    logger.transition(ctx, 'Checkout', 'processing', 'charged', cmd.intentId);

    // --- Step 3.2: Update Order Status ---
    compensations.push(async () => {
      order.status = 'pending';
      order.version += 1;
      await OrderRepo.save(order);
    });
    order.status = 'fulfilled';
    order.version += 1;
    await OrderRepo.save(order);
    logger.transition(ctx, 'Checkout', 'charged', 'fulfilled', cmd.intentId);

    // --- Step 3.3: Send Notification (non-critical) ---
    try {
      await NotificationAdapter.sendConfirmation(cmd.orderId);
    } catch (e) {
      // Log but don't fail the saga
      console.warn('Notification failed, continuing...');
    }

    // ========================================
    // Step 4: CACHE RESULT (Pillar Q)
    // ========================================
    const result: SagaResult = {
      success: true,
      transactionId,
    };
    await Cache.set(`intent:${cmd.intentId}`, result);

    return result;

  } catch (error) {
    // ========================================
    // COMPENSATION (Pillar M)
    // ========================================
    logger.transition(ctx, 'Checkout', order.status, 'compensating', cmd.intentId);

    // Execute compensations in reverse order
    while (compensations.length > 0) {
      const compensate = compensations.pop()!;
      try {
        await compensate();
      } catch (compError) {
        // CRITICAL: Compensation failed
        logger.critical(ctx, 'Compensation failed', {
          saga: 'Checkout',
          intentId: cmd.intentId,
          error: String(compError),
        });
        // Manual intervention required
      }
    }

    logger.transition(ctx, 'Checkout', 'compensating', 'failed', cmd.intentId);

    const failResult: SagaResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    // Cache failure to prevent retry loops
    // NOTE: This caches ALL failures. In production, consider:
    // - FatalError (validation, business logic): Cache to prevent retries
    // - TransientError (network, timeout): Don't cache, allow retry
    // For template safety, we cache all to prevent retry storms.
    await Cache.set(`intent:${cmd.intentId}`, failResult);

    return failResult;
  }
}

// ============================================
// Hook for View (maintains Headless pattern)
// ============================================

import { useState, useCallback } from 'react';

type CheckoutState =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'success'; transactionId: string }
  | { status: 'error'; error: string };

function useCheckout() {
  const [state, setState] = useState<CheckoutState>({ status: 'idle' });

  const checkout = useCallback(async (cmd: CheckoutCommand) => {
    setState({ status: 'processing' });

    const ctx: SagaContext = {
      traceId: crypto.randomUUID(),
      userId: 'current-user', // From auth context
      startTime: new Date(),
    };

    const result = await processCheckout(cmd, ctx);

    if (result.success) {
      setState({ status: 'success', transactionId: result.transactionId! });
    } else {
      setState({ status: 'error', error: result.error! });
    }
  }, []);

  return { state, checkout };
}

export { processCheckout, useCheckout };
export type { CheckoutCommand, SagaResult, OrderId, IntentId };
