# Pillar P: Circuit Breaker & Safe Mode Checklist

> Use this checklist when integrating external services or implementing degradation

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Fail Fast** | Open circuit prevents cascading failures |
| **Graceful Degradation** | Always provide fallback for CircuitOpenError |
| **Visibility** | Log all state transitions for observability |

## Circuit Breaker Setup

### 1. Create Circuit Breaker

```typescript
// adapters/paymentCircuit.ts
import { createCircuitBreaker } from '@/kernel/circuit';

// One circuit per external service
export const paymentCircuit = createCircuitBreaker(
  'payment-service',
  'critical'  // or 'standard', 'lenient'
);
```

- [ ] One circuit breaker per external service
- [ ] Circuit created as module-level singleton
- [ ] Appropriate preset selected based on criticality
- [ ] Custom config overrides if needed

### 2. Configuration Selection

| Preset | Use Case | Failure Threshold | Reset Timeout |
|--------|----------|-------------------|---------------|
| `critical` | Payments, Auth | 3 failures | 60 seconds |
| `standard` | APIs, Databases | 5 failures | 30 seconds |
| `lenient` | Recommendations, Analytics | 10 failures | 15 seconds |

- [ ] Critical services use `critical` preset
- [ ] Standard services use `standard` preset
- [ ] Non-essential features use `lenient` preset
- [ ] Call timeout configured (prevents hanging)

### 3. Wrap External Calls

```typescript
async function chargePayment(amount: Money): Promise<PaymentResult> {
  try {
    return await paymentCircuit.execute(async () => {
      return await stripeApi.charges.create({ amount });
    });
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // Fallback response
      return {
        status: 'degraded',
        message: 'Payment temporarily unavailable',
        retryAfterMs: error.retryAfterMs,
      };
    }
    throw error;
  }
}
```

- [ ] External call wrapped in `circuit.execute()`
- [ ] CircuitOpenError caught and handled
- [ ] Fallback response provided
- [ ] Other errors re-thrown

## Fallback Strategies

### 4. Cache Fallback

```typescript
async function getProducts(): Promise<Product[]> {
  try {
    const products = await catalogCircuit.execute(() => api.getAll());
    await cache.set('products', products);  // Update cache
    return products;
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      const cached = await cache.get<Product[]>('products');
      if (cached) {
        return cached.map(p => ({ ...p, stale: true }));
      }
      return [];  // Empty fallback
    }
    throw error;
  }
}
```

- [ ] Successful responses cached
- [ ] Cache used as fallback when circuit open
- [ ] Stale data marked with `stale: true`
- [ ] Empty fallback if no cache available

### 5. Partial Degradation

```typescript
// Non-critical features fail silently
async function getOrderPage(orderId: OrderId): Promise<OrderPage> {
  const order = await orderService.get(orderId);  // Critical

  let recommendations: Product[] = [];
  try {
    recommendations = await recCircuit.execute(() => recApi.get(orderId));
  } catch {
    // Silent fail - recommendations are optional
  }

  return { order, recommendations };
}
```

- [ ] Critical operations always execute
- [ ] Non-critical features wrapped separately
- [ ] Silent failure for optional features
- [ ] Page renders with partial data

## Safe Mode UI

### 6. SafeModeProvider Setup

```typescript
// App.tsx
<SafeModeProvider
  healthCheckUrl="/api/health"
  checkIntervalMs={30000}
>
  <App />
</SafeModeProvider>
```

- [ ] SafeModeProvider wraps app
- [ ] Health check URL configured
- [ ] Check interval appropriate (30-60 seconds)

### 7. Safe Mode Aware Components

```typescript
function CheckoutButton() {
  const { isActive: safeMode } = useSafeMode();
  const paymentAvailable = useIsServiceAvailable('payment-service');

  if (safeMode || !paymentAvailable) {
    return <DisabledCheckout message="Payment unavailable" />;
  }

  return <CheckoutButton />;
}
```

