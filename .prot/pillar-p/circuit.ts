/**
 * Pillar P: Circuit Breaker & Safe Mode Template
 *
 * Detect failures and degrade gracefully with circuit breaker pattern.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - COPY this pattern for external service calls
 * - Create ONE circuit breaker per external dependency
 * - ALWAYS provide fallback for CircuitOpenError
 * - Log all state transitions for observability
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Circuit breaker states (FSM - Pillar D).
 *
 * ⚠️ AI NOTE: State machine, NOT boolean flags
 *
 * State transitions:
 *   closed --(failures >= threshold)--> open
 *   open   --(timeout elapsed)--------> half-open
 *   half-open --(success threshold)---> closed
 *   half-open --(any failure)---------> open
 */
type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitConfig {
  /** Name for logging/metrics */
  name: string;

  /** Number of failures to trigger open state */
  failureThreshold: number;

  /** Number of successes in half-open to close */
  successThreshold: number;

  /** Milliseconds before trying half-open after open */
  resetTimeout: number;

  /** Milliseconds window for counting failures */
  monitorWindow: number;

  /** Optional timeout for each call (recommended!) */
  callTimeout?: number;
}

interface CircuitStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastStateChange: Date;
}

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Thrown when circuit is open and call is rejected.
 *
 * ⚠️ AI NOTE: ALWAYS catch this and provide fallback!
 */
class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly retryAfterMs: number
  ) {
    super(`Circuit '${circuitName}' is open. Retry after ${retryAfterMs}ms`);
    this.name = 'CircuitOpenError';
  }
}

class CircuitCallTimeoutError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly timeoutMs: number
  ) {
    super(`Circuit '${circuitName}' call timed out after ${timeoutMs}ms`);
    this.name = 'CircuitCallTimeoutError';
  }
}

// =============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// =============================================================================

/**
 * Circuit breaker for external service calls.
 *
 * ⚠️ AI NOTE:
 * - Create ONE instance per external service
 * - Store as module-level constant
 * - Share across all calls to same service
 */
class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: Date[] = [];
  private halfOpenSuccesses = 0;
  private lastStateChange = new Date();

  constructor(private readonly config: CircuitConfig) {}

  /**
   * Execute function with circuit breaker protection.
   *
   * ⚠️ AI NOTE:
   * - Wrap ALL external service calls with this
   * - ALWAYS handle CircuitOpenError in caller
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        const retryAfter = this.getRetryAfterMs();
        throw new CircuitOpenError(this.config.name, retryAfter);
      }
    }

    // Execute with optional timeout
    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.config.callTimeout) {
      return fn();
    }

    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new CircuitCallTimeoutError(
            this.config.name,
            this.config.callTimeout!
          ));
        }, this.config.callTimeout);
      }),
    ]);
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.halfOpenSuccesses++;

      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed');
        this.reset();
      }
    } else if (this.state === 'closed') {
      // Clear old failures on success
      this.cleanOldFailures();
    }
  }

  private onFailure(error: unknown): void {
    if (this.state === 'half-open') {
      // Any failure in half-open goes back to open
      this.transitionTo('open');
      return;
    }

    // Record failure
    const now = new Date();
    this.failures.push(now);
    this.cleanOldFailures();

    // Check threshold
    if (this.failures.length >= this.config.failureThreshold) {
      this.transitionTo('open');
    }

    // Log failure (Pillar R)
    this.logEvent('CIRCUIT_FAILURE', {
      error: error instanceof Error ? error.message : String(error),
      failureCount: this.failures.length,
      threshold: this.config.failureThreshold,
    });
  }

  private cleanOldFailures(): void {
    const now = Date.now();
    this.failures = this.failures.filter(
      f => now - f.getTime() < this.config.monitorWindow
    );
  }

  private shouldAttemptReset(): boolean {
    const elapsed = Date.now() - this.lastStateChange.getTime();
    return elapsed >= this.config.resetTimeout;
  }

  private getRetryAfterMs(): number {
    const elapsed = Date.now() - this.lastStateChange.getTime();
    return Math.max(0, this.config.resetTimeout - elapsed);
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    if (newState === 'half-open') {
      this.halfOpenSuccesses = 0;
    }

    // Log state transition (Pillar R)
    this.logEvent('CIRCUIT_STATE_CHANGE', {
      from: oldState,
      to: newState,
    });
  }

  private reset(): void {
    this.failures = [];
    this.halfOpenSuccesses = 0;
  }

  private logEvent(event: string, data: Record<string, unknown>): void {
    // Replace with your logger (Pillar R)
    console.log(JSON.stringify({
      event,
      circuit: this.config.name,
      state: this.state,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  }

  // Public getters for monitoring
  getStats(): CircuitStats {
    return {
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.halfOpenSuccesses,
      lastFailureTime: this.failures.length > 0
        ? this.failures[this.failures.length - 1]
        : null,
      lastStateChange: this.lastStateChange,
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === 'open';
  }
}

// =============================================================================
// CIRCUIT BREAKER FACTORY
// =============================================================================

/**
 * Default configurations for common scenarios.
 *
 * ⚠️ AI NOTE: Adjust thresholds based on service characteristics
 */
