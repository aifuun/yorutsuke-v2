# Pillar N: Context Ubiquity Checklist

> Use this checklist when implementing request context propagation

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **No Parameter Drilling** | Use ContextStore.get() instead of passing traceId through functions |
| **Automatic Propagation** | API client adds headers automatically |
| **Explicit Initialization** | Middleware creates context at request start |

## Context Setup

### 1. Middleware Configuration

```typescript
// 00_kernel/context.ts
import { ContextStore, contextMiddleware } from '@/kernel/context';

// Apply to all routes
app.use(contextMiddleware);
```

- [ ] Context middleware applied before route handlers
- [ ] AbortController created from request lifecycle
- [ ] TraceId extracted from headers or generated
- [ ] User info attached from auth middleware
- [ ] Response includes x-trace-id header

### 2. RequestContext Interface

```typescript
interface RequestContext {
  // Required
  traceId: TraceId;
  spanId: SpanId;
  signal: AbortSignal;
  startTime: Date;
  source: RequestSource;

  // Optional
  userId?: UserId;
  sessionId?: SessionId;
  roles: Role[];
  deadline?: Date;
}
```

- [ ] All IDs use branded types (Pillar A)
- [ ] signal is AbortSignal for cancellation
- [ ] roles is readonly array
- [ ] All fields marked readonly after creation

## Context Usage

### 3. Getting Context in Services

```typescript
// ✅ CORRECT
async function createOrder(cmd: CreateOrderCommand) {
  const ctx = ContextStore.get();

  logger.json('ORDER_STARTED', {
    traceId: ctx.traceId,
    userId: ctx.userId,
  });
}

// ❌ WRONG
async function createOrder(cmd, traceId, userId, signal) {
  // Parameter drilling!
}
```

- [ ] Use `ContextStore.get()` to access context
- [ ] No traceId/userId parameters in function signatures
- [ ] No context parameter drilling through call stack

### 4. Abort Signal Handling

```typescript
// Long operations should check signal
async function processLargeFile(file: File) {
  const ctx = ContextStore.get();

  // Check before starting
  if (ctx.signal.aborted) {
    throw new RequestCancelledError();
  }

  // Pass to async operations
  await streamFile(file, { signal: ctx.signal });
}
```

- [ ] Check `signal.aborted` before long operations
- [ ] Pass signal to fetch, db queries, file operations
- [ ] Throw RequestCancelledError when aborted

### 5. Logging with Context

```typescript
// Always include traceId in logs (Pillar R)
logger.json('ORDER_CREATED', {
  traceId: ctx.traceId,
  userId: ctx.userId,
  orderId: order.id,
  duration: Date.now() - ctx.startTime.getTime(),
});
```

- [ ] All logs include traceId
- [ ] Include userId when relevant
- [ ] Calculate duration from startTime

## API Client Integration

### 6. Automatic Header Propagation

```typescript
// Use context-aware API client
const result = await apiRequest<OrderResult>('/orders', {
  method: 'POST',
  body: JSON.stringify(cmd),
});
// Headers x-trace-id, x-span-id automatically added
```

- [ ] Use `apiRequest()` instead of raw `fetch()`
- [ ] x-trace-id header propagated
- [ ] x-span-id header propagated
- [ ] signal attached for cancellation
- [ ] Timeout configured

## React Frontend

### 7. RequestProvider Setup

```typescript
// App.tsx
<RequestProvider>
  <App />
</RequestProvider>
```

- [ ] RequestProvider wraps entire app
- [ ] AbortController created per mount
- [ ] Cleanup aborts on unmount

### 8. Hook Usage

```typescript
function OrderForm() {
  const ctx = useRequestContext();
  const fetchApi = useFetch();

  const submit = async () => {
    const result = await fetchApi('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };
}
```

- [ ] Use `useRequestContext()` for context access
- [ ] Use `useFetch()` for API calls with context
- [ ] No manual header management needed

## Code Review Checklist

### Context Initialization

- [ ] All API routes have context middleware
- [ ] Background jobs create synthetic context
- [ ] WebSocket connections initialize context per message
- [ ] Cron jobs create context at start

### Context Propagation

- [ ] No functions with traceId parameter (drilling)
- [ ] API client adds trace headers automatically
- [ ] Downstream services receive trace context
- [ ] Queue jobs include context metadata

### Signal Handling

- [ ] Long operations pass abort signal
- [ ] Signal checked at operation boundaries
- [ ] Cleanup runs when signal aborts
- [ ] Timeout combined with request signal

### Logging (Pillar R)

- [ ] All logs include traceId
- [ ] Error logs include full context
- [ ] Performance logs include duration

## Common Patterns

### Service with Context

```typescript
// services/orderService.ts
class OrderService {
  async create(cmd: CreateOrderCommand): Promise<Order> {
    const ctx = ContextStore.get();

    // 1. Check cancellation
    if (ctx.signal.aborted) {
      throw new RequestCancelledError();
    }

    // 2. Log start
    logger.json('ORDER_CREATING', {
      traceId: ctx.traceId,
      cmd,
    });

    // 3. Execute with signal
    const order = await this.repo.create(cmd, {
      signal: ctx.signal,
    });

    // 4. Log completion
    logger.json('ORDER_CREATED', {
      traceId: ctx.traceId,
      orderId: order.id,
      duration: Date.now() - ctx.startTime.getTime(),
    });

    return order;
  }
}
```

### Background Job with Context

```typescript
// workers/orderProcessor.ts
async function processOrderJob(job: Job) {
  // Create synthetic context for job
  const context: RequestContext = {
    traceId: job.data.traceId || crypto.randomUUID() as TraceId,
    spanId: crypto.randomUUID() as SpanId,
    userId: job.data.userId,
    roles: [],
    signal: new AbortController().signal,
    startTime: new Date(),
    source: 'internal',
  };

  // Run job within context
  await ContextStore.run(context, async () => {
    await orderService.processBackground(job.data);
  });
}
```

### Cross-Service Call

```typescript
// adapters/paymentApi.ts
async function chargeCustomer(amount: Money): Promise<PaymentResult> {
  // apiRequest auto-propagates context headers
  return apiRequest('/payments/charge', {
    method: 'POST',
    body: JSON.stringify({ amount }),
    timeout: 30000,
  });
}
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| `function foo(traceId: string)` | Parameter drilling | Use `ContextStore.get()` |
| `let ctx = {}; ctx = newValue;` | Global mutable | Use AsyncLocalStorage |
| `setTimeout(() => { ctx... })` | Stale context | Pass data, not context |
| `await fetch(url)` | No signal | Use `apiRequest()` |
| `logger.info("msg")` | No trace | Add `{ traceId: ctx.traceId }` |

## Verification Commands

```bash
# Find parameter drilling
grep -r "traceId:" src/**/*.ts | grep "function\|async"

# Find raw fetch without context
grep -r "await fetch(" src/**/*.ts

# Find logs without traceId
grep -r "logger\." src/**/*.ts | grep -v "traceId"
```

## Template Reference

- Context store: `.prot/pillar-n/context.ts`
- Related: Pillar R (Observability) - logging with context
- Related: Pillar Q (Idempotency) - intentId in context
