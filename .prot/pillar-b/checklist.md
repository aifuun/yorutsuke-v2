# Pillar B: Evolutionary Airlock Checklist

> Use this checklist when handling external data or evolving schemas

## When Creating New Entity Airlock

### 1. Define Current Schema

```typescript
// In: src/01_domains/{entity}/schema.ts
export const {Entity}Schema = z.object({
  version: z.literal(1),
  // ... fields
});
export type {Entity} = z.infer<typeof {Entity}Schema>;
```

- [ ] Schema has `version` field
- [ ] All fields have proper Zod validators
- [ ] Branded types used for IDs (Pillar A)
- [ ] Type exported for domain use

### 2. Create Parse Function

```typescript
// In: src/02_modules/{module}/adapters/{entity}Airlock.ts
export function parse{Entity}(raw: unknown): {Entity} {
  const result = {Entity}Schema.safeParse(raw);
  if (!result.success) {
    throw new AirlockBreachError('{Entity}', raw, result.error);
  }
  return result.data;
}
```

- [ ] Function throws `AirlockBreachError` on failure
- [ ] Validation errors included in exception
- [ ] Raw data preserved for debugging

### 3. Use in Adapters

```typescript
// In: src/02_modules/{module}/adapters/{entity}Api.ts
export async function fetch{Entity}(id: {Entity}Id): Promise<{Entity}> {
  const response = await api.get(`/{entities}/${id}`);
  return parse{Entity}(response.data);  // Airlock here!
}
```

- [ ] Every API response parsed through airlock
- [ ] Every IPC response parsed through airlock
- [ ] Every storage read parsed through airlock

## When Evolving Schema (Adding Version)

### 1. Keep Old Schema

```typescript
// Rename current to V{N}
const {Entity}V1Schema = z.object({ ... });
type {Entity}V1 = z.infer<typeof {Entity}V1Schema>;
```

- [ ] Old schema preserved (don't delete!)
- [ ] Type alias created for old version

### 2. Create New Schema

```typescript
const {Entity}V2Schema = z.object({
  version: z.literal(2),
  // ... evolved fields
});
```

- [ ] Version number incremented
- [ ] Breaking changes documented
- [ ] New fields have defaults or are optional

### 3. Create Upcast Function

```typescript
function upcast{Entity}V1toV2(v1: {Entity}V1): {Entity}V2 {
  return {
    version: 2,
    // ... map old fields to new
  };
}
```

- [ ] Function is pure (no side effects)
- [ ] All fields mapped explicitly
- [ ] Throws `DataCorruptionError` on failure

### 4. Update Parse Function

```typescript
export function parse{Entity}(raw: unknown): {Entity} {
  // Try V2 first
  const v2Result = {Entity}V2Schema.safeParse(raw);
  if (v2Result.success) return v2Result.data;

  // Try V1 and upcast
  const v1Result = {Entity}V1Schema.safeParse(raw);
  if (v1Result.success) {
    return upcast{Entity}V1toV2(v1Result.data);
  }

  throw new AirlockBreachError(...);
}
```

- [ ] Current version tried first (fast path)
- [ ] Each old version tried in order
- [ ] Upcast chain applied correctly

## Code Review Checklist

### Boundary Checks

- [ ] All `fetch()` responses go through airlock
- [ ] All `invoke()` (Tauri IPC) responses go through airlock
- [ ] All `localStorage`/`sessionStorage` reads go through airlock
- [ ] All WebSocket messages go through airlock

### Domain Purity

- [ ] No version checks in domain layer
- [ ] No optional chaining for legacy fields
- [ ] No `if (data.oldField)` patterns
- [ ] Domain only uses current schema type

### Error Handling

- [ ] `AirlockBreachError` caught at adapter boundary
- [ ] `DataCorruptionError` logged with context
- [ ] Corrupted cached data cleaned up
- [ ] User notified of data issues appropriately

## Common Patterns

### API Adapter

```typescript
async function fetchItems(): Promise<Item[]> {
  const response = await api.get('/items');
  return response.data.map(parseItem);  // Airlock each item
}
```

### Tauri IPC Adapter

```typescript
async function getSettings(): Promise<Settings> {
  const raw = await invoke('get_settings');
  return parseSettings(raw);
}
```

### Storage Adapter

```typescript
function loadCart(): Cart | null {
  const raw = localStorage.getItem('cart');
  if (!raw) return null;
  try {
    return parseCart(JSON.parse(raw));
  } catch {
    localStorage.removeItem('cart');  // Clean corrupted
    return null;
  }
}
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| `as Entity` | No validation | Use `parseEntity()` |
| `response.data` | Raw data in domain | Parse first |
| `data?.newField ?? data?.oldField` | Version logic in domain | Upcast in airlock |
| Silent parse failure | Corrupted data ignored | Throw AirlockBreachError |

## Files to Check

When reviewing Pillar B compliance:

1. `src/02_modules/*/adapters/*.ts` - All adapters
2. `src/01_domains/*/schema.ts` - Schema definitions
3. `src/03_migrations/*.ts` - Upcast functions

## Migration Checklist (Schema Evolution)

When adding a new schema version:

1. [ ] Document breaking changes
2. [ ] Create upcast function
3. [ ] Update parse function
4. [ ] Test with old data samples
5. [ ] Update mock factories (Pillar C)
6. [ ] Deploy backend first (if applicable)

## Template Reference

Copy from: `.prot/pillar-b/airlock.ts`
