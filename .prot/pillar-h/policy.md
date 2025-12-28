# Pillar H: Policy-as-Code

> Decouple authorization from workflow logic

## Rule

**Authorization** (Can I do it?) and **Business Constraints** (Should I do it?) must be decoupled from the **Workflow** (How I do it).

## Purpose

- Security rules evolve independently of business logic
- Centralized policy management
- Testable authorization logic
- Clear separation of concerns

## Implementation

### Policy Interface

```typescript
// 00_kernel/policy.ts

interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

type PolicyFn<T> = (context: PolicyContext, subject: T) => Promise<PolicyResult>;

interface PolicyContext {
  user: User;
  roles: Role[];
  permissions: Permission[];
  metadata: Record<string, unknown>;
}

class PolicyError extends Error {
  constructor(
    public readonly policy: string,
    public readonly reason: string
  ) {
    super(`Policy violation: ${policy} - ${reason}`);
    this.name = 'PolicyError';
  }
}
```

### Policy Definitions

```typescript
// 01_domains/order/policies.ts

const canRefundOrder: PolicyFn<Order> = async (ctx, order) => {
  // Authorization: Does user have permission?
  if (!ctx.permissions.includes('order:refund')) {
    return { allowed: false, reason: 'Missing refund permission' };
  }

  // Business constraint: Is refund allowed?
  if (order.status !== 'completed') {
    return { allowed: false, reason: 'Order not completed' };
  }

  const daysSinceOrder = daysBetween(order.createdAt, new Date());
  if (daysSinceOrder > 30) {
    return { allowed: false, reason: 'Refund window expired (30 days)' };
  }

  return { allowed: true };
};

const canCancelOrder: PolicyFn<Order> = async (ctx, order) => {
  // Only order owner or admin can cancel
  const isOwner = order.userId === ctx.user.id;
  const isAdmin = ctx.roles.includes('admin');

  if (!isOwner && !isAdmin) {
    return { allowed: false, reason: 'Not authorized to cancel this order' };
  }

  if (order.status === 'shipped') {
    return { allowed: false, reason: 'Cannot cancel shipped orders' };
  }

  return { allowed: true };
};
```

### Policy Assertion

```typescript
// 00_kernel/policy.ts

const Policy = {
  async assert<T>(
    policy: PolicyFn<T>,
    context: PolicyContext,
    subject: T,
    policyName: string
  ): Promise<void> {
    const result = await policy(context, subject);

    if (!result.allowed) {
      throw new PolicyError(policyName, result.reason || 'Not allowed');
    }
  },

  async check<T>(
    policy: PolicyFn<T>,
    context: PolicyContext,
    subject: T
  ): Promise<PolicyResult> {
    return policy(context, subject);
  },
};
```

### Usage in Workflow

```typescript
// 02_modules/order/workflows/refundOrder.ts

async function refundOrder(
  cmd: RefundOrderCommand,
  ctx: WorkflowContext
): Promise<RefundResult> {
  const order = await orderRepo.get(cmd.orderId);

  // Policy check BEFORE any business logic
  await Policy.assert(
    canRefundOrder,
    ctx.policyContext,
    order,
    'canRefundOrder'
  );

  // Now proceed with refund logic
  const refund = await paymentAdapter.refund(order.paymentId, cmd.amount);

  await orderRepo.update(order.id, {
    status: 'refunded',
    refundId: refund.id,
  });

  return { success: true, refundId: refund.id };
}
```

### UI Integration

```typescript
// headless/useOrderActions.ts

function useOrderActions(order: Order) {
  const { user, policyContext } = useAuth();

  const [canRefund, setCanRefund] = useState(false);
  const [canCancel, setCanCancel] = useState(false);

  useEffect(() => {
    // Check policies for UI state
    Policy.check(canRefundOrder, policyContext, order)
      .then(r => setCanRefund(r.allowed));

    Policy.check(canCancelOrder, policyContext, order)
      .then(r => setCanCancel(r.allowed));
  }, [order, policyContext]);

  return { canRefund, canCancel };
}

// View
function OrderActions({ order }) {
  const { canRefund, canCancel } = useOrderActions(order);

  return (
    <>
      <button disabled={!canRefund}>Refund</button>
      <button disabled={!canCancel}>Cancel</button>
    </>
  );
}
```

## Two Levels of Policy

Policy applies at **two distinct levels**:

| Level | Question | Example |
|-------|----------|---------|
| **Action-Level** | Can user do X to **this** entity? | Can user refund **this** order? |
| **Data-Level** | Which entities can user **see**? | Which orders appear in the list? |

