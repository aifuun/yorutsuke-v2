# Pillar P: Circuit Breaking & Safe Mode

> Detect failures and degrade gracefully

## Rule

System must detect downstream failures and automatically degrade to **Safe Mode** when error thresholds are exceeded.

## Purpose

- Fail fast when downstream is unhealthy
- Prevent cascade failures
- Provide degraded but usable experience
- Allow time for recovery

## Implementation

### Circuit Breaker States

```typescript
type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: Date | null;
  successCount: number;  // For half-open
}

interface CircuitConfig {
  failureThreshold: number;    // Failures to open
  successThreshold: number;    // Successes to close
  timeout: number;             // ms before half-open
  monitorWindow: number;       // ms for failure counting
}
```

### Circuit Breaker Implementation

```typescript
// infrastructure/circuitBreaker.ts

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: Date[] = [];
  private halfOpenSuccesses = 0;

  constructor(
    private name: string,
    private config: CircuitConfig
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        this.halfOpenSuccesses = 0;
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.reset();
        logger.json('CIRCUIT_CLOSED', { name: this.name });
      }
    }
  }

  private onFailure(): void {
    const now = new Date();

    // Clean old failures outside monitoring window
    this.failures = this.failures.filter(
      f => now.getTime() - f.getTime() < this.config.monitorWindow
    );

    this.failures.push(now);

    if (this.failures.length >= this.config.failureThreshold) {
      this.state = 'open';
      logger.json('CIRCUIT_OPENED', {
        name: this.name,
        failures: this.failures.length,
      });
    }
  }

  private shouldAttemptReset(): boolean {
    const lastFailure = this.failures[this.failures.length - 1];
    if (!lastFailure) return true;

    return Date.now() - lastFailure.getTime() > this.config.timeout;
  }

  private reset(): void {
    this.state = 'closed';
    this.failures = [];
    this.halfOpenSuccesses = 0;
  }
}
```

### Service with Circuit Breaker

```typescript
// adapters/paymentAdapter.ts

const paymentCircuit = new CircuitBreaker('payment-service', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
  monitorWindow: 60000,
});

async function chargePayment(amount: Money): Promise<PaymentResult> {
  try {
    return await paymentCircuit.execute(async () => {
      return await stripeClient.charges.create({ amount });
    });
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // Return safe mode response
      return {
        status: 'degraded',
        message: 'Payment service temporarily unavailable',
        retryAfter: 30,
      };
    }
    throw error;
  }
}
```

### Safe Mode UI

```typescript
// headless/useSafeMode.ts

interface SafeModeState {
  isActive: boolean;
  degradedServices: string[];
  message: string;
}

function useSafeMode(): SafeModeState {
  const [state, setState] = useState<SafeModeState>({
    isActive: false,
    degradedServices: [],
    message: '',
  });

  useEffect(() => {
    const checkHealth = async () => {
      const health = await api.getSystemHealth();

      setState({
        isActive: health.degradedServices.length > 0,
        degradedServices: health.degradedServices,
        message: health.message,
      });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return state;
}

// View with safe mode awareness
function CheckoutButton() {
  const { isActive: safeMode, message } = useSafeMode();
  const { checkout, isLoading } = useCheckout();

  if (safeMode) {
    return (
      <div className="safe-mode-banner">
        <p>{message}</p>
        <button disabled>Checkout Unavailable</button>
      </div>
    );
  }

  return <button onClick={checkout}>Checkout</button>;
}
```

### Fallback Strategies

```typescript
// Cached fallback
async function getProductCatalog(): Promise<Product[]> {
  try {
    return await catalogCircuit.execute(() => catalogApi.getAll());
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // Return cached data
      const cached = await cache.get('product-catalog');
      if (cached) {
        return { ...cached, stale: true };
      }
    }
    throw error;
  }
}

// Partial degradation
async function getOrderDetails(orderId: OrderId): Promise<OrderDetails> {
  const order = await orderService.get(orderId);

  // Try to enrich with recommendations
  let recommendations: Product[] = [];
  try {
    recommendations = await recommendationCircuit.execute(
      () => recommendationService.forOrder(orderId)
    );
  } catch {
    // Recommendations unavailable - continue without
  }

  return { ...order, recommendations };
}
```

## Good Example

```typescript
// ✅ Complete circuit breaker with safe mode

const externalApiCircuit = new CircuitBreaker('external-api', config);

async function fetchExternalData(): Promise<Data> {
  try {
    return await externalApiCircuit.execute(() => externalApi.fetch());
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      logger.warn('SAFE_MODE_ACTIVE', { service: 'external-api' });

      // Try cache
      const cached = await cache.get('external-data');
      if (cached) {
        return { ...cached, source: 'cache', stale: true };
      }

      // Return degraded response
      return {
        data: [],
        source: 'fallback',
        message: 'Service temporarily unavailable',
      };
    }
    throw error;
  }
}
```

## Bad Example

```typescript
// ❌ No circuit breaker - cascade failure
async function fetchData() {
  // Every request hits failing service
  // No timeout, hangs forever
  // Brings down entire system
  return await failingService.fetch();
}

// ❌ Circuit without fallback
async function fetchData() {
  return await circuit.execute(() => service.fetch());
  // CircuitOpenError crashes the app!
}
```

## Anti-Patterns

1. **No timeout on circuit calls**
   ```typescript
   // ❌ Can hang forever
   await circuit.execute(() => slowService.call());
   ```

2. **Circuit without monitoring**
   ```typescript
   // ❌ No visibility into circuit state
   const circuit = new CircuitBreaker(config);
   // No logging, no metrics
   ```

3. **Immediate retry loop**
   ```typescript
   // ❌ Hammers failing service
   while (true) {
     try { return await service.call(); }
     catch { continue; }
   }
   ```

4. **All-or-nothing degradation**
   ```typescript
   // ❌ Should degrade gracefully
   if (anyServiceDown) showErrorPage();
   ```

## Exceptions

- Internal services with guaranteed availability
- Critical path with no fallback possible

## Checklist

- [ ] External services wrapped in circuit breakers
- [ ] Failure thresholds configured appropriately
- [ ] Safe mode UI informs users
- [ ] Cached fallbacks available
- [ ] Circuit state logged for monitoring
- [ ] Write operations disabled in safe mode

## References

- Related: Pillar O (Async) - timeout handling
- Related: Pillar R (Observability) - circuit state logging
- Pattern: Circuit Breaker, Bulkhead, Retry with Backoff

## Assets

- Template: `.prot/pillar-p/circuit.ts`
- Checklist: `.prot/pillar-p/checklist.md`
