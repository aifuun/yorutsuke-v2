/**
 * Pillar N: Context Ubiquity Template
 *
 * TraceID, User, and Signal accessible everywhere without parameter drilling.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - COPY this pattern for request context management
 * - Use AsyncLocalStorage for Node.js backend
 * - Use React Context for frontend
 * - NEVER pass traceId/userId through function parameters
 *
 * ⚠️ LIMITATION: AsyncLocalStorage does NOT propagate across Worker threads.
 * For worker pools, serialize context and pass explicitly via postMessage.
 */

import { AsyncLocalStorage } from 'async_hooks';

// =============================================================================
// TYPES (Pillar A: Nominal Typing)
// =============================================================================

type UserId = string & { readonly __brand: 'UserId' };
type TraceId = string & { readonly __brand: 'TraceId' };
type SpanId = string & { readonly __brand: 'SpanId' };
type SessionId = string & { readonly __brand: 'SessionId' };

type Role = 'admin' | 'user' | 'guest';
type RequestSource = 'web' | 'mobile' | 'api' | 'tauri' | 'internal';

// =============================================================================
// REQUEST CONTEXT INTERFACE
// =============================================================================

/**
 * Request context available throughout the execution chain.
 *
 * ⚠️ AI NOTE:
 * - All fields are readonly after creation
 * - signal is used for request cancellation
 * - traceId must be propagated to all downstream services
 */
interface RequestContext {
  // Tracing (Pillar R: Observability)
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly parentSpanId?: SpanId;

  // User Identity
  readonly userId?: UserId;
  readonly sessionId?: SessionId;
  readonly roles: readonly Role[];

  // Request Control
  readonly signal: AbortSignal;
  readonly startTime: Date;
  readonly deadline?: Date;

  // Metadata
  readonly source: RequestSource;
  readonly userAgent?: string;
}

// =============================================================================
// CONTEXT STORE (AsyncLocalStorage)
// =============================================================================

/**
 * Singleton context store using AsyncLocalStorage.
 *
 * ⚠️ AI NOTE:
 * - This works ONLY in Node.js environments
 * - For React frontend, use RequestProvider below
 * - Never store in global variable (race conditions)
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

const ContextStore = {
  /**
   * Execute function with context available.
   * Use in middleware to initialize request context.
   */
  run<T>(context: RequestContext, fn: () => T): T {
    return asyncLocalStorage.run(context, fn);
  },

  /**
   * Get current context or throw error.
   * Use when context is required.
   */
  get(): RequestContext {
    const ctx = asyncLocalStorage.getStore();
    if (!ctx) {
      throw new ContextNotAvailableError(
        'No context available - ensure middleware initialized context'
      );
    }
    return ctx;
  },

  /**
   * Get current context or undefined.
   * Use when context is optional (e.g., batch jobs).
   */
  getOptional(): RequestContext | undefined {
    return asyncLocalStorage.getStore();
  },

  /**
   * Create child span context.
   * Use when entering a new logical operation.
   */
  createChildSpan(name: string): RequestContext {
    const parent = this.get();
    return {
      ...parent,
      spanId: crypto.randomUUID() as SpanId,
      parentSpanId: parent.spanId,
    };
  },
};

// =============================================================================
// CONTEXT ERRORS
// =============================================================================

class ContextNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextNotAvailableError';
  }
}

class RequestCancelledError extends Error {
  constructor() {
    super('Request was cancelled');
    this.name = 'RequestCancelledError';
  }
}

// =============================================================================
// MIDDLEWARE (Express/Koa style)
// =============================================================================

/**
 * Middleware to initialize request context.
 *
 * ⚠️ AI NOTE:
 * - Apply to ALL routes that need context
 * - Must be early in middleware chain
 * - Creates AbortController from request lifecycle
 */
type Request = {
  headers: Record<string, string | undefined>;
  on: (event: string, handler: () => void) => void;
  user?: { id: UserId; roles: Role[] };
  session?: { id: SessionId };
};

type Response = {
  setHeader: (name: string, value: string) => void;
};

type NextFunction = () => void | Promise<void>;

function contextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const controller = new AbortController();

  // Abort on client disconnect
  req.on('close', () => controller.abort());
  req.on('error', () => controller.abort());

  const context: RequestContext = {
    // Tracing - propagate or generate new
    traceId: (req.headers['x-trace-id'] || crypto.randomUUID()) as TraceId,
    spanId: crypto.randomUUID() as SpanId,
    parentSpanId: req.headers['x-span-id'] as SpanId | undefined,

    // User - from auth middleware
    userId: req.user?.id,
    sessionId: req.session?.id,
    roles: req.user?.roles || [],

    // Control
    signal: controller.signal,
    startTime: new Date(),

    // Metadata
    source: detectSource(req),
    userAgent: req.headers['user-agent'],
  };

  // Return trace ID to client for debugging
  res.setHeader('x-trace-id', context.traceId);

  ContextStore.run(context, next);
}

function detectSource(req: Request): RequestSource {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Tauri')) return 'tauri';
  if (ua.includes('Mobile')) return 'mobile';
  if (req.headers['x-api-key']) return 'api';
  return 'web';
}

// =============================================================================
// CONTEXT-AWARE API CLIENT
// =============================================================================

/**
 * API client that automatically propagates context.
 *
 * ⚠️ AI NOTE:
 * - Automatically adds trace headers
 * - Passes abort signal for cancellation
 * - Use this instead of raw fetch
 */
interface ApiRequestOptions extends Omit<RequestInit, 'signal'> {
  timeout?: number;
}

