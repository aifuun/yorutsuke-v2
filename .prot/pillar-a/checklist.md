# Pillar A: Nominal Typing Checklist

> Use this checklist when creating new entities or reviewing code

## When Creating New Entity

### 1. Define Branded Type

```typescript
// In: src/01_domains/{domain}/types.ts
export type {Entity}Id = Brand<string, '{Entity}Id'>;
```

- [ ] Type defined with unique brand
- [ ] Exported from domain types
- [ ] Naming: `{Entity}Id` (e.g., `UserId`, `OrderId`)

### 2. Create Converter Function

```typescript
// In: src/01_domains/{domain}/types.ts
export const to{Entity}Id = createIdConverter<{Entity}Id>('{Entity}Id');
```

- [ ] Converter throws on empty/invalid input
- [ ] Converter exported alongside type
- [ ] Naming: `to{Entity}Id` (e.g., `toUserId`)

### 3. Create Zod Schema

```typescript
// In: src/01_domains/{domain}/schema.ts
export const {Entity}IdSchema = brandedString<{Entity}Id>('{Entity}Id');
```

- [ ] Schema validates and transforms
- [ ] Schema exported for boundary use
- [ ] Integrated into entity schema

### 4. Create Generator (if needed)

```typescript
// In: src/01_domains/{domain}/types.ts
export function generate{Entity}Id(): {Entity}Id {
  return `{prefix}_${crypto.randomUUID()}` as {Entity}Id;
}
```

- [ ] Prefix matches entity (e.g., `user_`, `order_`)
- [ ] Uses crypto.randomUUID() for uniqueness

## When Using in Code

### Adapter/API Boundary

- [ ] Raw API data parsed through Zod schema
- [ ] URL params converted via `to{Entity}Id()`
- [ ] Form inputs converted at submission

```typescript
// ✅ Correct
const orderId = toOrderId(req.params.id);
const order = OrderSchema.parse(apiResponse);

// ❌ Wrong
const orderId = req.params.id as OrderId;
```

### Function Signatures

- [ ] All ID parameters use branded types
- [ ] No `string` for domain identifiers
- [ ] No `number` for money/amounts

```typescript
// ✅ Correct
function getOrder(orderId: OrderId, userId: UserId): Order

// ❌ Wrong
function getOrder(orderId: string, userId: string): Order
```

### Entity Definitions

- [ ] All IDs are branded types
- [ ] Money uses `Money` type (cents)
- [ ] No primitive obsession

```typescript
// ✅ Correct
interface Order {
  id: OrderId;
  userId: UserId;
  total: Money;
}

// ❌ Wrong
interface Order {
  id: string;
  userId: string;
  total: number;
}
```

## Code Review Checklist

### Quick Scan

- [ ] No `as string` or `as number` for IDs
- [ ] No `: string` for ID type annotations
- [ ] No direct API response usage without parsing

### Deep Check

- [ ] Converters have validation logic
- [ ] Schemas transform to branded types
- [ ] Generators use proper prefixes
- [ ] Type guards exist for runtime checks

## Common Mistakes to Catch

| Pattern | Problem | Fix |
|---------|---------|-----|
| `id: string` | Primitive obsession | Use `id: OrderId` |
| `as OrderId` | Unsafe cast | Use `toOrderId()` |
| `amount: number` | Could be cents or dollars | Use `amount: Money` |
| `email: string` | No validation | Use `email: Email` |

## Files to Check

When reviewing Pillar A compliance:

1. `src/01_domains/*/types.ts` - Branded type definitions
2. `src/01_domains/*/schema.ts` - Zod schemas
3. `src/02_modules/*/adapters/*.ts` - Boundary conversions
4. `src/02_modules/*/headless/*.ts` - Type usage

## Template Reference

Copy from: `.prot/pillar-a/branded.ts`