const DEFAULT_CONFIGS = {
  /** For critical services (payments, auth) */
  critical: {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeout: 60_000,      // 1 minute
    monitorWindow: 30_000,     // 30 seconds
    callTimeout: 10_000,       // 10 seconds
  },

  /** For standard services (APIs, databases) */
  standard: {
    failureThreshold: 5,
    successThreshold: 3,
    resetTimeout: 30_000,      // 30 seconds
    monitorWindow: 60_000,     // 1 minute
    callTimeout: 30_000,       // 30 seconds
  },

  /** For non-critical services (recommendations, analytics) */
  lenient: {
    failureThreshold: 10,
    successThreshold: 5,
    resetTimeout: 15_000,      // 15 seconds
    monitorWindow: 120_000,    // 2 minutes
    callTimeout: 60_000,       // 1 minute
  },
} as const;

type CircuitPreset = keyof typeof DEFAULT_CONFIGS;

function createCircuitBreaker(
  name: string,
  preset: CircuitPreset = 'standard',
  overrides: Partial<CircuitConfig> = {}
): CircuitBreaker {
  return new CircuitBreaker({
    name,
    ...DEFAULT_CONFIGS[preset],
    ...overrides,
  });
}

// =============================================================================
// SAFE MODE HOOK (React)
// =============================================================================

/*
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

/**
 * Safe mode state for UI degradation.
 *
 * ⚠️ AI NOTE:
 * - Check isActive before allowing critical operations
 * - Show degradedServices to user
 * - Provide fallback UI when services are down
 * /
interface SafeModeState {
  isActive: boolean;
  degradedServices: string[];
  message: string;
  lastCheck: Date;
}

const SafeModeContext = createContext<SafeModeState | null>(null);

interface SafeModeProviderProps {
  children: ReactNode;
  healthCheckUrl: string;
  checkIntervalMs?: number;
}

function SafeModeProvider({
  children,
  healthCheckUrl,
  checkIntervalMs = 30_000,
}: SafeModeProviderProps) {
  const [state, setState] = useState<SafeModeState>({
    isActive: false,
    degradedServices: [],
    message: '',
    lastCheck: new Date(),
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(healthCheckUrl);
        const health = await response.json();

        setState({
          isActive: health.degradedServices?.length > 0,
          degradedServices: health.degradedServices || [],
          message: health.message || '',
          lastCheck: new Date(),
        });
      } catch {
        // Health check failed - assume safe mode
        setState(prev => ({
          ...prev,
          isActive: true,
          message: 'Unable to check system health',
          lastCheck: new Date(),
        }));
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, checkIntervalMs);
    return () => clearInterval(interval);
  }, [healthCheckUrl, checkIntervalMs]);

  return (
    <SafeModeContext.Provider value={state}>
      {children}
    </SafeModeContext.Provider>
  );
}

function useSafeMode(): SafeModeState {
  const ctx = useContext(SafeModeContext);
  if (!ctx) {
    throw new Error('useSafeMode must be used within SafeModeProvider');
  }
  return ctx;
}

function useIsServiceAvailable(serviceName: string): boolean {
  const { degradedServices } = useSafeMode();
  return !degradedServices.includes(serviceName);
}
*/

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// ✅ CORRECT: Circuit breaker with fallback

// 1. Create circuit breaker (module-level singleton)
const paymentCircuit = createCircuitBreaker('payment-service', 'critical');

