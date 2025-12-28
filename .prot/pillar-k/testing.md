# Pillar K: The Testing Pyramid

> Test strategy differs by architectural layer

## Rule

Apply different testing strategies to different layers:
- **Domain**: 100% unit test coverage
- **Adapters**: Contract tests
- **Workflows/Sagas**: Integration tests

## Purpose

- Optimal test coverage per layer
- Fast feedback from unit tests
- Confidence from integration tests
- Avoid slow, brittle E2E tests for logic

## Implementation

### Testing Pyramid

```
                    /\
                   /  \
                  / E2E\         ← Fewest (critical paths only)
                 /──────\
                /        \
               /Integration\     ← Workflows, Sagas
              /────────────\
             /              \
            /   Contract     \   ← Adapters, API boundaries
           /──────────────────\
          /                    \
         /       Unit           \ ← Domain, Headless (most tests)
        /────────────────────────\
```

### Domain Layer (Unit Tests)

```typescript
// 01_domains/order/rules.test.ts
import { calculateOrderTotal, canRefund } from './rules';

describe('Order Rules', () => {
  describe('calculateOrderTotal', () => {
    it('sums item prices with quantities', () => {
      const items = [
        { price: 100, quantity: 2 },
        { price: 50, quantity: 1 },
      ];
      expect(calculateOrderTotal(items)).toBe(250);
    });

    it('applies discount correctly', () => {
      const items = [{ price: 100, quantity: 1 }];
      expect(calculateOrderTotal(items, { discount: 10 })).toBe(90);
    });
  });

  describe('canRefund', () => {
    it('returns true for completed orders within 30 days', () => {
      const order = OrderFactory.create({
        status: 'completed',
        createdAt: daysAgo(15),
      });
      expect(canRefund(order)).toBe(true);
    });

    it('returns false for orders older than 30 days', () => {
      const order = OrderFactory.create({
        status: 'completed',
        createdAt: daysAgo(45),
      });
      expect(canRefund(order)).toBe(false);
    });
  });
});
```

### Headless Layer (Unit Tests)

```typescript
// 02_modules/cart/headless/useCart.test.ts
import { renderHook, act } from '@testing-library/react';
import { useCartLogic } from './useCartLogic';

describe('useCartLogic', () => {
  it('adds items correctly', () => {
    const { result } = renderHook(() => useCartLogic());

    act(() => {
      result.current.addItem({
        id: 'item-1' as ItemId,
        price: 100,
        quantity: 1,
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalPrice).toBe(100);
  });

  it('calculates total with multiple items', () => {
    const { result } = renderHook(() => useCartLogic());

    act(() => {
      result.current.addItem({ id: 'item-1', price: 100, quantity: 2 });
      result.current.addItem({ id: 'item-2', price: 50, quantity: 1 });
    });

    expect(result.current.totalPrice).toBe(250);
    expect(result.current.itemCount).toBe(3);
  });
});
```

### Adapter Layer (Contract Tests)

```typescript
// 02_modules/order/adapters/orderApi.test.ts
import { orderApi } from './orderApi';
import { OrderSchema } from '../types';

describe('OrderApi Contract', () => {
  it('getOrder returns data matching schema', async () => {
    const response = await orderApi.getOrder('order-123' as OrderId);

    // Verify response matches contract
    const parseResult = OrderSchema.safeParse(response);
    expect(parseResult.success).toBe(true);
  });

  it('createOrder accepts valid command', async () => {
    const command = {
      items: [{ productId: 'prod-1', quantity: 1 }],
      userId: 'user-1' as UserId,
    };

    const response = await orderApi.createOrder(command);

    expect(response).toHaveProperty('id');
    expect(OrderSchema.safeParse(response).success).toBe(true);
  });
});
```

### Workflow Layer (Integration Tests)

