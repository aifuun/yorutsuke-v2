// Circuit Breaker - Pillar P: Fail fast on errors
import { logger, EVENTS } from '../telemetry';

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  failureThreshold?: number;  // Failures before opening (default: 3)
  resetTimeout?: number;      // Time before half-open (default: 30000ms)
  successThreshold?: number;  // Successes to close from half-open (default: 1)
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
}

/**
 * CircuitBreaker - Prevents cascading failures
 *
 * States:
 * - closed: Normal operation, requests pass through
 * - open: Requests fail immediately (circuit tripped)
 * - half-open: Testing if service recovered
 *
 * @example
 * const breaker = createCircuitBreaker({ failureThreshold: 3 });
 *
 * try {
 *   const result = await breaker.execute(() => fetchData());
 * } catch (e) {
 *   if (e.message === 'Circuit is open') {
 *     // Show cached data or offline message
 *   }
 * }
 */
export function createCircuitBreaker(options: CircuitBreakerOptions = {}) {
  const {
    failureThreshold = 3,
    resetTimeout = 30000,
    successThreshold = 1,
  } = options;

  const state: CircuitBreakerState = {
    state: 'closed',
    failures: 0,
    successes: 0,
    lastFailure: null,
  };

  function canExecute(): boolean {
    if (state.state === 'closed') return true;

    if (state.state === 'open') {
      // Check if enough time passed to try half-open
      if (state.lastFailure && Date.now() - state.lastFailure >= resetTimeout) {
        state.state = 'half-open';
        state.successes = 0;
        logger.info(EVENTS.CIRCUIT_HALF_OPEN);
        return true;
      }
      return false;
    }

    // half-open: allow single request
    return true;
  }

  function recordSuccess(): void {
    if (state.state === 'half-open') {
      state.successes++;
      if (state.successes >= successThreshold) {
        state.state = 'closed';
        state.failures = 0;
        logger.info(EVENTS.CIRCUIT_CLOSED);
      }
    } else {
      state.failures = 0;
    }
  }

  function recordFailure(): void {
    state.failures++;
    state.lastFailure = Date.now();

    if (state.state === 'half-open') {
      state.state = 'open';
      logger.warn(EVENTS.CIRCUIT_OPENED, { reason: 'half_open_test_failed' });
    } else if (state.failures >= failureThreshold) {
      state.state = 'open';
      logger.warn(EVENTS.CIRCUIT_OPENED, {
        reason: 'threshold_reached',
        failures: state.failures,
        threshold: failureThreshold,
      });
    }
  }

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!canExecute()) {
      throw new Error('Circuit is open');
    }

    try {
      const result = await fn();
      recordSuccess();
      return result;
    } catch (error) {
      recordFailure();
      throw error;
    }
  }

  function reset(): void {
    state.state = 'closed';
    state.failures = 0;
    state.successes = 0;
    state.lastFailure = null;
    logger.info(EVENTS.CIRCUIT_CLOSED, { reason: 'manual_reset' });
  }

  function getState(): CircuitState {
    return state.state;
  }

  return {
    execute,
    reset,
    getState,
    canExecute,
  };
}

// Default circuit breaker for API calls
export const apiCircuitBreaker = createCircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,
});
