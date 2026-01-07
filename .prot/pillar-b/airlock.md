# Pillar B: Evolutionary Airlock

> Validate and upcast all external data at system boundaries

## Rule

All data crossing system boundaries (I/O) must be:
1. **Validated** against a strict schema
2. **Automatically upgraded** to the latest version

The Domain layer should **NEVER** contain legacy handling logic like `if (data.oldField)`.

## Purpose

- Decouple Domain from legacy data structures
- Single place for data transformation
- Clean, predictable data in business logic
- Safe schema evolution without breaking changes

## Implementation (TypeScript + Zod)

### Principle: Schema-First Development

> **Always define Zod schemas BEFORE writing any implementation code.**
> The Schema is the contract; the Code is just the fulfillment.

#### Why Schema-First?

| Approach | AI Accuracy | Maintenance |
|----------|-------------|-------------|
| Code-First | Low - AI guesses structure | Schema drifts from reality |
| Schema-First | **High** - AI has explicit contract | Schema IS the source of truth |

#### Schema-First Workflow

```
1. Define Schema    → docs/architecture/SCHEMA.md (human-readable)
2. Create Zod Types → src/01_domains/{entity}/schema.ts
3. Write Service    → src/02_modules/{module}/services/*.ts
4. Write Tests      → tests/ (as usage documentation)
```

#### AI-Intent Comments (Pillar G Enhancement)

For complex schemas, add intent comments to help AI understand "why":

```typescript
// @ai-intent: separate address to enable future multi-address support
const UserSchema = z.object({
  id: UserIdSchema,
  // @ai-intent: email is immutable after registration (used as login identifier)
  email: z.string().email(),
  profile: ProfileSchema,
});
```

### Schema Definition

```typescript
import { z } from 'zod';

// Current version schema
const UserV3Schema = z.object({
  version: z.literal(3),
  id: z.string(),
  email: z.string().email(),
  profile: z.object({
    displayName: z.string(),
    avatarUrl: z.string().url().optional(),
  }),
});

// Legacy schemas for parsing
const UserV1Schema = z.object({
  version: z.literal(1).optional(),
  id: z.string(),
  email: z.string(),
  name: z.string(),  // Old field
});

const UserV2Schema = z.object({
  version: z.literal(2),
  id: z.string(),
  email: z.string(),
  displayName: z.string(),  // Renamed
});
```

### Upcasting Functions

```typescript
// V1 → V2
function upcastV1toV2(v1: z.infer<typeof UserV1Schema>): z.infer<typeof UserV2Schema> {
  return {
    version: 2,
    id: v1.id,
    email: v1.email,
    displayName: v1.name,  // Rename field
  };
}

// V2 → V3
function upcastV2toV3(v2: z.infer<typeof UserV2Schema>): z.infer<typeof UserV3Schema> {
  return {
    version: 3,
    id: v2.id,
    email: v2.email,
    profile: {
      displayName: v2.displayName,
      avatarUrl: undefined,  // New optional field
    },
  };
}
```

### Airlock Function

```typescript
type User = z.infer<typeof UserV3Schema>;

function parseUser(raw: unknown): User {
  // Try current version first
  const v3Result = UserV3Schema.safeParse(raw);
  if (v3Result.success) return v3Result.data;

  // Try V2 and upcast
  const v2Result = UserV2Schema.safeParse(raw);
  if (v2Result.success) {
    return upcastV2toV3(v2Result.data);
  }

  // Try V1 and upcast through chain
  const v1Result = UserV1Schema.safeParse(raw);
  if (v1Result.success) {
    const v2 = upcastV1toV2(v1Result.data);
    return upcastV2toV3(v2);
  }

  // Validation failed
  throw new AirlockBreachError('Invalid user data', raw);
}
```

### Error Types

```typescript
class AirlockBreachError extends Error {
  constructor(message: string, public readonly data: unknown) {
    super(`Airlock Breach: ${message}`);
    this.name = 'AirlockBreachError';
  }
}

class DataCorruptionError extends Error {
  constructor(message: string, public readonly version: number) {
    super(`Data Corruption during upcast: ${message}`);
    this.name = 'DataCorruptionError';
  }
}
```

## Good Example

```typescript
// Adapter layer - airlock at boundary
async function fetchUser(id: UserId): Promise<User> {
  const response = await api.get(`/users/${id}`);

  // Airlock: validate + upcast
  return parseUser(response.data);
}

// Domain layer - receives clean data
function calculateUserScore(user: User): number {
  // No version checks needed!
  // user.profile.displayName always exists
  return user.profile.displayName.length * 10;
}
```

## Bad Example

```typescript
// ❌ Version checks scattered in domain
function calculateUserScore(user: any): number {
  // Legacy handling pollutes business logic
  const name = user.profile?.displayName
    || user.displayName
    || user.name
    || 'Unknown';

  return name.length * 10;
}

// ❌ No validation at boundary
async function fetchUser(id: string): Promise<any> {
  const response = await api.get(`/users/${id}`);
  return response.data;  // Raw, unvalidated data!
}
```

## Anti-Patterns

1. **Optional chaining for legacy fields**
   ```typescript
   // ❌ Domain shouldn't know about legacy
   const name = user?.profile?.displayName ?? user?.name;
   ```

2. **Type assertions without validation**
   ```typescript
   // ❌ Trusting external data
   const user = response.data as User;
   ```

3. **Version checks in domain layer**
   ```typescript
   // ❌ Domain polluted with version logic
   if (user.version === 1) { ... }
   ```

4. **Accepting `any` from APIs**
   ```typescript
   // ❌ No type safety
   function processUser(user: any) { }
   ```

## Exceptions

- Internal function calls within the same module (already typed)
- Performance-critical hot paths (with documented risk)

## Checklist

- [ ] All API responses pass through schema validation
- [ ] Upcast functions exist for each version migration
- [ ] Domain code has no version checks
- [ ] AirlockBreachError thrown on validation failure
- [ ] DataCorruptionError thrown on upcast failure
- [ ] Migrations folder contains version transformers

## References

- Related: Pillar A (Nominal Typing) - type safety after airlock
- Related: Pillar C (Mocking) - test data from schemas
- Location: `03_migrations/` for upcast functions
- Template: `.prot/pillar-b/airlock.ts`
- Checklist: `.prot/pillar-b/checklist.md`
- Audit: `.prot/pillar-b/audit.ts`
