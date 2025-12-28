/**
 * Pillar C: Production-Grade Mocking Template
 *
 * Generate test data programmatically from production schemas.
 * No hand-written JSON mock files!
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * This template is designed for AI-assisted development.
 * - COPY the UserFactory/OrderFactory patterns for new entities
 * - DO NOT create additional abstractions
 * - Each entity should have its own explicit factory
 */

import { z } from 'zod';
import { faker } from '@faker-js/faker';
import { generateMock } from '@anatine/zod-mock';

// ============================================
// 1. BRANDED TYPE MOCK GENERATORS
// ============================================

// Import your branded types
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };
type ProductId = string & { readonly __brand: 'ProductId' };
type Money = number & { readonly __brand: 'Money' };
type Email = string & { readonly __brand: 'Email' };

/**
 * Mock generators for branded types
 */
export const MockId = {
  userId(): UserId {
    return `user_${faker.string.alphanumeric(12)}` as UserId;
  },

  orderId(): OrderId {
    return `order_${faker.string.alphanumeric(12)}` as OrderId;
  },

  productId(): ProductId {
    return `prod_${faker.string.alphanumeric(12)}` as ProductId;
  },

  money(min = 100, max = 100000): Money {
    return faker.number.int({ min, max }) as Money;
  },

  email(): Email {
    return faker.internet.email() as Email;
  },
};

// ============================================
// 2. FACTORY PATTERN
// ============================================

/**
 * Generic factory builder
 *
 * ⚠️ AI NOTE: This helper is INTERNAL. When creating new entities:
 * - Copy UserFactory or OrderFactory pattern
 * - DO NOT modify createFactory itself
 * - Each entity gets its own explicit factory
 *
 * ⚠️ SHALLOW MERGE WARNING:
 * This performs a SHALLOW merge. If overriding nested objects (e.g. profile),
 * you must provide the full nested object or manually merge with defaults.
 *
 * Example:
 *   // ❌ WRONG: displayName and avatarUrl will be undefined
 *   UserFactory.create({ profile: { bio: "New Bio" } })
 *
 *   // ✅ CORRECT: Spread defaults first
 *   UserFactory.create({
 *     profile: { ...UserFactory.create().profile, bio: "New Bio" }
 *   })
 */
function createFactory<T>(defaults: () => T) {
  return {
    create(overrides: Partial<T> = {}): T {
      return { ...defaults(), ...overrides };
    },

    createMany(count: number, overrides: Partial<T> = {}): T[] {
      return Array.from({ length: count }, () => this.create(overrides));
    },

    // For sequences (e.g., user1, user2, user3)
    sequence(count: number, transform: (index: number, base: T) => Partial<T> = () => ({})): T[] {
      return Array.from({ length: count }, (_, i) => {
        const base = defaults();
        return { ...base, ...transform(i, base) };
      });
    },
  };
}

// ============================================
// 3. EXAMPLE: USER FACTORY
// ============================================

// Production schema
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  profile: z.object({
    displayName: z.string(),
    avatarUrl: z.string().url().optional(),
    bio: z.string().optional(),
  }),
  role: z.enum(['user', 'admin', 'moderator']),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

type User = z.infer<typeof UserSchema>;

/**
 * User factory - generates valid User objects
 */
export const UserFactory = createFactory<User>(() => ({
  id: MockId.userId(),
  email: MockId.email(),
  profile: {
    displayName: faker.person.fullName(),
    avatarUrl: faker.image.avatar(),
    bio: faker.lorem.sentence(),
  },
  role: faker.helpers.arrayElement(['user', 'admin', 'moderator'] as const),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
}));

// ============================================
// 4. EXAMPLE: ORDER FACTORY
// ============================================

const OrderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
});

const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(OrderItemSchema),
  subtotal: z.number().int().nonnegative(),
  tax: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  createdAt: z.date(),
});

type Order = z.infer<typeof OrderSchema>;
type OrderItem = z.infer<typeof OrderItemSchema>;

/**
 * Order item factory
 */
export const OrderItemFactory = createFactory<OrderItem>(() => {
  const quantity = faker.number.int({ min: 1, max: 5 });
  const unitPrice = MockId.money(500, 10000);
  return {
    productId: MockId.productId(),
    name: faker.commerce.productName(),
    quantity,
    unitPrice,
  };
});

/**
 * Order factory with calculated totals
 */
export const OrderFactory = {
  create(overrides: Partial<Order> = {}): Order {
    const items = overrides.items ?? OrderItemFactory.createMany(
      faker.number.int({ min: 1, max: 5 })
    );

    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + tax;

    return {
      id: MockId.orderId(),
      userId: MockId.userId(),
      items,
      subtotal,
      tax,
      total,
      status: faker.helpers.arrayElement([
        'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
      ] as const),
      createdAt: faker.date.past(),
      ...overrides,
      // Recalculate if items were overridden
      ...(overrides.items && !overrides.subtotal && {
        subtotal: overrides.items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        ),
      }),
    };
  },

  createMany(count: number, overrides: Partial<Order> = {}): Order[] {
    return Array.from({ length: count }, () => this.create(overrides));
  },

  // Preset scenarios
  pending(overrides: Partial<Order> = {}): Order {
    return this.create({ status: 'pending', ...overrides });
  },

  shipped(overrides: Partial<Order> = {}): Order {
    return this.create({ status: 'shipped', ...overrides });
  },

  cancelled(overrides: Partial<Order> = {}): Order {
    return this.create({ status: 'cancelled', ...overrides });
  },
};

