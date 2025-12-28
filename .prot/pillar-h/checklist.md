# Pillar H: Policy-as-Code Checklist

> Use this checklist when implementing authorization or business constraints.

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Explicit > Abstract** | Each policy is a named, explicit function |
| **Copy > Generate** | Copy policy patterns from template |
| **Clear > DRY** | Separate policies even if similar; clarity for AI |

## When to Apply

- [ ] Adding authorization check (can user do X?)
- [ ] Adding business constraint (should action Y be allowed?)
- [ ] Creating workflow that requires permission
- [ ] UI needs to show/hide actions based on permissions

## Creating New Policy

### 1. Define Policy Function

- [ ] Policy is a separate function (not inline in workflow)
- [ ] Policy takes `PolicyContext` and subject as parameters
- [ ] Policy returns `PolicyResult` (allowed + reason)
- [ ] Policy has descriptive name (`canDoAction`)

```typescript
// ✅ Correct: Separate policy function
export const canRefundOrder: PolicyFn<Order> = async (ctx, order) => {
  if (!ctx.permissions.includes('order:refund')) {
    return { allowed: false, reason: 'Missing refund permission' };
  }
  return { allowed: true };
};

// ❌ Wrong: Inline check in workflow
async function refundOrder(cmd, ctx) {
  if (!ctx.user.permissions.includes('refund')) {  // Mixed with logic!
    throw new Error('Not allowed');
  }
}
```

### 2. Structure Policy Checks

- [ ] Permission checks first (RBAC/ABAC)
- [ ] Ownership checks second
- [ ] Business constraints last
- [ ] Clear reason for each denial

```typescript
export const canEditDocument: PolicyFn<Document> = async (ctx, doc) => {
  // 1. Permission check
  if (!ctx.permissions.includes('doc:edit')) {
    return { allowed: false, reason: 'Missing edit permission' };
  }

  // 2. Ownership check
  const isOwner = doc.userId === ctx.user.id;
  const isAdmin = ctx.roles.includes('admin');
  if (!isOwner && !isAdmin) {
    return { allowed: false, reason: 'Not document owner' };
  }

  // 3. Business constraint
  if (doc.status === 'archived') {
    return { allowed: false, reason: 'Cannot edit archived document' };
  }

  return { allowed: true };
};
```

### 3. Use in Workflow

- [ ] Load entity FIRST
- [ ] `Policy.assert()` BEFORE any business logic
- [ ] Policy name passed for error context

```typescript
async function editDocument(cmd: EditCommand, ctx: Context) {
  // 1. Load
  const doc = await docRepo.get(cmd.docId);

  // 2. Policy check (throws if denied)
  await Policy.assert(canEditDocument, ctx.policy, doc, 'canEditDocument');

  // 3. Business logic (only reached if policy passed)
  return await docRepo.update(doc.id, cmd.changes);
}
```

### 4. Use in UI

