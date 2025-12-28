# Pillar R: Semantic Observability Checklist

> Use this checklist when adding logging to your code.

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Explicit > Abstract** | Semantic event names describe exactly what happened |
| **Copy > Generate** | Copy logger patterns from template |
| **Clear > DRY** | Each log has explicit context, even if repetitive |

## When to Apply

- [ ] Any state transition
- [ ] Saga step execution
- [ ] External service calls
- [ ] Error handling
- [ ] Authentication/authorization events
- [ ] Business-critical operations

## When NOT to Apply

- [ ] Hot path with performance constraints
- [ ] Development-only debug output
- [ ] Verbose iteration logging

## Log Format

### 1. JSON Structure

- [ ] All logs output as JSON
- [ ] Single line per log entry
- [ ] No string concatenation

```typescript
// ✅ Correct: JSON structured
logger.info('ORDER_CREATED', {
  orderId: order.id,
  userId: order.userId,
  total: order.total,
});

// ❌ Wrong: String concatenation
console.log('Order ' + orderId + ' created for user ' + userId);

// ❌ Wrong: Template literal prose
console.log(`Order ${orderId} was successfully created`);
```

### 2. Semantic Event Names

- [ ] Use NOUN_VERB format
- [ ] Names are uppercase with underscores
- [ ] Specific, not generic

```typescript
// ✅ Correct: Semantic names
'ORDER_CREATED'
'PAYMENT_PROCESSED'
'SAGA_STEP_COMPLETED'
'AUTHORIZATION_DENIED'

// ❌ Wrong: Generic names
'EVENT'
'LOG'
'INFO'
'SOMETHING_HAPPENED'

// ❌ Wrong: Prose-style names
'order_was_created_successfully'
'processingOrder'
```

### 3. Required Fields

- [ ] `traceId` in every log
- [ ] `event` with semantic name
- [ ] `timestamp` in ISO format
- [ ] `level` (debug/info/warn/error/critical)

```typescript
// ✅ Correct: All required fields
{
  "timestamp": "2024-12-27T10:30:00.000Z",
  "level": "info",
  "event": "ORDER_CREATED",
  "traceId": "trace-abc-123",
  "orderId": "order_456",
  "userId": "user_789"
}

// ❌ Wrong: Missing traceId
{
  "event": "ORDER_CREATED",
  "orderId": "order_456"
}
```

## T3 Operation Logging

### 4. Saga Logging

- [ ] Log SAGA_STARTED at beginning
- [ ] Log SAGA_STEP_STARTED before each step
- [ ] Log SAGA_STEP_COMPLETED after each step
- [ ] Log SAGA_COMPLETED or SAGA_FAILED at end
- [ ] Include intentId in all saga logs
- [ ] Include duration in completion logs

```typescript
// ✅ Correct: Complete saga logging
const sagaLogger = createSagaLogger(logger, 'Checkout', cmd.intentId);

sagaLogger.started({ orderId: cmd.orderId });

sagaLogger.stepStarted('RESERVE_INVENTORY');
await inventoryAdapter.reserve(items);
sagaLogger.stepCompleted('RESERVE_INVENTORY', { reservationId });

sagaLogger.stepStarted('CHARGE_PAYMENT');
await paymentAdapter.charge(amount);
sagaLogger.stepCompleted('CHARGE_PAYMENT', { paymentId });

sagaLogger.completed({ orderId: order.id });

// ❌ Wrong: Only logging at end
await doStep1();
await doStep2();
await doStep3();
logger.info('Checkout done');  // No step visibility!
```

### 5. Compensation Logging

- [ ] Log COMPENSATION_STARTED when rollback begins
- [ ] Log each compensation step
- [ ] Log COMPENSATION_FAILED as critical if fails
- [ ] Include `requiresManualIntervention: true` on failures

```typescript
// ✅ Correct: Compensation logging
logger.info('COMPENSATION_STARTED', {
  saga: 'Checkout',
  intentId,
  stepsToCompensate: 3,
});

// If compensation fails
logger.critical('COMPENSATION_FAILED', {
  saga: 'Checkout',
  step: 'REFUND_PAYMENT',
  intentId,
  errorMessage: error.message,
  requiresManualIntervention: true,
  runbook: 'https://wiki/runbooks/failed-refund',
});
```

## State Transition Logging

### 6. State Changes

- [ ] Use STATE_TRANSITION event
- [ ] Include `from` and `to` states
- [ ] Include entity type and ID

```typescript
// ✅ Correct: State transition
logger.info('STATE_TRANSITION', {
  entity: 'Order',
  entityId: order.id,
  from: 'pending',
  to: 'confirmed',
  triggeredBy: 'payment_received',
});

// ❌ Wrong: Just logging new state
logger.info('ORDER_UPDATED', { status: 'confirmed' });
// Missing: what was the previous state?
```

## Error Logging

### 7. Error Context

- [ ] Include `errorCode` if available
- [ ] Include `errorType` (constructor name)
- [ ] Include `errorMessage`
- [ ] Include `retryable` for external errors
- [ ] Include operation context

