/**
 * Pillar H: Policy-as-Code Template
 *
 * Decouple authorization from workflow logic.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - COPY this pattern for all authorization logic
 * - NEVER mix auth checks with business logic
 * - Policy.assert() BEFORE any business operation
 * - UI checks policies for button states, server ALWAYS enforces
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Result of a policy check.
 */
export interface PolicyResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Context for policy evaluation.
 * Passed to all policy functions.
 */
export interface PolicyContext {
  readonly user: {
    readonly id: string;
    readonly email: string;
  };
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly metadata: Record<string, unknown>;
}

/**
 * Policy function signature.
 * Takes context and subject, returns allow/deny.
 */
export type PolicyFn<T> = (
  context: PolicyContext,
  subject: T
) => Promise<PolicyResult> | PolicyResult;

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Thrown when a policy check fails.
 */
export class PolicyError extends Error {
  constructor(
    public readonly policy: string,
    public readonly reason: string
  ) {
    super(`Policy violation: ${policy} - ${reason}`);
    this.name = 'PolicyError';
  }
}

/**
 * Thrown when user is not authenticated.
 */
export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// =============================================================================
// POLICY SERVICE
// =============================================================================

/**
 * Policy service for checking and asserting policies.
 *
 * ⚠️ AI NOTE: Use Policy.assert() in workflows, Policy.check() in UI
 */
export const Policy = {
  /**
   * Assert a policy. Throws if not allowed.
   * Use in workflows BEFORE business logic.
   *
   * @example
   * ```typescript
   * await Policy.assert(canRefundOrder, ctx, order, 'canRefundOrder');
   * // If we get here, policy passed
   * await processRefund(order);
   * ```
   */
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

  /**
   * Check a policy. Returns result without throwing.
   * Use in UI to determine button states.
   *
   * @example
   * ```typescript
   * const canRefund = await Policy.check(canRefundOrder, ctx, order);
   * setRefundEnabled(canRefund.allowed);
   * ```
   */
  async check<T>(
    policy: PolicyFn<T>,
    context: PolicyContext,
    subject: T
  ): Promise<PolicyResult> {
    return policy(context, subject);
  },

  /**
   * Combine multiple policies with AND logic.
   * All must pass for result to be allowed.
   */
  all<T>(...policies: PolicyFn<T>[]): PolicyFn<T> {
    return async (context, subject) => {
      for (const policy of policies) {
        const result = await policy(context, subject);
        if (!result.allowed) {
          return result;
        }
      }
      return { allowed: true };
    };
  },

  /**
   * Combine multiple policies with OR logic.
   * Any one passing is sufficient.
   */
  any<T>(...policies: PolicyFn<T>[]): PolicyFn<T> {
    return async (context, subject) => {
      const reasons: string[] = [];

      for (const policy of policies) {
        const result = await policy(context, subject);
        if (result.allowed) {
          return { allowed: true };
        }
        if (result.reason) {
          reasons.push(result.reason);
        }
      }

      return { allowed: false, reason: reasons.join('; ') };
    };
  },
};

// =============================================================================
// COMMON POLICY HELPERS
// =============================================================================

/**
 * Check if user has specific role.
 */
export function hasRole(role: string): PolicyFn<unknown> {
  return (context) => ({
    allowed: context.roles.includes(role),
    reason: `Requires role: ${role}`,
  });
}

/**
 * Check if user has specific permission.
 */
export function hasPermission(permission: string): PolicyFn<unknown> {
  return (context) => ({
    allowed: context.permissions.includes(permission),
    reason: `Requires permission: ${permission}`,
  });
}

/**
 * Check if user owns the resource.
 */
export function isOwner<T extends { userId: string }>(
  resource: T
): PolicyFn<T> {
  return (context, subject) => ({
    allowed: context.user.id === subject.userId,
    reason: 'Must be resource owner',
  });
}

/**
 * Check if user is admin.
 */
export const isAdmin: PolicyFn<unknown> = (context) => ({
  allowed: context.roles.includes('admin'),
  reason: 'Admin access required',
});

// =============================================================================
// EXAMPLE DOMAIN POLICIES
// =============================================================================

/**
 * Example: Order domain policies
 *
 * ⚠️ AI NOTE: Copy this pattern for your domain policies
 */

interface Order {
  id: string;
  userId: string;
  status: 'pending' | 'completed' | 'shipped' | 'refunded';
  createdAt: Date;
  totalAmount: number;
}

/**
 * Policy: Can user refund this order?
 */
