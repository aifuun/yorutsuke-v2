# Pillar N: Context Ubiquity

> TraceID, User, and Signal accessible everywhere

## Rule

A **Request Context** containing TraceID, User, and Cancellation Signal must be accessible at every point in the execution chain without explicit parameter passing.

## Purpose

- Correlate logs across distributed systems
- Enable request cancellation
- Track user identity throughout flow
- Avoid "parameter drilling" through call stacks

## Implementation

### Context Definition

```typescript
// 00_kernel/context.ts

interface RequestContext {
  // Tracing
  traceId: string;
  spanId: string;
  parentSpanId?: string;

  // User
  userId?: UserId;
  sessionId?: string;
  roles: Role[];

  // Control
  signal: AbortSignal;
  startTime: Date;
  deadline?: Date;

  // Metadata
  source: 'web' | 'mobile' | 'api' | 'internal';
  userAgent?: string;
}
```

### AsyncLocalStorage (Node.js)

```typescript
// 00_kernel/context-store.ts
import { AsyncLocalStorage } from 'async_hooks';

const contextStore = new AsyncLocalStorage<RequestContext>();

export const ContextStore = {
  run<T>(context: RequestContext, fn: () => T): T {
    return contextStore.run(context, fn);
  },

  get(): RequestContext {
    const ctx = contextStore.getStore();
    if (!ctx) {
      throw new Error('No context available - ensure middleware initialized context');
    }
    return ctx;
  },

  getOptional(): RequestContext | undefined {
    return contextStore.getStore();
  },
};
```

### Middleware Initialization

```typescript
// middleware/context.ts

function contextMiddleware(req: Request, res: Response, next: NextFunction) {
  const context: RequestContext = {
    traceId: req.headers['x-trace-id'] || crypto.randomUUID(),
    spanId: crypto.randomUUID(),
    userId: req.user?.id,
    sessionId: req.session?.id,
    roles: req.user?.roles || [],
    signal: createAbortSignal(req),
    startTime: new Date(),
    source: detectSource(req),
    userAgent: req.headers['user-agent'],
  };

  // Set response headers for tracing
  res.setHeader('x-trace-id', context.traceId);

  ContextStore.run(context, () => next());
}

function createAbortSignal(req: Request): AbortSignal {
  const controller = new AbortController();

  req.on('close', () => controller.abort());
  req.on('error', () => controller.abort());

  return controller.signal;
}
```

### Usage in Services

```typescript
// services/orderService.ts

async function createOrder(cmd: CreateOrderCommand): Promise<Order> {
  // Context available without parameter passing!
  const ctx = ContextStore.get();

  // Check for cancellation
  if (ctx.signal.aborted) {
    throw new RequestCancelledError();
  }

  // Use traceId in logs
  logger.json('ORDER_CREATING', {
    traceId: ctx.traceId,
    userId: ctx.userId,
    orderId: cmd.orderId,
  });

  // Pass signal to long operations
  const result = await db.query(sql, { signal: ctx.signal });

  return result;
}
```

### React Context (Frontend)

```typescript
// 00_kernel/RequestContext.tsx

interface FrontendContext {
  traceId: string;
  userId?: UserId;
  abortController: AbortController;
}

const RequestContext = createContext<FrontendContext | null>(null);

function RequestProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const abortController = useMemo(() => new AbortController(), []);

  const context = useMemo(() => ({
    traceId: crypto.randomUUID(),
    userId: user?.id,
    abortController,
  }), [user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => abortController.abort();
  }, []);

  return (
    <RequestContext.Provider value={context}>
      {children}
    </RequestContext.Provider>
  );
}

function useRequestContext() {
  const ctx = useContext(RequestContext);
  if (!ctx) throw new Error('Missing RequestProvider');
  return ctx;
}
```

### Passing Context in Fetch

```typescript
// adapters/apiClient.ts

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const ctx = ContextStore.get();

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'x-trace-id': ctx.traceId,
      'x-user-id': ctx.userId || '',
    },
    signal: ctx.signal,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.json();
}
```

## Good Example

```typescript
// ✅ Context available everywhere without drilling

// Controller
app.post('/orders', contextMiddleware, async (req, res) => {
  const order = await orderService.create(req.body);
  res.json(order);
});

// Service - no context parameter needed
async function createOrder(cmd: CreateOrderCommand) {
  const ctx = ContextStore.get();  // Available!

  logger.json('ORDER_STARTED', { traceId: ctx.traceId });

  const order = await orderRepo.save(cmd);
  await notificationService.notify(order);  // Also has access to ctx

  return order;
}

// Deep in call stack - still available
async function sendEmail(order: Order) {
  const ctx = ContextStore.get();

  await emailClient.send({
    template: 'order-confirmation',
    metadata: { traceId: ctx.traceId },  // For email logs
  });
}
```

## Bad Example

```typescript
// ❌ Parameter drilling
async function createOrder(cmd, traceId, userId, signal) {
  const order = await orderRepo.save(cmd, traceId);
  await notify(order, traceId, userId, signal);
}

async function notify(order, traceId, userId, signal) {
  await sendEmail(order, traceId, userId, signal);
  await sendSms(order, traceId, userId, signal);
}

async function sendEmail(order, traceId, userId, signal) {
  // Drilling through 4 layers!
}
```

## Anti-Patterns

1. **Missing context initialization**
   ```typescript
   // ❌ Forgot middleware
   app.post('/orders', handler);  // No context!
   ```

2. **Global mutable context**
   ```typescript
   // ❌ Race conditions with concurrent requests
   let globalContext = {};
   ```

3. **Ignoring abort signal**
   ```typescript
   // ❌ Request cancelled but work continues
   await longOperation();  // Should check signal
   ```

4. **Context in closure**
   ```typescript
   // ❌ Stale context captured
   const ctx = ContextStore.get();
   setTimeout(() => {
     // ctx may be from different request!
   }, 1000);
   ```

## Exceptions

- Batch jobs may create synthetic context
- Background workers need explicit context passing

## Checklist

- [ ] Middleware initializes context for all requests
- [ ] TraceID propagated in all service calls
- [ ] Abort signal checked in long operations
- [ ] Logs include traceId and userId
- [ ] Cross-service calls forward trace headers
- [ ] No parameter drilling for context

## References

- Related: Pillar R (Observability) - logging with context
- Related: Pillar Q (Idempotency) - intentId in context
- Pattern: AsyncLocalStorage, Thread-Local Storage

## Assets

- Template: `.prot/pillar-n/context.ts`
- Checklist: `.prot/pillar-n/checklist.md`