- [ ] `Policy.check()` for button/action states
- [ ] Check on load and on data change
- [ ] Server ALWAYS re-enforces (don't trust UI)

```typescript
function useDocumentActions(doc: Document) {
  const { policyContext } = useAuth();
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    Policy.check(canEditDocument, policyContext, doc)
      .then(r => setCanEdit(r.allowed));
  }, [doc, policyContext]);

  return { canEdit };
}
```

## Code Review Checklist

### Policy Functions
- [ ] All policies are named functions (not inline)
- [ ] Policies return `PolicyResult`, not throw
- [ ] Each denial has a reason string
- [ ] Policies are exported for testing

### Workflow Integration
- [ ] `Policy.assert()` called before business logic
- [ ] Entity loaded before policy check
- [ ] Policy name passed to assert (for error messages)
- [ ] No auth logic mixed in business code

### UI Integration
- [ ] `Policy.check()` used for UI state
- [ ] Buttons disabled when policy denies
- [ ] Server still enforces (UI is convenience, not security)

### Security
- [ ] Server-side enforcement exists (not just UI)
- [ ] Policies are unit tested
- [ ] Permission names are consistent across codebase

### Data-Level Policy (BOLA Prevention)
- [ ] List queries have user/tenant filter applied
- [ ] Repository methods take `PolicyContext` parameter
- [ ] No raw `findAll()` without visibility filter
- [ ] Admin bypass is explicit, not default

## Data-Level Policy

> Prevents BOLA (Broken Object Level Authorization) - OWASP API Top 10 #1

### When to Apply

- [ ] Listing entities (orders, documents, posts...)
- [ ] Search/filter endpoints
- [ ] Any query that returns multiple records

### Creating Data-Level Policy

```typescript
// 01_domains/{entity}/policies.ts

// Returns filter criteria, not boolean
type DataPolicyFn<TFilter> = (ctx: PolicyContext) => TFilter;

export const orderVisibility: DataPolicyFn<OrderFilter> = (ctx) => {
  // Admin sees all
  if (ctx.roles.includes('admin')) {
    return {};
  }
  // User sees only their own
  return { userId: ctx.user.id };
};
```

### Usage in Repository

```typescript
// ✅ Correct: Apply visibility filter
async function listOrders(ctx: PolicyContext): Promise<Order[]> {
  const filter = orderVisibility(ctx);
  return db.orders.findMany({ where: filter });
}

// ❌ Wrong: No filter (BOLA vulnerability!)
async function listOrders(): Promise<Order[]> {
  return db.orders.findMany();
}
```

### Combining Both Levels

```typescript
async function refundOrder(cmd, ctx) {
  // 1. Data-Level: Only see authorized orders
  const orders = await orderRepo.listOrders(ctx.policyContext);
  const order = orders.find(o => o.id === cmd.orderId);
  if (!order) throw new NotFoundError();

  // 2. Action-Level: Can refund THIS order?
  await Policy.assert(canRefundOrder, ctx.policyContext, order);

  // 3. Execute
  return await paymentAdapter.refund(order);
}
```

## Common Patterns

### 1. Simple Permission Check

```typescript
export const canViewReports: PolicyFn<unknown> = (ctx) => ({
  allowed: ctx.permissions.includes('reports:view'),
  reason: 'Reports access required',
});
```

### 2. Owner or Admin

```typescript
export const canDeletePost: PolicyFn<Post> = (ctx, post) => {
  const isOwner = post.authorId === ctx.user.id;
  const isAdmin = ctx.roles.includes('admin');

  return {
    allowed: isOwner || isAdmin,
    reason: 'Must be post author or admin',
  };
};
```

### 3. Time-based Constraint

```typescript
export const canEditOrder: PolicyFn<Order> = (ctx, order) => {
  const hoursSinceCreation =
    (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceCreation > 24) {
    return { allowed: false, reason: 'Edit window expired (24 hours)' };
  }

  return { allowed: true };
};
```

### 4. Combined Policies

```typescript
// All must pass
const canPublish = Policy.all(
  hasPermission('article:publish'),
  isOwner,
  articleIsComplete
);

// Any one is sufficient
const canView = Policy.any(
  isOwner,
  isAdmin,
  hasPermission('article:view')
);
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| Inline auth check | Mixed with business logic | Extract to policy function |
| UI-only check | Server unprotected | Add `Policy.assert()` in workflow |
| No reason string | Poor error messages | Always include reason |
| Policy after logic | Business runs before auth | Assert BEFORE logic |
| Throwing in policy | Inconsistent handling | Return `PolicyResult` |
| Hardcoded roles | Inflexible | Use permission system |
| `findAll()` without filter | BOLA vulnerability | Apply `DataPolicyFn` filter |
| Action-only policy | User can see others' data | Add Data-Level visibility |

## Anti-Patterns to Avoid

```typescript
// ❌ 1. Inline permission check
async function deletePost(id, ctx) {
  if (ctx.user.role !== 'admin') throw new Error('Nope');
  // ...
}

// ❌ 2. Auth in middleware, business rules in workflow
app.use(authMiddleware);  // Checks role
async function deletePost(id) {
  if (post.status === 'published') throw new Error();  // Business rule
}

// ❌ 3. UI check only
{user.isAdmin && <DeleteButton />}  // Server doesn't check!

// ❌ 4. Policy after business logic
async function updateOrder(cmd) {
  await orderRepo.update(cmd);  // Already executed!
  await Policy.assert(canUpdate);  // Too late
}
```

## Template Reference

Copy from: `.prot/pillar-h/policy.ts`

Key exports:
- `PolicyFn<T>` - Policy function type
- `PolicyContext` - Context interface
- `PolicyResult` - Return type
- `PolicyError` - Error class
- `Policy.assert()` - Throw on denial
- `Policy.check()` - Return result
- `Policy.all()` - Combine with AND
- `Policy.any()` - Combine with OR
- `hasRole()`, `hasPermission()`, `isOwner()` - Helpers