export const canRefundOrder: PolicyFn<Order> = async (ctx, order) => {
  // 1. Permission check
  if (!ctx.permissions.includes('order:refund')) {
    return { allowed: false, reason: 'Missing refund permission' };
  }

  // 2. Business constraint: Order must be completed
  if (order.status !== 'completed') {
    return { allowed: false, reason: 'Order not completed' };
  }

  // 3. Business constraint: Within refund window
  const daysSinceOrder = Math.floor(
    (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceOrder > 30) {
    return { allowed: false, reason: 'Refund window expired (30 days)' };
  }

  return { allowed: true };
};

/**
 * Policy: Can user cancel this order?
 */
export const canCancelOrder: PolicyFn<Order> = async (ctx, order) => {
  // Owner or admin can cancel
  const isOrderOwner = order.userId === ctx.user.id;
  const isAdminUser = ctx.roles.includes('admin');

  if (!isOrderOwner && !isAdminUser) {
    return { allowed: false, reason: 'Not authorized to cancel this order' };
  }

  // Cannot cancel shipped orders
  if (order.status === 'shipped') {
    return { allowed: false, reason: 'Cannot cancel shipped orders' };
  }

  return { allowed: true };
};

/**
 * Policy: Can user view this order?
 */
export const canViewOrder: PolicyFn<Order> = (ctx, order) => {
  const isOrderOwner = order.userId === ctx.user.id;
  const isAdminUser = ctx.roles.includes('admin');
  const hasViewPermission = ctx.permissions.includes('order:view');

  return {
    allowed: isOrderOwner || isAdminUser || hasViewPermission,
    reason: 'Not authorized to view this order',
  };
};

// =============================================================================
// USAGE IN WORKFLOW
// =============================================================================

/*
⚠️ AI NOTE: Use policies in workflows like this:

```typescript
// 02_modules/order/workflows/refundOrder.ts

async function refundOrder(
  cmd: RefundOrderCommand,
  ctx: WorkflowContext
): Promise<RefundResult> {
  // 1. Load entity
  const order = await orderRepo.get(cmd.orderId);

  // 2. Policy check FIRST (before any business logic)
  await Policy.assert(canRefundOrder, ctx.policy, order, 'canRefundOrder');

  // 3. Now safe to proceed with business logic
  const refund = await paymentAdapter.refund(order.paymentId, cmd.amount);

  await orderRepo.update(order.id, {
    status: 'refunded',
    refundId: refund.id,
  });

  return { success: true, refundId: refund.id };
}
```
*/

// =============================================================================
// USAGE IN REACT HOOKS
// =============================================================================

/*
⚠️ AI NOTE: Use policies in React hooks like this:

```typescript
// headless/useOrderActions.ts

function useOrderActions(order: Order) {
  const { policyContext } = useAuth();
  const [permissions, setPermissions] = useState({
    canRefund: false,
    canCancel: false,
    canView: false,
  });

  useEffect(() => {
    async function checkPolicies() {
      const [refund, cancel, view] = await Promise.all([
        Policy.check(canRefundOrder, policyContext, order),
        Policy.check(canCancelOrder, policyContext, order),
        Policy.check(canViewOrder, policyContext, order),
      ]);

      setPermissions({
        canRefund: refund.allowed,
        canCancel: cancel.allowed,
        canView: view.allowed,
      });
    }

    checkPolicies();
  }, [order, policyContext]);

  return permissions;
}
```
*/

// =============================================================================
// TEMPLATE FOR NEW DOMAIN POLICY
// =============================================================================

/*
⚠️ AI: Copy this template when creating new domain policies:

1. Define the entity type:
   ```typescript
   interface MyEntity {
     id: string;
     userId: string;
     status: 'draft' | 'published' | 'archived';
     // ... other fields
   }
   ```

2. Create policy function:
   ```typescript
   export const canDoAction: PolicyFn<MyEntity> = async (ctx, entity) => {
     // Check 1: Permission
     if (!ctx.permissions.includes('entity:action')) {
       return { allowed: false, reason: 'Missing permission' };
     }

     // Check 2: Ownership or role
     const isEntityOwner = entity.userId === ctx.user.id;
     if (!isEntityOwner && !ctx.roles.includes('admin')) {
       return { allowed: false, reason: 'Not authorized' };
     }

     // Check 3: Business constraint
     if (entity.status === 'archived') {
       return { allowed: false, reason: 'Cannot act on archived entity' };
     }

     return { allowed: true };
   };
   ```

3. Use in workflow:
   ```typescript
   await Policy.assert(canDoAction, ctx.policy, entity, 'canDoAction');
   ```

4. Use in UI:
   ```typescript
   const result = await Policy.check(canDoAction, ctx.policy, entity);
   setButtonEnabled(result.allowed);
   ```
*/
