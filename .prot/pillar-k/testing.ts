/**
 * Pillar K: Testing Pyramid Template
 *
 * Test strategy differs by architectural layer.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - DOMAIN: 100% unit test coverage
 * - HEADLESS: Unit tests for hooks
 * - ADAPTERS: Contract/schema tests
 * - WORKFLOWS: Integration tests with mocked adapters
 * - E2E: Critical paths only
 */

// =============================================================================
// TESTING PYRAMID
// =============================================================================

/*
                    /\
                   /  \
                  / E2E\           ← Fewest (critical user journeys only)
                 /──────\
                /        \
               /Integration\       ← Workflows, Sagas (with mocked adapters)
              /────────────\
             /              \
            /   Contract     \     ← Adapters, API boundaries (schema validation)
           /──────────────────\
          /                    \
         /       Unit           \  ← Domain, Headless (most tests, fastest)
        /────────────────────────\

Coverage Targets:
- 01_domains/  → 100% unit coverage
- headless/    → 90%+ unit coverage
- adapters/    → Schema coverage
- workflows/   → All paths integration
- views/       → Critical paths only
*/

// =============================================================================
// DOMAIN LAYER: UNIT TESTS
// =============================================================================

/**
 * Domain layer testing pattern.
 *
 * ⚠️ AI NOTE:
 * - Test pure functions directly
 * - No mocking needed (pure logic)
 * - 100% coverage expected
 * - Fast execution
 */

// Example domain functions to test
function calculateOrderTotal(
  items: Array<{ price: number; quantity: number }>,
  options?: { discount?: number }
): number {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = options?.discount ?? 0;
  return subtotal * (1 - discount / 100);
}

function canRefund(order: { status: string; createdAt: Date }): boolean {
  if (order.status !== 'completed') return false;
  const daysSinceOrder = Math.floor(
    (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceOrder <= 30;
}

/*
// Domain unit test example:
// File: 01_domains/order/rules.test.ts

import { calculateOrderTotal, canRefund } from './rules';
import { OrderFactory } from '@test/factories';

describe('Order Rules', () => {
  describe('calculateOrderTotal', () => {
    it('sums item prices with quantities', () => {
      const items = [
        { price: 100, quantity: 2 },
        { price: 50, quantity: 1 },
      ];
      expect(calculateOrderTotal(items)).toBe(250);
    });

    it('applies percentage discount', () => {
      const items = [{ price: 100, quantity: 1 }];
      expect(calculateOrderTotal(items, { discount: 10 })).toBe(90);
    });

    it('handles empty cart', () => {
      expect(calculateOrderTotal([])).toBe(0);
    });
  });

  describe('canRefund', () => {
    it('allows refund for completed orders within 30 days', () => {
      const order = OrderFactory.create({
        status: 'completed',
        createdAt: daysAgo(15),
      });
      expect(canRefund(order)).toBe(true);
    });

    it('denies refund for orders older than 30 days', () => {
      const order = OrderFactory.create({
        status: 'completed',
        createdAt: daysAgo(45),
      });
      expect(canRefund(order)).toBe(false);
    });

    it('denies refund for non-completed orders', () => {
      const order = OrderFactory.create({ status: 'pending' });
      expect(canRefund(order)).toBe(false);
    });
  });
});
*/

// =============================================================================
// HEADLESS LAYER: HOOK UNIT TESTS
// =============================================================================

/**
 * Headless hook testing pattern.
 *
 * ⚠️ AI NOTE:
 * - Use @testing-library/react-hooks
 * - Test state transitions
 * - Test derived values
 * - 90%+ coverage expected
 */

/*
// Headless hook test example:
// File: 02_modules/cart/headless/useCartLogic.test.ts

import { renderHook, act } from '@testing-library/react';
import { useCartLogic } from './useCartLogic';
import { ItemFactory } from '@test/factories';

describe('useCartLogic', () => {
  it('starts with empty cart', () => {
    const { result } = renderHook(() => useCartLogic());

    expect(result.current.items).toEqual([]);
    expect(result.current.totalPrice).toBe(0);
    expect(result.current.itemCount).toBe(0);
  });

  it('adds items correctly', () => {
    const { result } = renderHook(() => useCartLogic());
    const item = ItemFactory.create({ price: 100 });

    act(() => {
      result.current.addItem(item);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalPrice).toBe(100);
  });

  it('increments quantity for existing items', () => {
    const { result } = renderHook(() => useCartLogic());
    const item = ItemFactory.create({ id: 'item-1', price: 50 });

    act(() => {
      result.current.addItem(item);
      result.current.addItem(item);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalPrice).toBe(100);
  });

  it('removes items correctly', () => {
    const { result } = renderHook(() => useCartLogic());
    const item = ItemFactory.create({ id: 'item-1' });

    act(() => {
      result.current.addItem(item);
      result.current.removeItem('item-1');
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('calculates total with multiple items', () => {
    const { result } = renderHook(() => useCartLogic());

    act(() => {
      result.current.addItem(ItemFactory.create({ price: 100, quantity: 2 }));
      result.current.addItem(ItemFactory.create({ price: 50, quantity: 1 }));
    });

    expect(result.current.totalPrice).toBe(250);
    expect(result.current.itemCount).toBe(3);
  });
});
*/

// =============================================================================
// ADAPTER LAYER: CONTRACT TESTS
// =============================================================================

/**
 * Adapter contract testing pattern.
 *
 * ⚠️ AI NOTE:
 * - Validate response matches schema
 * - Use Zod for schema validation
 * - Test both success and error shapes
 * - Can use MSW for mocking HTTP
 */

import { z } from 'zod';

// Schema for contract validation
const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    price: z.number(),
  })),
  status: z.enum(['pending', 'completed', 'shipped', 'cancelled']),
  total: z.number(),
  createdAt: z.string().datetime(),
});

