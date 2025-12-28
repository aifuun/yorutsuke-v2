/**
 * Pillar Q: Idempotency Barrier Template
 *
 * Prevent duplicate side effects with Intent-ID pattern.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - COPY this pattern for all T3 saga operations
 * - Each command MUST have an intentId field
 * - NEVER skip idempotency check for state-changing operations
 * - Use branded IntentId type, not raw string
 */

// =============================================================================
// BRANDED TYPE
// =============================================================================

/**
 * Globally unique identifier for user intent.
 * Same intentId = same user action (even if retried).
 */
export type IntentId = string & { readonly __brand: 'IntentId' };

export function createIntentId(): IntentId {
  return crypto.randomUUID() as IntentId;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Thrown when same intent is being processed concurrently.
 * Client should wait and retry.
 */
export class ConcurrentProcessingError extends Error {
  constructor(public readonly intentId: IntentId) {
    super(`Intent ${intentId} is already being processed`);
    this.name = 'ConcurrentProcessingError';
  }
}

/**
 * Thrown when idempotency cache operation fails.
 * Critical error - should not proceed.
 */
export class IdempotencyCacheError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'IdempotencyCacheError';
  }
}

// =============================================================================
// CACHE INTERFACE
// =============================================================================

/**
 * Cache for idempotency checks.
 * Implement with Redis, DynamoDB, or any atomic storage.
 */
export interface IdempotencyCache {
  /**
   * Check if intent was already processed.
   * @returns cached result if exists, null if not processed
   * @throws ConcurrentProcessingError if being processed
   */
  check(intentId: IntentId): Promise<unknown | null>;

  /**
   * Acquire processing lock.
   * @returns true if lock acquired, false if already locked
   */
  lock(intentId: IntentId, ttlSeconds?: number): Promise<boolean>;

  /**
   * Store successful result.
   */
  store(intentId: IntentId, result: unknown, ttlSeconds?: number): Promise<void>;

  /**
   * Release lock on failure.
   */
  unlock(intentId: IntentId): Promise<void>;
}

// =============================================================================
// REDIS IMPLEMENTATION
// =============================================================================

/**
 * Redis-based idempotency cache.
 *
 * ⚠️ AI NOTE: Copy this implementation, adjust for your Redis client.
 */
export class RedisIdempotencyCache implements IdempotencyCache {
  private readonly PROCESSING_MARKER = 'PROCESSING';

  constructor(
    private redis: {
      get(key: string): Promise<string | null>;
      set(key: string, value: string, options?: { EX?: number; NX?: boolean }): Promise<string | null>;
      del(key: string): Promise<number>;
    }
  ) {}

  async check(intentId: IntentId): Promise<unknown | null> {
    const key = this.key(intentId);
    const result = await this.redis.get(key);

    if (!result) return null;

    if (result === this.PROCESSING_MARKER) {
      throw new ConcurrentProcessingError(intentId);
    }

    return JSON.parse(result);
  }

  /**
   * Acquire processing lock.
   *
   * ⚠️ TTL WARNING:
   * Ensure ttlSeconds > maximum saga execution time.
   * If lock expires during execution, concurrent requests may proceed.
   *
   * For long-running operations (e.g., slow payment callbacks):
   * - Option 1: Increase ttlSeconds (simple)
   * - Option 2: Implement lock renewal / watchdog (complex)
   *
   * Default 300s (5min) is safe for most HTTP-based sagas.
   */
  async lock(intentId: IntentId, ttlSeconds = 300): Promise<boolean> {
    const key = this.key(intentId);
    const result = await this.redis.set(key, this.PROCESSING_MARKER, {
      EX: ttlSeconds,
      NX: true,
    });
    return result === 'OK';
  }

  async store(intentId: IntentId, result: unknown, ttlSeconds = 86400): Promise<void> {
    const key = this.key(intentId);
    await this.redis.set(key, JSON.stringify(result), { EX: ttlSeconds });
  }

  async unlock(intentId: IntentId): Promise<void> {
    const key = this.key(intentId);
    await this.redis.del(key);
  }