```typescript
// ✅ Correct: Full error context
logger.error('PAYMENT_FAILED', {
  orderId: cmd.orderId,
  intentId: cmd.intentId,
  amount: cmd.amount,
  errorCode: error.code,
  errorType: error.constructor.name,
  errorMessage: error.message,
  retryable: error.code !== 'card_declined',
});

// ❌ Wrong: Minimal error info
logger.error('ERROR', { message: error.message });
// Missing: what operation? what entity? retryable?
```

### 8. External Service Errors

- [ ] Include service name
- [ ] Include operation name
- [ ] Include external requestId if available
- [ ] Use `logExternalError` helper

```typescript
// ✅ Correct: External error
logExternalError(logger, {
  service: 'stripe',
  operation: 'charge',
  error: stripeError,
  requestId: stripeError.request_id,
  retryable: true,
  orderId: cmd.orderId,
  amount: cmd.amount,
});
```

## Security

### 9. No Sensitive Data

- [ ] Never log passwords
- [ ] Never log tokens/secrets
- [ ] Never log credit card numbers
- [ ] Never log SSN or PII
- [ ] Use `redactSensitive()` when unsure

```typescript
// ✅ Correct: Safe logging
logger.info('USER_LOGGED_IN', {
  userId: user.id,
  email: user.email,  // OK if not sensitive in your context
  method: 'password',
});

// ❌ FORBIDDEN: Sensitive data
logger.info('USER_LOGGED_IN', {
  userId: user.id,
  password: user.password,  // NEVER!
  token: session.token,     // NEVER!
});

// ✅ Safe: Using redactSensitive
const safeData = redactSensitive(userData);
logger.info('USER_DATA', safeData);
```

## Code Review Checklist

### Log Quality
- [ ] All logs are JSON (no console.log with strings)
- [ ] Event names are semantic NOUN_VERB
- [ ] traceId present in all logs
- [ ] intentId present for T3 operations
- [ ] Duration logged for operations

### Saga Logging
- [ ] Saga start/complete logged
- [ ] Each step logged (start + complete)
- [ ] Compensation logged if triggered
- [ ] Failures include step and error context

### Error Logging
- [ ] Errors include errorCode/Type/Message
- [ ] External errors include service/operation
- [ ] retryable flag for transient errors
- [ ] Critical for manual intervention cases

### Security
- [ ] No passwords in logs
- [ ] No tokens/secrets in logs
- [ ] No PII (SSN, credit cards)
- [ ] redactSensitive() used for user data

## Common Patterns

### 1. Operation Wrapper

```typescript
async function withLogging<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();

  logger.info(`${operation}_STARTED`, context);

  try {
    const result = await fn();
    logger.info(`${operation}_COMPLETED`, {
      ...context,
      duration: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    logger.error(`${operation}_FAILED`, {
      ...context,
      duration: Date.now() - startTime,
      errorMessage: error.message,
    });
    throw error;
  }
}

// Usage
await withLogging(logger, 'ORDER_PROCESSING',
  () => processOrder(cmd),
  { orderId: cmd.orderId }
);
```

### 2. Saga Logger

```typescript
const sagaLogger = createSagaLogger(logger, 'Checkout', cmd.intentId);

sagaLogger.started({ orderId: cmd.orderId });

for (const step of steps) {
  sagaLogger.stepStarted(step.name);
  await step.execute();
  sagaLogger.stepCompleted(step.name);
}

sagaLogger.completed();
```

### 3. External Call Logging

```typescript
async function callExternalService<T>(
  logger: Logger,
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn();
    logger.info('EXTERNAL_CALL_SUCCESS', { service, operation });
    return result;
  } catch (error) {
    logExternalError(logger, { service, operation, error });
    throw error;
  }
}
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| String logs | Not parseable | Use JSON logger |
| Missing traceId | Can't correlate | Always include traceId |
| Generic events | Not searchable | Use NOUN_VERB names |
| No duration | Can't measure | Log start time, calculate duration |
| Logging PII | Security risk | Use redactSensitive() |
| Only error logs | No visibility | Log success too |

## Anti-Patterns

```typescript
// ❌ 1. String concatenation
console.log('User ' + userId + ' placed order ' + orderId);

// ❌ 2. Generic event names
logger.info('LOG', { type: 'order' });

// ❌ 3. Missing context
logger.info('ORDER_CREATED');  // Which order?

// ❌ 4. Sensitive data
logger.info('AUTH', { password, token });

// ❌ 5. No trace correlation
logger.info('PAYMENT', { amount });  // No traceId

// ❌ 6. Prose-style events
logger.info('order_was_successfully_created_for_user');
```

## Template Reference

Copy from: `.prot/pillar-r/observability.ts`

Key exports:
- `Logger` - Logger interface
- `LogEntry` - Log entry structure
- `createLogger()` - Create semantic logger
- `createSafeLogger()` - Logger with auto-redaction
- `createSagaLogger()` - Helper for saga logging
- `logStateTransition()` - Helper for state changes
- `logExternalError()` - Helper for external errors
- `redactSensitive()` - Remove PII from objects
- `EVENT_NAMES` - Standard event name constants
