# Pillar C: Production-Grade Mocking Checklist

> Use this checklist when creating test factories or reviewing test code

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Copy > Abstract** | Copy UserFactory pattern, don't create new abstractions |
| **Explicit > Generic** | Each entity has its own factory definition |
| **Simple > Clever** | Use createFactory helper, customize defaults only |

## When Creating New Factory

### 1. Create Branded Type Generators

```typescript
// In: src/test/factories/ids.ts
export const MockId = {
  {entity}Id(): {Entity}Id {
    return `{prefix}_${faker.string.alphanumeric(12)}` as {Entity}Id;
  },
};
```

- [ ] All branded types have mock generators
- [ ] Prefixes match production patterns
- [ ] Generators exported from central location

### 2. Create Entity Factory

```typescript
// In: src/test/factories/{entity}.factory.ts
export const {Entity}Factory = createFactory<{Entity}>(() => ({
  id: MockId.{entity}Id(),
  // ... all required fields
}));
```

- [ ] Factory generates ALL required fields
- [ ] Default values are realistic
- [ ] Uses faker for dynamic data
- [ ] Supports partial overrides

### 3. Validate Against Schema

```typescript
// In factory file
const generated = {Entity}Factory.create();
assertMatchesSchema({Entity}Schema, generated);  // Should pass
```

- [ ] Generated data passes schema validation
- [ ] Schema imported from production code
- [ ] Test verifies schema compliance

## Factory Features Checklist

### Basic Operations

- [ ] `create(overrides?)` - Single entity
- [ ] `createMany(count, overrides?)` - Multiple entities
- [ ] `sequence(count, transform?)` - Sequential variations

### Relationships

- [ ] Related entities use consistent IDs
- [ ] Scenario builders for complex setups
- [ ] Parent-child relationships maintained

### Presets/Scenarios

```typescript
// Common states as methods
OrderFactory.pending()
OrderFactory.shipped()
OrderFactory.cancelled()
```

- [ ] Common states have preset methods
- [ ] Edge cases have dedicated builders

## Code Review Checklist

### No Static Mock Files

- [ ] No `.json` files in test directories
- [ ] No `import mockData from './mocks/...'`
- [ ] No copy-pasted production data

### Schema Alignment

- [ ] Factories import production schemas
- [ ] Generated data validated in tests
- [ ] Factory updated when schema changes

### Faker Usage

- [ ] Realistic data types (email, name, etc.)
- [ ] Appropriate ranges for numbers
- [ ] Consistent locale if needed

### Reproducibility

- [ ] Seeded randomness available
- [ ] Deterministic tests when needed
- [ ] No flaky tests from random data

## File Organization

```
src/test/
├── factories/
│   ├── index.ts           # Re-exports all factories
│   ├── ids.ts             # MockId generators
│   ├── user.factory.ts
│   ├── order.factory.ts
│   └── scenarios.ts       # ScenarioBuilder
├── helpers/
│   └── schema.ts          # assertMatchesSchema
└── setup.ts               # faker.seed() if needed
```

- [ ] Factories in dedicated directory
- [ ] Central export file
- [ ] Scenario builders separate

## Common Patterns

### Entity with Calculated Fields

```typescript
export const OrderFactory = {
  create(overrides = {}) {
    const items = overrides.items ?? generateItems();
    const subtotal = calculateSubtotal(items);
    const tax = calculateTax(subtotal);
    return {
      items,
      subtotal,
      tax,
      total: subtotal + tax,
      ...overrides,
    };
  },
};
```

### Related Entities

```typescript
export const ScenarioBuilder = {
  userWithOrders(count = 3) {
    const user = UserFactory.create();
    const orders = OrderFactory.createMany(count, {
      userId: user.id,
    });
    return { user, orders };
  },
};
```

### API Response Wrapper

```typescript
export const ApiResponse = {
  success: (data) => ({ success: true, data }),
  error: (code, message) => ({ success: false, error: { code, message } }),
  paginated: (items, page, total) => ({ data: items, pagination: {...} }),
};
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| `user.json` | Static, drifts from schema | Use `UserFactory.create()` |
| `{ id: '123' }` | Incomplete, no validation | Use factory with schema check |
| `as User` | Type assertion, no runtime check | Generate from factory |
| Hardcoded IDs | Conflicts in parallel tests | Use `MockId.userId()` |

## Test Examples

### Unit Test

```typescript
describe('calculateDiscount', () => {
  it('applies 10% for orders over $100', () => {
    const order = OrderFactory.create({
      subtotal: 15000,  // $150.00
    });

    const discount = calculateDiscount(order);
    expect(discount).toBe(1500);  // $15.00
  });
});
```

### Integration Test

```typescript
describe('Checkout Flow', () => {
  it('completes checkout', async () => {
    const { user, order, intentId } = ScenarioBuilder.checkout();

    const result = await checkoutService.process({
      userId: user.id,
      orderId: order.id,
      intentId,
    });

    expect(result.success).toBe(true);
  });
});
```

### Schema Compliance Test

```typescript
describe('UserFactory', () => {
  it('generates valid users', () => {
    const users = UserFactory.createMany(100);

    users.forEach(user => {
      expect(() => UserSchema.parse(user)).not.toThrow();
    });
  });
});
```

## Dependencies

```json
{
  "devDependencies": {
    "@faker-js/faker": "^8.0.0",
    "@anatine/zod-mock": "^3.x"
  }
}
```

> **Note**: @faker-js/faker v8+ API changed significantly:
> - `faker.name` → `faker.person`
> - `faker.datatype.uuid` → `faker.string.uuid`
> - See [migration guide](https://fakerjs.dev/guide/upgrading.html)

## Template Reference

Copy from: `.prot/pillar-c/mock-factory.ts`
