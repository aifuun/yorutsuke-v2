# Pillar K: Testing Pyramid Checklist

> Use this checklist when writing tests for any layer of the application.

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Explicit > Abstract** | Each layer has explicit test strategy |
| **Clear > DRY** | Test code should be clear, duplication OK |
| **Concrete > Generic** | Use concrete factories, not generic mocks |

## Testing Pyramid Overview

```
                /\
               /  \
              / E2E\          ← Critical user journeys only
             /──────\
            /        \
           /Integration\      ← Workflows with mocked adapters
          /────────────\
         /              \
        /   Contract     \    ← Schema validation at boundaries
       /──────────────────\
      /                    \
     /       Unit           \  ← Domain + Headless (most tests)
    /────────────────────────\
```

## Layer: Domain (01_domains/)

### Coverage Target: 100%

### Checklist
- [ ] All pure functions have unit tests
- [ ] All business rules have tests
- [ ] Edge cases covered (empty, null, boundaries)
- [ ] No mocking needed (pure logic)
- [ ] Tests are fast (< 1ms each)

### Pattern
```typescript
// 01_domains/order/rules.test.ts
describe('calculateTotal', () => {
  it('sums items correctly', () => {
    expect(calculateTotal([{ price: 100 }])).toBe(100);
  });

  it('handles empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('applies discount', () => {
    expect(calculateTotal([{ price: 100 }], { discount: 10 })).toBe(90);
  });
});
```

## Layer: Headless (headless/)

### Coverage Target: 90%+

### Checklist
- [ ] All hooks have unit tests
- [ ] State transitions tested
- [ ] Derived values tested
- [ ] Error states tested
- [ ] Uses @testing-library/react

### Pattern
```typescript
// headless/useCartLogic.test.ts
import { renderHook, act } from '@testing-library/react';

describe('useCartLogic', () => {
  it('adds item and updates total', () => {
    const { result } = renderHook(() => useCartLogic());

    act(() => {
      result.current.addItem({ id: '1', price: 100 });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(100);
  });
});
```

## Layer: Adapters (adapters/)

### Coverage Target: Schema coverage

### Checklist
- [ ] Response matches Zod schema
- [ ] Error responses have correct shape
- [ ] Uses MSW for HTTP mocking
- [ ] Tests both success and error paths

### Pattern
```typescript
// adapters/orderApi.contract.test.ts
describe('OrderApi Contract', () => {
  it('getOrder matches OrderSchema', async () => {
    const response = await orderApi.getOrder('123');

    const result = OrderSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('handles 404 correctly', async () => {
    server.use(notFoundHandler);

    await expect(orderApi.getOrder('bad'))
      .rejects.toMatchObject({ status: 404 });
  });
});
```

## Layer: Workflows (workflows/)

### Coverage Target: All paths

### Checklist
- [ ] Happy path tested
- [ ] All failure paths tested
- [ ] Compensation/rollback tested (Pillar M)
- [ ] Idempotency tested (Pillar Q)
- [ ] Adapters are mocked
- [ ] Tests actual workflow logic

### Pattern
```typescript
// workflows/checkout.integration.test.ts
describe('Checkout Saga', () => {
  let paymentMock: jest.Mock;
  let inventoryMock: jest.Mock;

  beforeEach(() => {
    paymentMock = jest.fn().mockResolvedValue({ txId: 'tx-1' });
    inventoryMock = jest.fn().mockResolvedValue(true);
  });

  it('completes full flow', async () => {
    const result = await processCheckout(cmd, ctx, {
      payment: paymentMock,
      inventory: inventoryMock,
    });

    expect(result.success).toBe(true);
    expect(paymentMock).toHaveBeenCalled();
  });

  it('compensates on payment failure', async () => {
    paymentMock.mockRejectedValue(new Error('Failed'));
    const releaseMock = jest.fn();

    await expect(processCheckout(cmd, ctx, {
      payment: paymentMock,
      releaseInventory: releaseMock,
    })).rejects.toThrow();

    expect(releaseMock).toHaveBeenCalled();
  });

  it('returns cached result for same intentId', async () => {
    await processCheckout(cmd, ctx, deps);
    await processCheckout(cmd, ctx, deps);  // Same intentId

    expect(paymentMock).toHaveBeenCalledTimes(1);
  });
});
```

## Layer: Views (views/)

### Coverage Target: Critical paths

### Checklist
- [ ] Snapshot tests for UI structure
- [ ] Interaction tests for key flows
- [ ] Accessibility tests (optional)
- [ ] No logic tested here (logic in headless)

## Layer: E2E

### Coverage Target: Critical journeys only

### Checklist
- [ ] Only critical user journeys
- [ ] Login → Key Action → Logout
- [ ] Payment flows
- [ ] NOT used for logic testing

### What NOT to E2E Test
- [ ] ❌ Form validation (use unit tests)
- [ ] ❌ Business calculations (use unit tests)
- [ ] ❌ API response handling (use contract tests)

## Code Review Checklist

### Test Quality
- [ ] Tests have descriptive names
- [ ] One assertion per test (ideally)
- [ ] Uses factories from Pillar C
- [ ] No hardcoded test data (use factories)
- [ ] Tests are deterministic (no random without seed)

### Coverage by Layer
- [ ] Domain: 100% covered
- [ ] Headless: 90%+ covered
- [ ] Adapters: Schema validated
- [ ] Workflows: All paths covered
- [ ] E2E: Only critical paths

### Anti-Patterns Avoided
- [ ] ❌ E2E for business logic
- [ ] ❌ No contract tests for APIs
- [ ] ❌ Over-mocking (testing mocks, not code)
- [ ] ❌ Flaky tests

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| E2E for validation | Slow, brittle | Unit test the rule |
| No schema tests | Silent API breaks | Add contract tests |
| Mock everything | Testing mocks | Mock only boundaries |
| Random test data | Flaky tests | Use seeded factories |
| Testing private methods | Brittle | Test public interface |
| No failure path tests | Missing coverage | Test all error cases |

## Test File Organization

```
src/
├── 01_domains/
│   └── order/
│       ├── rules.ts
│       └── rules.test.ts       ← Unit tests
│
├── 02_modules/
│   └── cart/
│       ├── headless/
│       │   ├── useCartLogic.ts
│       │   └── useCartLogic.test.ts  ← Hook tests
│       │
│       ├── adapters/
│       │   ├── cartApi.ts
│       │   └── cartApi.contract.test.ts  ← Contract tests
│       │
│       └── workflows/
│           ├── checkoutSaga.ts
│           └── checkoutSaga.integration.test.ts  ← Integration
│
└── test/
    ├── factories/              ← Pillar C factories
    ├── msw/                    ← MSW handlers
    └── e2e/                    ← E2E tests (few)
```

## Template Reference

Copy from: `.prot/pillar-k/testing.ts`

Key patterns:
- Domain unit test pattern
- Headless hook test pattern
- Contract test pattern
- Integration test pattern
- Test utilities (daysAgo, createTestContext)