```typescript
// 02_modules/checkout/workflows/checkout.integration.test.ts
import { processCheckout } from './checkoutSaga';

describe('Checkout Saga Integration', () => {
  let mockPayment: jest.Mock;
  let mockInventory: jest.Mock;
  let mockNotification: jest.Mock;

  beforeEach(() => {
    mockPayment = jest.fn().mockResolvedValue({ txId: 'tx-123' });
    mockInventory = jest.fn().mockResolvedValue(true);
    mockNotification = jest.fn().mockResolvedValue(true);
  });

  it('completes full checkout flow', async () => {
    const cmd = CheckoutCommandFactory.create();
    const ctx = createTestContext();

    const result = await processCheckout(cmd, ctx, {
      paymentAdapter: mockPayment,
      inventoryAdapter: mockInventory,
      notificationAdapter: mockNotification,
    });

    expect(result.success).toBe(true);
    expect(mockPayment).toHaveBeenCalledWith(cmd.amount);
    expect(mockInventory).toHaveBeenCalledWith(cmd.items);
    expect(mockNotification).toHaveBeenCalled();
  });

  it('compensates on payment failure', async () => {
    mockPayment.mockRejectedValue(new Error('Payment failed'));

    const cmd = CheckoutCommandFactory.create();
    const ctx = createTestContext();

    await expect(processCheckout(cmd, ctx, {
      paymentAdapter: mockPayment,
      inventoryAdapter: mockInventory,
    })).rejects.toThrow('Payment failed');

    // Verify no inventory was reserved (or was rolled back)
    expect(mockInventory).not.toHaveBeenCalled();
  });

  it('handles idempotency correctly', async () => {
    const cmd = CheckoutCommandFactory.create();
    const ctx = createTestContext();

    // First call
    const result1 = await processCheckout(cmd, ctx, { /* adapters */ });

    // Second call with same intentId
    const result2 = await processCheckout(cmd, ctx, { /* adapters */ });

    expect(result1).toEqual(result2);
    expect(mockPayment).toHaveBeenCalledTimes(1);  // Only charged once
  });
});
```

## Coverage Guidelines

| Layer | Coverage Target | Test Type |
|-------|-----------------|-----------|
| `01_domains/` | 100% | Unit |
| `headless/` | 90%+ | Unit |
| `adapters/` | Schema coverage | Contract |
| `workflows/` | All paths | Integration |
| `views/` | Critical paths | Snapshot/E2E |

## Good Example

```typescript
// ✅ Layer-appropriate testing

// Domain: Pure unit test
test('calculateTax applies correct rate', () => {
  expect(calculateTax(100, 'CA')).toBe(7.25);
});

// Headless: Hook unit test
test('useCart updates total on add', () => {
  const { result } = renderHook(() => useCart());
  act(() => result.current.addItem(item));
  expect(result.current.total).toBe(100);
});

// Adapter: Contract test
test('API response matches schema', async () => {
  const data = await api.fetch();
  expect(Schema.safeParse(data).success).toBe(true);
});

// Saga: Integration test
test('checkout compensates on failure', async () => {
  // Test full flow with mocked adapters
});
```

## Bad Example

```typescript
// ❌ E2E test for business logic
test('order total calculation', async () => {
  await browser.goto('/cart');
  await browser.click('#add-item');
  await browser.click('#add-item');
  // Slow, brittle, tests infrastructure not logic
  expect(await browser.getText('#total')).toBe('$200');
});

// ❌ No contract test for API
test('fetch user', async () => {
  const user = await api.getUser('123');
  expect(user.name).toBe('John');  // Doesn't verify schema
});
```

## Anti-Patterns

1. **E2E tests for logic**
   ```typescript
   // ❌ Use unit tests instead
   it('validates email format', async () => {
     await page.type('#email', 'invalid');
     // ...browser automation for simple validation
   });
   ```

2. **No contract tests**
   ```typescript
   // ❌ API changes break app silently
   const data = await api.fetch();
   // No schema validation
   ```

3. **Mocking everything**
   ```typescript
   // ❌ Over-mocking loses integration confidence
   jest.mock('./database');
   jest.mock('./cache');
   jest.mock('./api');
   // What are we even testing?
   ```

## Checklist

- [ ] Domain layer has 100% unit test coverage
- [ ] Headless hooks have unit tests
- [ ] Adapters have contract/schema tests
- [ ] Sagas have integration tests with mocked adapters
- [ ] E2E tests cover only critical user journeys
- [ ] Mock factories generate from schemas (Pillar C)

## References

- Related: Pillar C (Mocking) - test data generation
- Related: Pillar M (Saga) - test compensation
- Pattern: Testing Pyramid, Contract Testing
- Template: `.prot/pillar-k/testing.ts`
- Checklist: `.prot/pillar-k/checklist.md`