### Action-Level (Single Entity)

Already covered above - use `Policy.assert()` before operations.

### Data-Level (Query Filtering)

```typescript
// 01_domains/order/policies.ts

// Data-level policy: returns query filter
type DataPolicyFn<TFilter> = (ctx: PolicyContext) => TFilter;

const orderVisibility: DataPolicyFn<OrderFilter> = (ctx) => {
  // Admin sees all
  if (ctx.roles.includes('admin')) {
    return {};
  }

  // Regular user sees only their orders
  return { userId: ctx.user.id };
};
```

### Usage in Repository

```typescript
// 02_modules/order/adapters/orderRepo.ts

async function listOrders(ctx: PolicyContext): Promise<Order[]> {
  // Apply data-level policy to query
  const filter = orderVisibility(ctx);

  return db.orders.findMany({
    where: filter,
  });
}

// ❌ BAD: No filter - returns ALL orders (BOLA vulnerability)
async function listOrdersUnsafe(): Promise<Order[]> {
  return db.orders.findMany();
}
```

### Combined Example

```typescript
// Workflow: list orders then refund one

async function refundOrderFromList(
  cmd: RefundCommand,
  ctx: WorkflowContext
): Promise<RefundResult> {
  // 1. Data-Level: Get only orders user can see
  const orders = await orderRepo.listOrders(ctx.policyContext);

  // 2. Find the specific order
  const order = orders.find(o => o.id === cmd.orderId);
  if (!order) {
    throw new NotFoundError('Order not found');  // Or not authorized to see
  }

  // 3. Action-Level: Can user refund THIS order?
  await Policy.assert(canRefundOrder, ctx.policyContext, order, 'canRefundOrder');

  // 4. Execute
  return await paymentAdapter.refund(order.paymentId, cmd.amount);
}
```

> **Security Note**: Data-Level policy prevents BOLA (Broken Object Level Authorization), a top OWASP API vulnerability where users access other users' data by guessing IDs.

## Good Example

```typescript
// ✅ Clean separation

// Policy layer
const canEditDocument: PolicyFn<Document> = async (ctx, doc) => {
  if (doc.locked) return { allowed: false, reason: 'Document is locked' };
  if (doc.ownerId !== ctx.user.id && !ctx.roles.includes('editor')) {
    return { allowed: false, reason: 'Not authorized' };
  }
  return { allowed: true };
};

// Workflow layer
async function editDocument(cmd: EditDocumentCommand, ctx: Context) {
  const doc = await docRepo.get(cmd.docId);

  await Policy.assert(canEditDocument, ctx.policy, doc, 'canEditDocument');

  // Pure business logic, no auth checks here
  return await docRepo.update(doc.id, cmd.changes);
}
```

## Bad Example

```typescript
// ❌ Authorization mixed with business logic
async function editDocument(cmd, ctx) {
  const doc = await docRepo.get(cmd.docId);

  // Auth checks scattered in workflow
  if (doc.locked) throw new Error('Locked');
  if (doc.ownerId !== ctx.user.id) {
    if (!ctx.user.roles.includes('editor')) {
      throw new Error('Not authorized');
    }
  }

  // More auth checks later...
  if (doc.status === 'archived' && !ctx.user.isAdmin) {
    throw new Error('Cannot edit archived');
  }

  // Business logic interleaved with auth
  return await docRepo.update(doc.id, cmd.changes);
}
```

## Anti-Patterns

1. **Inline permission checks**
   ```typescript
   // ❌ Scattered throughout code
   if (user.role !== 'admin') throw new Error();
   ```

2. **Business rules in auth middleware**
   ```typescript
   // ❌ Middleware knows too much about domain
   app.use((req, res, next) => {
     if (order.status === 'shipped') return res.status(403);
   });
   ```

3. **UI-only authorization**
   ```typescript
   // ❌ Server doesn't enforce
   {canEdit && <EditButton />}  // Button hidden but API unprotected
   ```

## Exceptions

- Simple CRUD with role-based access (may use middleware)
- Public endpoints without authorization

## Checklist

- [ ] All authorization logic in Policy functions
- [ ] Policies separate from workflow code
- [ ] `Policy.assert()` called before business logic
- [ ] UI checks policies for button states
- [ ] Server always enforces (not just UI)
- [ ] Policies are unit testable

## References

- Related: Pillar I (Firewalls) - module boundaries
- Pattern: ABAC (Attribute-Based Access Control)
- Template: `.prot/pillar-h/policy.ts`
- Checklist: `.prot/pillar-h/checklist.md`