- [ ] Critical buttons check safe mode
- [ ] Service availability checked before actions
- [ ] User informed of degradation
- [ ] Fallback UI provided

## Code Review Checklist

### Circuit Breaker Implementation

- [ ] All external services have circuit breakers
- [ ] CircuitOpenError always caught
- [ ] Fallback provided for every circuit call
- [ ] Timeout configured for circuit calls
- [ ] Circuit state logged on transitions

### Fallback Quality

- [ ] Cache fallback marks data as stale
- [ ] Empty fallbacks are sensible (not null/undefined)
- [ ] User informed when in degraded mode
- [ ] Critical operations have explicit fallback message

### Health Check

- [ ] `/api/health` endpoint exists
- [ ] Returns list of degraded services
- [ ] Frontend polls health periodically
- [ ] Health check itself has short timeout

## Common Patterns

### External API Call

```typescript
// adapters/externalApi.ts
const circuit = createCircuitBreaker('external-api', 'standard');

export async function fetchData(): Promise<Data> {
  try {
    return await circuit.execute(() => externalApi.fetch());
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      logger.warn('CIRCUIT_OPEN', { service: 'external-api' });

      // Try cache
      const cached = await cache.get<Data>('external-data');
      if (cached) return { ...cached, stale: true };

      // Degraded response
      return { data: [], source: 'fallback', message: 'Service unavailable' };
    }
    throw error;
  }
}
```

### Payment Service (Critical)

```typescript
const paymentCircuit = createCircuitBreaker('payment', 'critical', {
  failureThreshold: 2,  // Even more sensitive
  callTimeout: 15_000,  // Payment timeout
});

export async function charge(amount: Money): Promise<PaymentResult> {
  try {
    return await paymentCircuit.execute(() => stripe.charge(amount));
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // Payment CANNOT silently fail - inform user explicitly
      return {
        success: false,
        status: 'service_unavailable',
        message: 'Payment processing is temporarily unavailable. Please try again in a few minutes.',
        retryAfterSeconds: Math.ceil(error.retryAfterMs / 1000),
      };
    }
    throw error;
  }
}
```

### Multiple Services Orchestration

```typescript
async function getCheckoutPage(cartId: CartId): Promise<CheckoutPage> {
  // Critical - must work
  const cart = await cartService.get(cartId);

  // Optional services - fail gracefully
  const [recommendations, promotions, reviews] = await Promise.allSettled([
    recCircuit.execute(() => recApi.forCart(cartId)),
    promoCircuit.execute(() => promoApi.forCart(cartId)),
    reviewCircuit.execute(() => reviewApi.forProducts(cart.productIds)),
  ]);

  return {
    cart,
    recommendations: recommendations.status === 'fulfilled' ? recommendations.value : [],
    promotions: promotions.status === 'fulfilled' ? promotions.value : [],
    reviews: reviews.status === 'fulfilled' ? reviews.value : [],
  };
}
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| No circuit breaker | Cascade failures | Wrap all external calls |
| `await circuit.execute(...)` without catch | CircuitOpenError crashes app | Always catch CircuitOpenError |
| Retry loop | Hammers failing service | Use circuit breaker with backoff |
| Global safe mode | Everything disabled | Per-service degradation |
| No timeout | Calls hang forever | Configure `callTimeout` |
| Circuit without logging | No visibility | Log state transitions |

## Verification Commands

```bash
# Find external API calls without circuit
grep -r "await fetch\|await axios\|await http" src/**/*.ts | grep -v circuit

# Find circuit.execute without error handling
grep -rB5 "circuit.execute" src/**/*.ts | grep -v "CircuitOpenError"

# Check circuit configurations
grep -r "createCircuitBreaker" src/**/*.ts
```

## Template Reference

- Circuit breaker: `.prot/pillar-p/circuit.ts`
- Related: Pillar O (Async) - timeout handling
- Related: Pillar R (Observability) - state logging