async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const ctx = ContextStore.get();

  // Check if already cancelled
  if (ctx.signal.aborted) {
    throw new RequestCancelledError();
  }

  const { timeout = 30000, ...fetchOptions } = options;

  // Create timeout signal if needed
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
        // Propagate context headers
        'x-trace-id': ctx.traceId,
        'x-span-id': ctx.spanId,
        'x-user-id': ctx.userId || '',
      },
      // Combine request signal with timeout signal
      signal: combineSignals(ctx.signal, timeoutController.signal),
    });

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller.signal;
}

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`API error ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

// =============================================================================
// REACT CONTEXT (Frontend)
// =============================================================================

/*
import { createContext, useContext, useMemo, useEffect, ReactNode } from 'react';

/**
 * Frontend request context.
 *
 * ⚠️ AI NOTE:
 * - Simpler than backend context
 * - Creates new traceId per component mount
 * - AbortController for cleanup on unmount
 * /
interface FrontendContext {
  traceId: TraceId;
  userId?: UserId;
  abortController: AbortController;
}

const RequestContext = createContext<FrontendContext | null>(null);

interface RequestProviderProps {
  children: ReactNode;
}

function RequestProvider({ children }: RequestProviderProps) {
  const { user } = useAuth();  // Your auth hook
  const abortController = useMemo(() => new AbortController(), []);

  const context = useMemo<FrontendContext>(() => ({
    traceId: crypto.randomUUID() as TraceId,
    userId: user?.id as UserId | undefined,
    abortController,
  }), [user?.id, abortController]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortController.abort();
    };
  }, [abortController]);

  return (
    <RequestContext.Provider value={context}>
      {children}
    </RequestContext.Provider>
  );
}

function useRequestContext(): FrontendContext {
  const ctx = useContext(RequestContext);
  if (!ctx) {
    throw new Error('useRequestContext must be used within RequestProvider');
  }
  return ctx;
}

// Frontend API client using context
function useFetch() {
  const ctx = useRequestContext();

  return async function fetchWithContext<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'x-trace-id': ctx.traceId,
        'x-user-id': ctx.userId || '',
      },
      signal: ctx.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  };
}
*/

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// ✅ CORRECT: Context available without parameter drilling

// 1. Apply middleware
app.use(contextMiddleware);

// 2. Controller - no context parameter
app.post('/orders', async (req, res) => {
  const order = await orderService.create(req.body);
  res.json(order);
});

// 3. Service - context available anywhere
async function createOrder(cmd: CreateOrderCommand): Promise<Order> {
  const ctx = ContextStore.get();  // Available!

  // Check cancellation
  if (ctx.signal.aborted) {
    throw new RequestCancelledError();
  }

  // Log with context (Pillar R)
  logger.json('ORDER_STARTED', {
    traceId: ctx.traceId,
    userId: ctx.userId,
    cmd,
  });

  // Database with signal
  const order = await db.orders.create(cmd, { signal: ctx.signal });

  // Downstream service - context auto-propagated
  await notificationService.sendConfirmation(order);

  return order;
}

// 4. Deep in call stack - still works
async function sendConfirmation(order: Order): Promise<void> {
  const ctx = ContextStore.get();  // Still available!

  await emailClient.send({
    to: order.email,
    template: 'confirmation',
    metadata: { traceId: ctx.traceId },
  });
}


// ❌ WRONG: Parameter drilling

async function createOrder(
  cmd: CreateOrderCommand,
  traceId: string,      // ❌ Drilling
  userId: string,       // ❌ Drilling
  signal: AbortSignal   // ❌ Drilling
): Promise<Order> {
  const order = await db.orders.create(cmd);

  // Must pass through every call
  await sendConfirmation(order, traceId, userId, signal);

  return order;
}

async function sendConfirmation(
  order: Order,
  traceId: string,      // ❌ Drilling through 2 layers
  userId: string,
  signal: AbortSignal
): Promise<void> {
  // ...
}


// ❌ WRONG: Global mutable context

let globalContext: RequestContext;  // ❌ Race condition!

function setContext(ctx: RequestContext) {
  globalContext = ctx;  // ❌ Overwritten by concurrent requests
}


// ❌ WRONG: Captured stale context

async function processOrder(cmd: CreateOrderCommand) {
  const ctx = ContextStore.get();  // Captured here

  // ❌ setTimeout breaks context chain
  setTimeout(async () => {
    // ctx may be from a DIFFERENT request now!
    const order = await createOrder(cmd);
  }, 1000);
}

// ✅ CORRECT: Pass context to async operations
async function processOrder(cmd: CreateOrderCommand) {
  const ctx = ContextStore.get();

  // Queue job with explicit context
  await jobQueue.enqueue('process-order', {
    cmd,
    context: {
      traceId: ctx.traceId,
      userId: ctx.userId,
    },
  });
}
*/

// =============================================================================
// TEMPLATE FOR NEW CONTEXT USAGE
// =============================================================================

/*
⚠️ AI: When adding context to a new service:

1. Ensure middleware is applied:
   app.use(contextMiddleware);

2. Get context in service:
   const ctx = ContextStore.get();

3. Check signal for long operations:
   if (ctx.signal.aborted) throw new RequestCancelledError();

4. Log with traceId:
   logger.json('EVENT', { traceId: ctx.traceId, ... });

5. Propagate to downstream calls:
   // Automatic if using apiRequest()
   await apiRequest('/downstream', { method: 'POST', body: data });

6. For background jobs, pass context explicitly:
   await queue.add('job', { ...data, traceId: ctx.traceId });
*/

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Types
  RequestContext,
  UserId,
  TraceId,
  SpanId,
  SessionId,
  Role,
  RequestSource,

  // Store
  ContextStore,

  // Middleware
  contextMiddleware,

  // API Client
  apiRequest,
  ApiRequestOptions,

  // Errors
  ContextNotAvailableError,
  RequestCancelledError,
  ApiError,
};
