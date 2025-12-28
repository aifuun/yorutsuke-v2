# Pillar Q: The Idempotency Barrier

> Prevent duplicate side effects with Intent-ID

## Rule

All Tier 3 state-changing commands must contain a globally unique **Intent-ID** (UUID). This ID is checked before processing to prevent duplicate execution.

## Purpose

- Prevent double-charging on network retries
- Handle timeout + retry scenarios safely
- Block replay attacks
- Enable safe client-side retry logic

## Implementation

### Command with Intent-ID

```typescript
interface CheckoutCommand {
  intentId: IntentId;        // Unique per user action
  orderId: OrderId;
  amount: Money;
  expectedVersion: number;
}

type IntentId = string & { readonly __brand: 'IntentId' };

function createIntentId(): IntentId {
  return crypto.randomUUID() as IntentId;
}
```

### Idempotency Barrier Pattern

```typescript
async function processCommand<T>(
  intentId: IntentId,
  execute: () => Promise<T>
): Promise<T> {
  const cacheKey = `intent:${intentId}`;

  // 1. CHECK: Already processed?
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached as T;  // Return previous result
  }

  // 2. LOCK: Mark as processing
  const locked = await cache.setNX(cacheKey, 'PROCESSING', { EX: 300 });
  if (!locked) {
    // Another process is handling this
    throw new ConcurrentProcessingError('Request already in progress');
  }

  try {
    // 3. EXECUTE: Run the actual logic
    const result = await execute();

    // 4. STORE: Cache the result
    await cache.set(cacheKey, JSON.stringify(result), { EX: 86400 });

    return result;
  } catch (error) {
    // Remove lock on failure (allow retry)
    await cache.del(cacheKey);
    throw error;
  }
}
```

### Usage in Saga

```typescript
async function checkoutSaga(cmd: CheckoutCommand, ctx: Context) {
  // Idempotency barrier FIRST
  return processCommand(cmd.intentId, async () => {
    // All saga logic inside the barrier
    const compensations: Compensation[] = [];

    try {
      // Step 1: Charge
      compensations.push(() => refund(txId));
      const txId = await charge(cmd.amount);

      // Step 2: Update order
      compensations.push(() => revertOrder(cmd.orderId));
      await updateOrder(cmd.orderId, { status: 'paid' });

      return { success: true, transactionId: txId };
    } catch (error) {
      await executeCompensations(compensations);
      throw error;
    }
  });
}
```

### Client-Side Generation

```typescript
// React hook for idempotent actions
function useIdempotentAction<T>(
  action: (intentId: IntentId) => Promise<T>
) {
  const [intentId, setIntentId] = useState<IntentId | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const execute = async () => {
    // Generate intent ID once per user action
    const id = intentId ?? createIntentId();
    setIntentId(id);
    setState('loading');

    try {
      const result = await action(id);
      setState('success');
      return result;
    } catch (error) {
      setState('error');
      // Keep same intentId for retry!
      throw error;
    }
  };

  const reset = () => {
    setIntentId(null);  // New ID for new action
    setState('idle');
  };

  return { execute, reset, state, canRetry: state === 'error' };
}

// Usage
function CheckoutButton() {
  const { execute, state, canRetry } = useIdempotentAction(
    (intentId) => checkoutApi.process({ intentId, ...orderData })
  );

  return (
    <button onClick={execute} disabled={state === 'loading'}>
      {canRetry ? 'Retry' : 'Checkout'}
    </button>
  );
}
```

### Cache Implementation (Redis)

```typescript
import Redis from 'ioredis';

class IdempotencyCache {
  constructor(private redis: Redis) {}

  async check(intentId: IntentId): Promise<unknown | null> {
    const result = await this.redis.get(`intent:${intentId}`);
    if (!result) return null;
    if (result === 'PROCESSING') {
      throw new ConcurrentProcessingError();
    }
    return JSON.parse(result);
  }

  async lock(intentId: IntentId, ttlSeconds = 300): Promise<boolean> {
    const result = await this.redis.set(
      `intent:${intentId}`,
      'PROCESSING',
      'EX', ttlSeconds,
      'NX'
    );
    return result === 'OK';
  }

  async store(intentId: IntentId, result: unknown, ttlSeconds = 86400): Promise<void> {
    await this.redis.set(
      `intent:${intentId}`,
      JSON.stringify(result),
      'EX', ttlSeconds
    );
  }

  async unlock(intentId: IntentId): Promise<void> {
    await this.redis.del(`intent:${intentId}`);
  }
}
```

## Good Example

```typescript
// ✅ Complete idempotency implementation
async function processPayment(cmd: PaymentCommand, ctx: Context) {
  logger.json('IDEMPOTENCY_CHECK', {
    intentId: cmd.intentId,
    traceId: ctx.traceId,
  });

  // Check cache first
  const cached = await idempotencyCache.check(cmd.intentId);
  if (cached) {
    logger.json('IDEMPOTENCY_HIT', { intentId: cmd.intentId });
    return cached;
  }

  // Lock and process
  if (!await idempotencyCache.lock(cmd.intentId)) {
    throw new ConcurrentProcessingError();
  }

  try {
    const result = await executePayment(cmd);
    await idempotencyCache.store(cmd.intentId, result);
    return result;
  } catch (error) {
    await idempotencyCache.unlock(cmd.intentId);
    throw error;
  }
}
```

## Bad Example

```typescript
// ❌ No idempotency - double charge possible
async function processPayment(amount) {
  return await stripe.charge(amount);
  // Network timeout + client retry = double charge!
}

// ❌ Client-side only prevention
function PayButton() {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    if (clicked) return;  // ❌ Page refresh resets this
    setClicked(true);
    processPayment();
  };
}

// ❌ Database-based without proper locking
async function processPayment(orderId) {
  const order = await db.get(orderId);
  if (order.paid) return;  // ❌ Race condition gap
  await stripe.charge();
  order.paid = true;
  await db.save(order);
}
```

## Anti-Patterns

1. **UI-only duplicate prevention**
   ```typescript
   // ❌ Doesn't survive page refresh
   button.disabled = true;
   ```

2. **Status check without atomicity**
   ```typescript
   // ❌ Gap between check and update
   if (!processed) {
     await process();
     processed = true;
   }
   ```

3. **Request-scoped deduplication**
   ```typescript
   // ❌ Different requests get different IDs
   const requestId = generateId();
   ```

4. **Missing cache on success**
   ```typescript
   // ❌ Result not stored, retry re-executes
   if (cached) return cached;
   return await execute();  // Forgot to cache!
   ```

## Exceptions

- Read-only operations (T1)
- Operations already idempotent by nature (e.g., setting absolute value)

## Checklist

- [ ] All T3 commands have `intentId` field
- [ ] Client generates intentId once per user action
- [ ] Server checks cache before processing
- [ ] Lock acquired before execution
- [ ] Result cached after success
- [ ] Lock released on failure (enable retry)
- [ ] TTL set on cache entries

## References

- Related: Pillar F (Concurrency) - version checks
- Related: Pillar M (Saga) - compensation on failure
- Template: `.prot/pillar-q/idempotency.ts`
- Checklist: `.prot/pillar-q/checklist.md`
- Audit: `.prot/pillar-q/audit.ts`