type Order = z.infer<typeof OrderSchema>;

/*
// Contract test example:
// File: 02_modules/order/adapters/orderApi.contract.test.ts

import { orderApi } from './orderApi';
import { OrderSchema, OrderListSchema } from '../schemas';
import { server } from '@test/msw-server';  // Mock server

describe('OrderApi Contract', () => {
  it('getOrder returns data matching OrderSchema', async () => {
    const response = await orderApi.getOrder('order-123');

    const parseResult = OrderSchema.safeParse(response);
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) {
      console.error(parseResult.error.format());
    }
  });

  it('listOrders returns array matching OrderListSchema', async () => {
    const response = await orderApi.listOrders({ page: 1 });

    const parseResult = OrderListSchema.safeParse(response);
    expect(parseResult.success).toBe(true);
  });

  it('createOrder returns created order matching schema', async () => {
    const command = {
      items: [{ productId: 'prod-1', quantity: 1 }],
      userId: 'user-1',
    };

    const response = await orderApi.createOrder(command);

    expect(response).toHaveProperty('id');
    expect(OrderSchema.safeParse(response).success).toBe(true);
  });

  it('handles 404 with proper error shape', async () => {
    server.use(
      rest.get('/api/orders/:id', (req, res, ctx) =>
        res(ctx.status(404), ctx.json({ error: 'Not found' }))
      )
    );

    await expect(orderApi.getOrder('nonexistent')).rejects.toMatchObject({
      status: 404,
      message: expect.any(String),
    });
  });
});
*/

// =============================================================================
// WORKFLOW LAYER: INTEGRATION TESTS
// =============================================================================

/**
 * Workflow/Saga integration testing pattern.
 *
 * ⚠️ AI NOTE:
 * - Mock adapters, test workflow logic
 * - Test happy path and all failure paths
 * - Test compensation/rollback
 * - Test idempotency (Pillar Q)
 */