// ============================================
// 5. ZOD-MOCK INTEGRATION
// ============================================

/**
 * Generate mock directly from Zod schema
 * Good for quick prototyping, less control than factory
 */
export function mockFromSchema<T extends z.ZodType>(schema: T): z.infer<T> {
  return generateMock(schema);
}

// Usage
const autoUser = mockFromSchema(UserSchema);
const autoOrder = mockFromSchema(OrderSchema);

// ============================================
// 6. SEEDED RANDOMNESS
// ============================================

/**
 * Create deterministic factories for reproducible tests
 */
export function createSeededFactories(seed: number) {
  faker.seed(seed);

  return {
    user: () => UserFactory.create(),
    order: () => OrderFactory.create(),
    reset: () => faker.seed(seed),
  };
}

// Usage in tests
// const factories = createSeededFactories(12345);
// const user1 = factories.user();  // Always same user
// factories.reset();
// const user2 = factories.user();  // Same as user1

// ============================================
// 7. RELATIONSHIP BUILDERS
// ============================================

/**
 * Build related entities together
 */
export const ScenarioBuilder = {
  /**
   * User with orders
   */
  userWithOrders(orderCount = 3): { user: User; orders: Order[] } {
    const user = UserFactory.create();
    const orders = OrderFactory.createMany(orderCount, {
      userId: user.id as UserId as string,
    });
    return { user, orders };
  },

  /**
   * Complete checkout scenario
   */
  checkout(): {
    user: User;
    order: Order;
    intentId: string;
    traceId: string;
  } {
    const user = UserFactory.create();
    const order = OrderFactory.pending({ userId: user.id });
    return {
      user,
      order,
      intentId: faker.string.uuid(),
      traceId: faker.string.uuid(),
    };
  },
};

// ============================================
// 8. API RESPONSE MOCKS
// ============================================

/**
 * Mock API responses (including metadata)
 */
export const ApiResponseFactory = {
  success<T>(data: T) {
    return {
      success: true,
      data,
      meta: {
        requestId: faker.string.uuid(),
        timestamp: new Date().toISOString(),
      },
    };
  },

  paginated<T>(items: T[], page = 1, pageSize = 10, total?: number) {
    return {
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        total: total ?? items.length,
        totalPages: Math.ceil((total ?? items.length) / pageSize),
      },
    };
  },

  error(code: string, message: string) {
    return {
      success: false,
      error: {
        code,
        message,
        requestId: faker.string.uuid(),
      },
    };
  },
};

// ============================================
// 9. TEST HELPERS
// ============================================

/**
 * Assert that data matches schema (useful in tests)
 */
export function assertMatchesSchema<T>(
  schema: z.ZodType<T>,
  data: unknown
): asserts data is T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Data does not match schema:\n${JSON.stringify(result.error.issues, null, 2)}`
    );
  }
}

// ============================================
// 10. TEMPLATE FOR NEW ENTITIES
// ============================================

/**
 * Copy this template when creating factory for a new entity:
 *
 * 1. Add MockId generator (if new ID type)
 * 2. Copy factory pattern from UserFactory or OrderFactory
 * 3. Add to ScenarioBuilder if needed
 *
 * Example for Product entity:
 *
 * ```typescript
 * // 1. Add to MockId
 * productId(): ProductId {
 *   return `prod_${faker.string.alphanumeric(12)}` as ProductId;
 * }
 *
 * // 2. Create factory (simple entity)
 * export const ProductFactory = createFactory<Product>(() => ({
 *   id: MockId.productId(),
 *   name: faker.commerce.productName(),
 *   price: MockId.money(100, 10000),
 *   category: faker.commerce.department(),
 *   createdAt: faker.date.past(),
 * }));
 *
 * // 3. Or with calculated fields (like OrderFactory)
 * export const CartFactory = {
 *   create(overrides = {}) {
 *     const items = overrides.items ?? ProductFactory.createMany(3);
 *     const total = items.reduce((sum, p) => sum + p.price, 0);
 *     return { items, total, ...overrides };
 *   },
 *   createMany(count, overrides = {}) {
 *     return Array.from({ length: count }, () => this.create(overrides));
 *   },
 * };
 * ```
 */

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// ✅ CORRECT: Factory-generated mocks

describe('OrderService', () => {
  it('calculates total correctly', () => {
    const order = OrderFactory.create({
      items: [
        OrderItemFactory.create({ unitPrice: 1000, quantity: 2 }),
        OrderItemFactory.create({ unitPrice: 500, quantity: 1 }),
      ],
    });

    expect(order.subtotal).toBe(2500);
  });

  it('processes multiple orders', () => {
    const orders = OrderFactory.createMany(10);
    const result = processOrders(orders);
    expect(result.processed).toBe(10);
  });

  it('handles user with orders scenario', () => {
    const { user, orders } = ScenarioBuilder.userWithOrders(5);
    expect(orders.every(o => o.userId === user.id)).toBe(true);
  });
});


// ❌ WRONG: Hand-written mocks

// test/mocks/user.json  <- DON'T DO THIS
{
  "id": "123",
  "email": "test@example.com",
  "name": "Test User"  // Schema changed, mock didn't!
}

// Inline objects without schema validation
const mockUser = {
  id: '123',
  email: 'test@test.com',
  // Missing fields, wrong types...
};
*/
