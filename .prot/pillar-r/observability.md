# Pillar R: Semantic Observability

> Logs must be machine-readable and describe state transitions

## Rule

All logs must be:
1. **JSON formatted** (machine-readable)
2. **Semantic** (describe state transitions, not prose)
3. **Contextual** (include traceId, intentId, saga name)

## Purpose

- Enable AI-driven debugging and analysis
- Support automated alerting and anomaly detection
- Provide clear audit trails
- Correlate events across distributed systems

## Implementation

### Logger Interface

```typescript
// 00_kernel/logger.ts

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  event: string;
  traceId: string;
  spanId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface Logger {
  debug(event: string, data?: Record<string, unknown>): void;
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  critical(event: string, data?: Record<string, unknown>): void;
}
```

### Logger Implementation

```typescript
// infrastructure/logger.ts

function createLogger(): Logger {
  const log = (level: LogEntry['level'], event: string, data: Record<string, unknown> = {}) => {
    const ctx = ContextStore.getOptional();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      traceId: ctx?.traceId || 'no-trace',
      spanId: ctx?.spanId,
      userId: ctx?.userId,
      ...data,
    };

    // Output as JSON
    console.log(JSON.stringify(entry));
  };

  return {
    debug: (event, data) => log('debug', event, data),
    info: (event, data) => log('info', event, data),
    warn: (event, data) => log('warn', event, data),
    error: (event, data) => log('error', event, data),
    critical: (event, data) => log('critical', event, data),
  };
}

export const logger = createLogger();
```

### State Transition Logging

```typescript
// Semantic log for state changes

// ✅ GOOD: Describes what happened
logger.info('STATE_TRANSITION', {
  saga: 'Checkout',
  from: 'cart',
  to: 'payment',
  orderId: order.id,
  itemCount: order.items.length,
  totalAmount: order.total,
});

// ✅ GOOD: Error with context
logger.error('PAYMENT_FAILED', {
  saga: 'Checkout',
  orderId: order.id,
  intentId: cmd.intentId,
  errorCode: 'INSUFFICIENT_FUNDS',
  errorMessage: error.message,
  attemptNumber: 1,
});

// ✅ GOOD: Saga completion
logger.info('SAGA_COMPLETED', {
  saga: 'Checkout',
  orderId: order.id,
  duration: Date.now() - startTime,
  steps: ['cart', 'payment', 'inventory', 'confirmation'],
  result: 'success',
});
```

### Log Event Naming Convention

```typescript
// Event naming: NOUN_VERB or ENTITY_ACTION

// Entity lifecycle
'ORDER_CREATED'
'ORDER_UPDATED'
'ORDER_CANCELLED'
'USER_REGISTERED'
'PAYMENT_PROCESSED'

// State transitions
'STATE_TRANSITION'
'SAGA_STEP_STARTED'
'SAGA_STEP_COMPLETED'
'SAGA_FAILED'

// System events
'CIRCUIT_OPENED'
'CIRCUIT_CLOSED'
'CACHE_HIT'
'CACHE_MISS'

// Errors
'VALIDATION_FAILED'
'AUTHORIZATION_DENIED'
'EXTERNAL_SERVICE_ERROR'
```

### Saga Logging

```typescript
// workflows/checkoutSaga.ts

async function checkoutSaga(cmd: CheckoutCommand, ctx: SagaContext) {
  const startTime = Date.now();

  logger.info('SAGA_STARTED', {
    saga: 'Checkout',
    intentId: cmd.intentId,
    orderId: cmd.orderId,
    userId: ctx.userId,
  });

  try {
    // Step 1
    logger.info('SAGA_STEP_STARTED', {
      saga: 'Checkout',
      step: 'RESERVE_INVENTORY',
      intentId: cmd.intentId,
    });

    await inventoryAdapter.reserve(cmd.items);

    logger.info('SAGA_STEP_COMPLETED', {
      saga: 'Checkout',
      step: 'RESERVE_INVENTORY',
      intentId: cmd.intentId,
      reservationId,
    });

    // ... more steps

    logger.info('SAGA_COMPLETED', {
      saga: 'Checkout',
      intentId: cmd.intentId,
      duration: Date.now() - startTime,
      result: 'success',
    });

  } catch (error) {
    logger.error('SAGA_FAILED', {
      saga: 'Checkout',
      intentId: cmd.intentId,
      step: currentStep,
      error: error.message,
      duration: Date.now() - startTime,
    });

    logger.info('COMPENSATION_STARTED', {
      saga: 'Checkout',
      intentId: cmd.intentId,
      stepsToCompensate: completedSteps.length,
    });

    // Compensation logging...
  }
}
```