/*
// Integration test example:
// File: 02_modules/checkout/workflows/checkout.integration.test.ts

import { processCheckout } from './checkoutSaga';
import { CheckoutCommandFactory, ContextFactory } from '@test/factories';
import { InMemoryIdempotencyCache } from '@/pillar-q/idempotency';

describe('Checkout Saga Integration', () => {
  let paymentAdapter: jest.Mock;
  let inventoryAdapter: jest.Mock;
  let notificationAdapter: jest.Mock;
  let idempotencyCache: InMemoryIdempotencyCache;

  beforeEach(() => {
    paymentAdapter = jest.fn().mockResolvedValue({ txId: 'tx-123' });
    inventoryAdapter = jest.fn().mockResolvedValue({ reserved: true });
    notificationAdapter = jest.fn().mockResolvedValue({ sent: true });
    idempotencyCache = new InMemoryIdempotencyCache();
  });

  afterEach(() => {
    idempotencyCache.clear();
    jest.clearAllMocks();
  });

  it('completes full checkout flow', async () => {
    const cmd = CheckoutCommandFactory.create({ amount: 100 });
    const ctx = ContextFactory.create();

    const result = await processCheckout(cmd, ctx, {
      payment: paymentAdapter,
      inventory: inventoryAdapter,
      notification: notificationAdapter,
      cache: idempotencyCache,
    });

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('tx-123');
    expect(paymentAdapter).toHaveBeenCalledWith(100);
    expect(inventoryAdapter).toHaveBeenCalledWith(cmd.items);
    expect(notificationAdapter).toHaveBeenCalled();
  });

  it('compensates inventory on payment failure', async () => {
    paymentAdapter.mockRejectedValue(new Error('Payment failed'));
    const releaseInventory = jest.fn();

    const cmd = CheckoutCommandFactory.create();
    const ctx = ContextFactory.create();

    await expect(
      processCheckout(cmd, ctx, {
        payment: paymentAdapter,
        inventory: inventoryAdapter,
        releaseInventory,
        cache: idempotencyCache,
      })
    ).rejects.toThrow('Payment failed');

    // Verify compensation was called
    expect(releaseInventory).toHaveBeenCalled();
  });

  it('returns cached result for same intentId (idempotency)', async () => {
    const cmd = CheckoutCommandFactory.create();
    const ctx = ContextFactory.create();

    const deps = {
      payment: paymentAdapter,
      inventory: inventoryAdapter,
      notification: notificationAdapter,
      cache: idempotencyCache,
    };

    // First call
    const result1 = await processCheckout(cmd, ctx, deps);

    // Second call with same intentId
    const result2 = await processCheckout(cmd, ctx, deps);

    expect(result1).toEqual(result2);
    expect(paymentAdapter).toHaveBeenCalledTimes(1);  // Only charged once
  });

  it('handles concurrent requests correctly', async () => {
    const cmd = CheckoutCommandFactory.create();
    const ctx = ContextFactory.create();

    const deps = {
      payment: paymentAdapter,
      inventory: inventoryAdapter,
      cache: idempotencyCache,
    };

    // Simulate concurrent requests
    const [result1, result2] = await Promise.allSettled([
      processCheckout(cmd, ctx, deps),
      processCheckout(cmd, ctx, deps),
    ]);

    // One succeeds, one gets cached or ConcurrentProcessingError
    expect(paymentAdapter).toHaveBeenCalledTimes(1);
  });
});
*/

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Helper: Create date N days ago
 */
export function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

/**
 * Helper: Create test context
 */
export function createTestContext(overrides?: Partial<{
  user: { id: string };
  traceId: string;
}>) {
  return {
    user: { id: 'test-user' },
    traceId: 'test-trace-id',
    ...overrides,
  };
}

/**
 * Helper: Wait for async updates
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// COVERAGE GUIDELINES
// =============================================================================

/*
| Layer        | Target  | Test Type   | Tools                    |
|--------------|---------|-------------|--------------------------|
| 01_domains/  | 100%    | Unit        | Jest/Vitest              |
| headless/    | 90%+    | Unit        | @testing-library/react   |
| adapters/    | Schema  | Contract    | Zod + MSW                |
| workflows/   | Paths   | Integration | Jest + Mocks             |
| views/       | Critical| Snapshot    | @testing-library/react   |
| E2E          | Journeys| E2E         | Playwright/Cypress       |
*/

// =============================================================================
// EXPORTS
// =============================================================================

export {
  calculateOrderTotal,
  canRefund,
  OrderSchema,
};

export type { Order };