// 2. Wrap external call
async function chargePayment(amount: Money): Promise<PaymentResult> {
  try {
    return await paymentCircuit.execute(async () => {
      return await stripeApi.charges.create({ amount });
    });
  } catch (error) {
    // 3. Handle circuit open with fallback
    if (error instanceof CircuitOpenError) {
      return {
        status: 'degraded',
        message: 'Payment service temporarily unavailable',
        retryAfterMs: error.retryAfterMs,
      };
    }
    throw error;
  }
}


// ✅ CORRECT: Cached fallback

const catalogCircuit = createCircuitBreaker('catalog-service', 'standard');

async function getProducts(): Promise<Product[]> {
  try {
    const products = await catalogCircuit.execute(() => catalogApi.getAll());

    // Cache for fallback
    await cache.set('products', products, { ttl: 300_000 });

    return products;
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // Try cache first
      const cached = await cache.get<Product[]>('products');
      if (cached) {
        return cached.map(p => ({ ...p, stale: true }));
      }

      // Return empty with message
      return [];
    }
    throw error;
  }
}


// ✅ CORRECT: Partial degradation (non-critical features)

const recommendationCircuit = createCircuitBreaker('recommendations', 'lenient');

async function getOrderPage(orderId: OrderId): Promise<OrderPage> {
  // Critical: always fetch order
  const order = await orderService.get(orderId);

  // Non-critical: try recommendations, fallback to empty
  let recommendations: Product[] = [];
  try {
    recommendations = await recommendationCircuit.execute(
      () => recommendationApi.forOrder(orderId)
    );
  } catch {
    // Recommendations unavailable - continue without
    // Don't propagate error, just degrade gracefully
  }

  return { order, recommendations };
}


// ✅ CORRECT: Safe mode UI

function CheckoutButton() {
  const { isActive: safeMode, message } = useSafeMode();
  const paymentAvailable = useIsServiceAvailable('payment-service');
  const { checkout, isLoading } = useCheckout();

  if (safeMode || !paymentAvailable) {
    return (
      <div className="safe-mode-banner">
        <AlertIcon />
        <p>{message || 'Payment is temporarily unavailable'}</p>
        <button disabled>Checkout Unavailable</button>
      </div>
    );
  }

  return (
    <button onClick={checkout} disabled={isLoading}>
      {isLoading ? 'Processing...' : 'Checkout'}
    </button>
  );
}


// ❌ WRONG: No circuit breaker

async function chargePayment(amount: Money) {
  // No protection - cascades failures
  return await stripeApi.charges.create({ amount });
}


// ❌ WRONG: Circuit without fallback

async function chargePayment(amount: Money) {
  // CircuitOpenError will crash the app!
  return await paymentCircuit.execute(() =>
    stripeApi.charges.create({ amount })
  );
}


// ❌ WRONG: Retry loop without backoff

async function chargePayment(amount: Money) {
  while (true) {
    try {
      return await stripeApi.charges.create({ amount });
    } catch {
      // ❌ Hammers the failing service!
      continue;
    }
  }
}
*/

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

/**
 * Health check response for safe mode.
 *
 * ⚠️ AI NOTE: Expose this endpoint for frontend safe mode checks
 */
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  degradedServices: string[];
  message: string;
  timestamp: string;
}

// Example circuit registry for health checks
const circuitRegistry = new Map<string, CircuitBreaker>();

function registerCircuit(circuit: CircuitBreaker, name: string): void {
  circuitRegistry.set(name, circuit);
}

function getSystemHealth(): HealthCheckResponse {
  const degradedServices: string[] = [];

  for (const [name, circuit] of circuitRegistry) {
    if (circuit.isOpen()) {
      degradedServices.push(name);
    }
  }

  const status = degradedServices.length === 0
    ? 'healthy'
    : degradedServices.length < circuitRegistry.size
      ? 'degraded'
      : 'unhealthy';

  const messages: Record<string, string> = {
    healthy: 'All systems operational',
    degraded: `Some services are temporarily unavailable: ${degradedServices.join(', ')}`,
    unhealthy: 'System is experiencing issues. Please try again later.',
  };

  return {
    status,
    degradedServices,
    message: messages[status],
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Core
  CircuitBreaker,
  CircuitConfig,
  CircuitState,
  CircuitStats,

  // Factory
  createCircuitBreaker,
  CircuitPreset,
  DEFAULT_CONFIGS,

  // Errors
  CircuitOpenError,
  CircuitCallTimeoutError,

  // Health
  registerCircuit,
  getSystemHealth,
  HealthCheckResponse,
};
