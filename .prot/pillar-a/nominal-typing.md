# Pillar A: Absolute Nominal Typing

> Eliminate "Primitive Obsession" bugs through branded types

## Rule

The use of primitive types (`string`, `number`, `boolean`) to represent Domain Entities or Identifiers is **STRICTLY FORBIDDEN**.

## Purpose

Prevent bugs where values are accidentally swapped:
- Passing `UserId` where `OrderId` is expected
- Confusing `price` with `quantity`
- Mixing `email` with `name`

TypeScript's structural typing treats all strings as the same type. Nominal typing creates distinct types.

## Implementation (TypeScript)

### Branded Types

```typescript
// Define branded types for each ID
type UserId = string & { readonly __brand: unique symbol };
type OrderId = string & { readonly __brand: unique symbol };
type ProductId = string & { readonly __brand: unique symbol };

// Now these are incompatible:
declare function getUser(id: UserId): User;
declare function getOrder(id: OrderId): Order;

const userId = 'u_123' as UserId;
const orderId = 'o_456' as OrderId;

getUser(userId);   // ✅ OK
getUser(orderId);  // ❌ Type error!
```

### Value Objects for Complex Types

```typescript
// For values with validation logic
class Email {
  private readonly value: string;
  private readonly __brand!: 'Email';

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): Email {
    if (!raw.includes('@')) {
      throw new Error('Invalid email');
    }
    return new Email(raw);
  }

  toString(): string {
    return this.value;
  }
}
```

### Type Conversion at Boundaries

```typescript
// At API/URL boundary - validate and convert
function toUserId(raw: string): UserId {
  if (!raw || !raw.startsWith('u_')) {
    throw new Error('Invalid user ID format');
  }
  return raw as UserId;
}

// In route handler
app.get('/users/:id', (req) => {
  const userId = toUserId(req.params.id);  // Convert at boundary
  return userService.getUser(userId);
});
```

## Good Example

```typescript
// Domain types
type CartId = string & { readonly __brand: unique symbol };
type ItemId = string & { readonly __brand: unique symbol };
type Money = number & { readonly __brand: unique symbol };

interface CartItem {
  id: ItemId;
  price: Money;
  quantity: number;
}

interface Cart {
  id: CartId;
  items: CartItem[];
}

// Functions are type-safe
function addToCart(cartId: CartId, itemId: ItemId): void {
  // Cannot accidentally swap cartId and itemId
}

// Type conversion at boundary
function toMoney(cents: number): Money {
  if (cents < 0) throw new Error('Money cannot be negative');
  return cents as Money;
}
```

## Bad Example

```typescript
// ❌ Primitive obsession
interface Cart {
  id: string;        // Which string? Cart? User? Order?
  items: {
    id: string;      // Item ID? Product ID?
    price: number;   // Dollars? Cents? Could be quantity!
    quantity: number;
  }[];
}

function addToCart(cartId: string, itemId: string): void {
  // Easy to swap arguments - no compiler help
}

// Accident waiting to happen:
addToCart(itemId, cartId);  // ✅ Compiles! ❌ Runtime bug!
```

## Anti-Patterns

1. **Raw string IDs everywhere**
   ```typescript
   // ❌ BAD
   const userId: string = 'u_123';
   ```

2. **Direct casting without validation**
   ```typescript
   // ❌ BAD - no validation
   const userId = rawInput as UserId;
   ```

3. **Using primitives in function signatures**
   ```typescript
   // ❌ BAD
   function processOrder(userId: string, orderId: string, amount: number)
   ```

## Exceptions

- **View Layer Boundary**: Primitives are allowed at the very edge (URL params, form inputs) immediately before conversion to Domain types
- **Third-party APIs**: When interfacing with external APIs that use strings, convert at the adapter layer

## Checklist

- [ ] All entity IDs use branded types
- [ ] No `string` type for domain identifiers
- [ ] No `number` type for money/amounts
- [ ] Conversion functions exist at boundaries
- [ ] Conversion functions include validation

## References

- Related: Pillar B (Airlock) - validation at boundaries
- Template: `.prot/pillar-a/branded.ts`
- Checklist: `.prot/pillar-a/checklist.md`
- Audit: `.prot/pillar-a/audit.ts`
