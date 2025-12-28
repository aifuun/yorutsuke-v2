# Pillar C: Production-Grade Mocking

> Generate test data programmatically from production schemas

## Rule

Test data (mocks, fixtures) must be **programmatically generated** from the Production Schemas. Hand-written JSON mock files are forbidden.

## Purpose

- Ensure test environment is a "Digital Twin" of production
- Prevent drift where tests pass but production fails
- Automatic updates when schema changes
- Type-safe test data generation

## Implementation (TypeScript + Zod + Faker)

### Using zod-mock

```typescript
import { z } from 'zod';
import { generateMock } from '@anatine/zod-mock';
import { faker } from '@faker-js/faker';

// Production schema
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  profile: z.object({
    displayName: z.string().min(2).max(50),
    avatarUrl: z.string().url().optional(),
    createdAt: z.date(),
  }),
});

type User = z.infer<typeof UserSchema>;

// Generate mock from schema
function createMockUser(overrides?: Partial<User>): User {
  const mock = generateMock(UserSchema);
  return { ...mock, ...overrides };
}
```

### Custom Generators

```typescript
import { faker } from '@faker-js/faker';

// Factory with realistic data
function createUserFactory() {
  return {
    create(overrides?: Partial<User>): User {
      return {
        id: faker.string.uuid(),
        email: faker.internet.email(),
        profile: {
          displayName: faker.person.fullName(),
          avatarUrl: faker.image.avatar(),
          createdAt: faker.date.past(),
        },
        ...overrides,
      };
    },

    createMany(count: number, overrides?: Partial<User>): User[] {
      return Array.from({ length: count }, () => this.create(overrides));
    },
  };
}

const UserFactory = createUserFactory();

// Usage in tests
const user = UserFactory.create();
const users = UserFactory.createMany(10, { profile: { displayName: 'Test' } });
```

### Seeded Randomness for Reproducibility

```typescript
import { faker } from '@faker-js/faker';

function createSeededFactory(seed: number) {
  faker.seed(seed);

  return {
    user(): User {
      return {
        id: faker.string.uuid(),
        email: faker.internet.email(),
        // ... deterministic based on seed
      };
    },
  };
}

// Same seed = same data every time
const factory = createSeededFactory(12345);
const user1 = factory.user();  // Always the same
```

### Integration with Branded Types

```typescript
import { faker } from '@faker-js/faker';

type UserId = string & { readonly __brand: unique symbol };
type OrderId = string & { readonly __brand: unique symbol };

const MockIds = {
  userId(): UserId {
    return faker.string.uuid() as UserId;
  },
  orderId(): OrderId {
    return `order_${faker.string.alphanumeric(10)}` as OrderId;
  },
};

// Type-safe mock generation
const mockOrder = {
  id: MockIds.orderId(),
  userId: MockIds.userId(),
  // ...
};
```

## Good Example

```typescript
// test/factories/user.factory.ts
import { generateMock } from '@anatine/zod-mock';
import { UserSchema } from '@/domains/user/schema';

export const UserFactory = {
  create: (overrides = {}) => ({
    ...generateMock(UserSchema),
    ...overrides,
  }),
};

// test/user.service.test.ts
import { UserFactory } from './factories/user.factory';

describe('UserService', () => {
  it('should calculate score', () => {
    const user = UserFactory.create({
      profile: { displayName: 'Test User' },
    });

    expect(calculateScore(user)).toBe(90);
  });
});
```

## Bad Example

```typescript
// ❌ Hand-written mock file
// test/mocks/user.json
{
  "id": "123",
  "email": "test@example.com",
  "name": "Test User"  // Old field! Schema changed but mock didn't
}

// ❌ Test uses outdated structure
import mockUser from './mocks/user.json';

describe('UserService', () => {
  it('should work', () => {
    // mockUser has old structure
    // Test passes but production fails!
    expect(processUser(mockUser)).toBeDefined();
  });
});
```

## Anti-Patterns

1. **Static JSON mock files**
   ```
   // ❌ test/mocks/user.json - will drift from schema
   ```

2. **Inline object literals without schema**
   ```typescript
   // ❌ No guarantee matches production schema
   const mockUser = {
     id: '123',
     name: 'Test',
   };
   ```

3. **Copy-pasted production data**
   ```typescript
   // ❌ Contains real PII, outdated structure
   const mockUser = { /* copied from prod DB */ };
   ```

4. **Incomplete mocks**
   ```typescript
   // ❌ Missing required fields
   const mockUser = { id: '123' } as User;
   ```

## Exceptions

- Snapshot tests for specific edge cases (documented)
- Error response mocking (API error bodies)

## Checklist

- [ ] No `.json` mock files in test directories
- [ ] All mocks generated from Zod/schema definitions
- [ ] Factory functions exist for each domain entity
- [ ] Factories support partial overrides
- [ ] Seeded randomness available for reproducibility
- [ ] Branded types have mock generators

## References

- Related: Pillar A (Nominal Typing) - mock branded types
- Related: Pillar B (Airlock) - schemas for mock generation
- Libraries: `@anatine/zod-mock`, `@faker-js/faker`
- Template: `.prot/pillar-c/mock-factory.ts`
- Checklist: `.prot/pillar-c/checklist.md`
- Audit: `.prot/pillar-c/audit.ts`