### Structured Error Logging

```typescript
// Error with full context
logger.error('EXTERNAL_API_ERROR', {
  service: 'stripe',
  operation: 'charge',
  requestId: stripeRequestId,
  errorCode: error.code,
  errorType: error.type,
  errorMessage: error.message,
  retryable: error.code !== 'card_declined',
  orderId: cmd.orderId,
  amount: cmd.amount,
});

// Critical for manual intervention
logger.critical('COMPENSATION_FAILED', {
  saga: 'Checkout',
  intentId: cmd.intentId,
  step: 'REFUND_PAYMENT',
  originalError: originalError.message,
  compensationError: compError.message,
  requiresManualIntervention: true,
  runbook: 'https://wiki/runbooks/failed-refund',
});
```

## Good Example

```typescript
// ✅ Complete semantic logging

async function processOrder(cmd: ProcessOrderCommand) {
  const ctx = ContextStore.get();

  logger.info('ORDER_PROCESSING_STARTED', {
    orderId: cmd.orderId,
    userId: ctx.userId,
    itemCount: cmd.items.length,
  });

  try {
    const order = await orderService.create(cmd);

    logger.info('ORDER_CREATED', {
      orderId: order.id,
      status: order.status,
      total: order.total,
    });

    return order;
  } catch (error) {
    logger.error('ORDER_CREATION_FAILED', {
      orderId: cmd.orderId,
      errorType: error.constructor.name,
      errorMessage: error.message,
      stack: error.stack,
    });

    throw error;
  }
}
```

## Bad Example

```typescript
// ❌ Human-readable but not machine-parseable
console.log('Processing order for user ' + userId);
console.log('Payment failed!');
console.log(`Error: ${error}`);

// ❌ Missing context
logger.info('Order created');  // Which order? Who? When?

// ❌ Not semantic
logger.info('LOG', { message: 'Something happened' });
```

## Anti-Patterns

1. **String concatenation logs**
   ```typescript
   // ❌ Not parseable
   console.log('User ' + userId + ' placed order ' + orderId);
   ```

2. **Missing trace context**
   ```typescript
   // ❌ Cannot correlate across services
   logger.info('PAYMENT_PROCESSED', { amount: 100 });
   ```

3. **Generic event names**
   ```typescript
   // ❌ Not semantic
   logger.info('EVENT', { type: 'order', action: 'create' });
   ```

4. **Logging sensitive data**
   ```typescript
   // ❌ PII in logs
   logger.info('USER_LOGIN', { email, password, ssn });
   ```

## Exceptions

- Development debug logs may be less structured
- Performance-critical hot paths may skip detailed logging

## Checklist

- [ ] All logs are JSON formatted
- [ ] Event names are semantic (NOUN_VERB)
- [ ] traceId included in every log
- [ ] intentId included for T3 operations
- [ ] State transitions logged with from/to
- [ ] Errors include errorCode and errorMessage
- [ ] No PII in logs
- [ ] Duration logged for operations

## References

- Related: Pillar N (Context) - trace propagation
- Related: Pillar M (Saga) - saga logging
- Pattern: Structured Logging, Distributed Tracing
- Template: `.prot/pillar-r/observability.ts`
- Checklist: `.prot/pillar-r/checklist.md`