  private key(intentId: IntentId): string {
    return `intent:${intentId}`;
  }
}

// =============================================================================
// IN-MEMORY IMPLEMENTATION (for testing)
// =============================================================================

/**
 * In-memory cache for unit tests.
 *
 * ⚠️ AI NOTE: Use this in tests ONLY, never in production.
 */
export class InMemoryIdempotencyCache implements IdempotencyCache {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly PROCESSING_MARKER = Symbol('PROCESSING');

  async check(intentId: IntentId): Promise<unknown | null> {
    const entry = this.cache.get(intentId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(intentId);
      return null;
    }

    if (entry.value === this.PROCESSING_MARKER) {
      throw new ConcurrentProcessingError(intentId);
    }

    return entry.value;
  }

  async lock(intentId: IntentId, ttlSeconds = 300): Promise<boolean> {
    if (this.cache.has(intentId)) return false;

    this.cache.set(intentId, {
      value: this.PROCESSING_MARKER,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async store(intentId: IntentId, result: unknown, ttlSeconds = 86400): Promise<void> {
    this.cache.set(intentId, {
      value: result,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async unlock(intentId: IntentId): Promise<void> {
    this.cache.delete(intentId);
  }

  // Test helper
  clear(): void {
    this.cache.clear();
  }
}

// =============================================================================
// BARRIER WRAPPER
// =============================================================================

/**
 * Wrap any T3 operation with idempotency barrier.
 *
 * ⚠️ AI NOTE: Use this pattern for ALL T3 saga entry points.
 *
 * @example
 * ```typescript
 * async function checkoutSaga(cmd: CheckoutCommand, ctx: Context) {
 *   return withIdempotency(cache, cmd.intentId, async () => {
 *     // All saga logic here
 *     const compensations: Compensation[] = [];
 *     try {
 *       compensations.push(() => refund(txId));
 *       const txId = await charge(cmd.amount);
 *       // ...
 *       return { success: true, transactionId: txId };
 *     } catch (error) {
 *       await executeCompensations(compensations);
 *       throw error;
 *     }
 *   });
 * }
 * ```
 */
export async function withIdempotency<T>(
  cache: IdempotencyCache,
  intentId: IntentId,
  execute: () => Promise<T>
): Promise<T> {
  // 1. CHECK: Already processed?
  const cached = await cache.check(intentId);
  if (cached !== null) {
    return cached as T;
  }

  // 2. LOCK: Mark as processing
  const locked = await cache.lock(intentId);
  if (!locked) {
    throw new ConcurrentProcessingError(intentId);
  }

  try {
    // 3. EXECUTE
    const result = await execute();

    // 4. STORE
    await cache.store(intentId, result);

    return result;
  } catch (error) {
    // 5. UNLOCK on failure (allow retry with same intentId)
    await cache.unlock(intentId);
    throw error;
  }
}

// =============================================================================
// COMMAND PATTERN
// =============================================================================

/**
 * Base interface for T3 commands.
 * All T3 commands MUST extend this.
 */
export interface IdempotentCommand {
  readonly intentId: IntentId;
}

// Example commands (copy and adapt):

interface CheckoutCommand extends IdempotentCommand {
  readonly orderId: string;
  readonly amount: number;
  readonly expectedVersion: number;
}

interface TransferCommand extends IdempotentCommand {
  readonly fromAccount: string;
  readonly toAccount: string;
  readonly amount: number;
}

interface CancelOrderCommand extends IdempotentCommand {
  readonly orderId: string;
  readonly reason: string;
}

// =============================================================================
// REACT HOOK (Client-Side)
// =============================================================================

/**
 * React hook for idempotent actions.
 *
 * ⚠️ AI NOTE:
 * - intentId is generated ONCE per user action
 * - Same intentId is reused on retry
 * - reset() creates new intentId for new action
 *
 * @example
 * ```tsx
 * function CheckoutButton() {
 *   const { execute, state, canRetry, reset } = useIdempotentAction(
 *     (intentId) => api.checkout({ intentId, ...formData })
 *   );
 *
 *   return (
 *     <>
 *       <button
 *         onClick={execute}
 *         disabled={state === 'loading'}
 *       >
 *         {canRetry ? 'Retry' : 'Checkout'}
 *       </button>
 *       {state === 'success' && <button onClick={reset}>New Order</button>}
 *     </>
 *   );
 * }
 * ```
 */
export function useIdempotentAction<T>(
  action: (intentId: IntentId) => Promise<T>
): {
  execute: () => Promise<T>;
  reset: () => void;
  state: 'idle' | 'loading' | 'success' | 'error';
  canRetry: boolean;
  result: T | null;
  error: Error | null;
} {
  // Note: This is a template. In actual usage, import from React.
  // import { useState, useCallback } from 'react';

  let intentId: IntentId | null = null;
  let state: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  let result: T | null = null;
  let error: Error | null = null;

  const execute = async (): Promise<T> => {
    // Generate once, reuse on retry
    if (!intentId) {
      intentId = createIntentId();
    }

    state = 'loading';
    error = null;

    try {
      result = await action(intentId);
      state = 'success';
      return result;
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      state = 'error';
      // Keep intentId for retry!
      throw error;
    }
  };

  const reset = (): void => {
    intentId = null;
    state = 'idle';
    result = null;
    error = null;
  };

  return {
    execute,
    reset,
    state,
    canRetry: state === 'error',
    result,
    error,
  };
}

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// ✅ CORRECT: T3 saga with idempotency
async function checkoutSaga(
  cmd: CheckoutCommand,
  ctx: Context,
  deps: { cache: IdempotencyCache; payment: PaymentService }
) {
  return withIdempotency(deps.cache, cmd.intentId, async () => {
    const compensations: Array<() => Promise<void>> = [];

    try {
      // Step 1: Charge
      const txId = await deps.payment.charge(cmd.amount);
      compensations.push(() => deps.payment.refund(txId));

      // Step 2: Update order
      await orderRepo.update(cmd.orderId, {
        status: 'paid',
        transactionId: txId,
        version: cmd.expectedVersion + 1,
      });

      return { success: true, transactionId: txId };
    } catch (error) {
      // Run compensations in reverse
      for (const compensate of compensations.reverse()) {
        await compensate();
      }
      throw error;
    }
  });
}

// ❌ WRONG: No idempotency check
async function checkoutBad(cmd: CheckoutCommand) {
  // Network timeout + client retry = double charge!
  return await payment.charge(cmd.amount);
}

// ❌ WRONG: UI-only prevention
function BadCheckoutButton() {
  const [clicked, setClicked] = useState(false);
  const handleClick = () => {
    if (clicked) return; // Page refresh resets this!
    setClicked(true);
    api.checkout();
  };
}
*/

// =============================================================================
// TEMPLATE FOR NEW T3 COMMAND
// =============================================================================

/*
⚠️ AI: Copy this template when creating a new T3 command:

1. Define command interface:
   interface {Name}Command extends IdempotentCommand {
     readonly field1: Type1;
     readonly field2: Type2;
     readonly expectedVersion: number; // For optimistic locking (Pillar F)
   }

2. Create saga function:
   async function {name}Saga(
     cmd: {Name}Command,
     ctx: Context,
     deps: { cache: IdempotencyCache; ... }
   ) {
     return withIdempotency(deps.cache, cmd.intentId, async () => {
       const compensations: Array<() => Promise<void>> = [];
       try {
         // Step 1...
         compensations.push(() => undo1());
         await step1();

         // Step 2...
         compensations.push(() => undo2());
         await step2();

         return { success: true, ... };
       } catch (error) {
         for (const compensate of compensations.reverse()) {
           await compensate();
         }
         throw error;
       }
     });
   }

3. Create React hook (if client triggers):
   const { execute, state } = useIdempotentAction(
     (intentId) => api.{name}({ intentId, ...formData })
   );
*/
