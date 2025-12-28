/**
 * Pillar F: Zero-Trust Concurrency Template
 *
 * Use Optimistic Locking (CAS) to prevent lost updates.
 * Every T3 write must assume race conditions WILL occur.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - COPY this pattern for entities that can be concurrently modified
 * - Always include version field in entities
 * - Never skip version check for T3 writes
 */

// ============================================
// 1. ERROR TYPES
// ============================================

/**
 * Thrown when version mismatch detected
 */
export class StaleDataError extends Error {
  constructor(
    public readonly entity: string,
    public readonly expectedVersion: number,
    public readonly actualVersion?: number
  ) {
    super(
      `Stale data: ${entity} was modified by another process. ` +
      `Expected version ${expectedVersion}` +
      (actualVersion !== undefined ? `, got ${actualVersion}` : '')
    );
    this.name = 'StaleDataError';
  }
}

/**
 * Retryable error with guidance for client
 */
export interface RetryableErrorInfo {
  code: 'STALE_DATA' | 'CONFLICT';
  retryable: boolean;
  action: 'REFRESH_AND_RETRY' | 'WAIT_AND_RETRY';
  retryAfterMs?: number;
}

export class ConcurrencyError extends Error {
  constructor(
    message: string,
    public readonly info: RetryableErrorInfo
  ) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

// ============================================
// 2. VERSIONED ENTITY PATTERN
// ============================================

/**
 * Base interface for all versioned entities
 */
interface VersionedEntity {
  id: string;
  version: number;
  updatedAt: Date;
}

/**
 * Example: Order entity with version
 */
type OrderId = string & { readonly __brand: 'OrderId' };
type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

interface Order extends VersionedEntity {
  id: OrderId;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

// ============================================
// 3. UPDATE COMMAND PATTERN
// ============================================

/**
 * Commands must include expected version
 */
interface UpdateOrderCommand {
  orderId: OrderId;
  expectedVersion: number;  // REQUIRED for CAS
  updates: Partial<Pick<Order, 'status' | 'items'>>;
}

// ============================================
// 4. REPOSITORY WITH CAS
// ============================================

/**
 * SQL Implementation (PostgreSQL)
 */
async function updateOrderSQL(cmd: UpdateOrderCommand): Promise<Order> {
  const { orderId, expectedVersion, updates } = cmd;

  // Atomic update with version check
  const result = await db.query<Order>(`
    UPDATE orders
    SET
      status = COALESCE($1, status),
      version = version + 1,
      updated_at = NOW()
    WHERE id = $2 AND version = $3
    RETURNING *
  `, [updates.status, orderId, expectedVersion]);

  if (result.rowCount === 0) {
    // Check if entity exists
    const existing = await db.query('SELECT version FROM orders WHERE id = $1', [orderId]);
    if (existing.rowCount === 0) {
      throw new Error(`Order ${orderId} not found`);
    }
    throw new StaleDataError('Order', expectedVersion, existing.rows[0].version);
  }

  return result.rows[0];
}

/**
 * DynamoDB Implementation
 */
async function updateOrderDynamo(cmd: UpdateOrderCommand): Promise<Order> {
  const { orderId, expectedVersion, updates } = cmd;

  try {
    const result = await dynamoClient.send(new UpdateItemCommand({
      TableName: 'orders',
      Key: { id: { S: orderId } },
      UpdateExpression: 'SET #status = :status, #version = :newVersion, #updatedAt = :now',
      ConditionExpression: '#version = :expectedVersion',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#version': 'version',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status': { S: updates.status! },
        ':newVersion': { N: String(expectedVersion + 1) },
        ':expectedVersion': { N: String(expectedVersion) },
        ':now': { S: new Date().toISOString() },
      },
      ReturnValues: 'ALL_NEW',
    }));

    return unmarshallOrder(result.Attributes!);
  } catch (error: unknown) {
    if ((error as Error).name === 'ConditionalCheckFailedException') {
      throw new StaleDataError('Order', expectedVersion);
    }
    throw error;
  }
}

// ============================================
// 5. SAGA INTEGRATION
// ============================================

/**
 * Using CAS in a saga workflow
 */
async function processOrderUpdate(
  cmd: UpdateOrderCommand,
  ctx: { traceId: string }
): Promise<Order> {
  // 1. Pre-check: Read current state
  const current = await orderRepo.get(cmd.orderId);

  // 2. Validate: Version must match
  if (current.version !== cmd.expectedVersion) {
    throw new ConcurrencyError('Order was modified by another process', {
      code: 'STALE_DATA',
      retryable: true,
      action: 'REFRESH_AND_RETRY',
    });
  }

  // 3. Execute: Atomic update with CAS
  try {
    const updated = await updateOrderSQL(cmd);

    // 4. Log: Include version info for debugging
    console.log(JSON.stringify({
      event: 'ORDER_UPDATED',
      orderId: cmd.orderId,
      fromVersion: cmd.expectedVersion,
      toVersion: updated.version,
      traceId: ctx.traceId,
    }));

    return updated;
  } catch (error) {
    if (error instanceof StaleDataError) {
      throw new ConcurrencyError('Concurrent modification detected', {
        code: 'STALE_DATA',
        retryable: true,
        action: 'REFRESH_AND_RETRY',
      });
    }
    throw error;
  }
}

// ============================================
// 6. FRONTEND HOOK
// ============================================

/**
 * React hook with optimistic locking
 */
function useOrderEditor(orderId: OrderId) {
  const [order, setOrder] = useState<Order | null>(null);
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  const updateOrder = async (updates: Partial<Order>) => {
    if (!order) return;

    dispatch({ type: 'UPDATE_START' });

    try {
      const updated = await orderApi.update({
        orderId: order.id,
        expectedVersion: order.version,  // Send current version
        updates,
      });

      setOrder(updated);  // Update with new version
      dispatch({ type: 'UPDATE_SUCCESS' });
    } catch (error) {
      if (error instanceof ConcurrencyError && error.info.retryable) {
        dispatch({ type: 'CONFLICT', message: 'Order was modified. Refreshing...' });
        await refreshOrder();
      } else {
        dispatch({ type: 'ERROR', error });
      }
    }
  };

  const refreshOrder = async () => {
    const fresh = await orderApi.get(orderId);
    setOrder(fresh);
    dispatch({ type: 'REFRESHED' });
  };

  return { order, state, updateOrder, refreshOrder };
}

// ============================================
// 7. TEMPLATE FOR NEW ENTITIES
// ============================================

/**
 * Copy this pattern for new versioned entities:
 *
 * 1. Add version field to entity:
 *    ```typescript
 *    interface MyEntity extends VersionedEntity {
 *      id: MyEntityId;
 *      version: number;
 *      updatedAt: Date;
 *      // ... other fields
 *    }
 *    ```
 *
 * 2. Add expectedVersion to update command:
 *    ```typescript
 *    interface UpdateMyEntityCommand {
 *      id: MyEntityId;
 *      expectedVersion: number;
 *      updates: Partial<MyEntity>;
 *    }
 *    ```
 *
 * 3. Implement atomic update with CAS:
 *    ```typescript
 *    // SQL: WHERE version = $expected
 *    // DynamoDB: ConditionExpression: '#version = :expected'
 *    ```
 *
 * 4. Handle StaleDataError in saga
 */

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// ✅ CORRECT: Atomic CAS update

const updated = await updateOrder({
  orderId: 'order_123' as OrderId,
  expectedVersion: 5,  // Client's current version
  updates: { status: 'confirmed' },
});
// Returns order with version 6


// ✅ CORRECT: Handle conflict in UI

try {
  await updateOrder(cmd);
} catch (error) {
  if (error instanceof ConcurrencyError) {
    showToast('Order was modified. Please review changes.');
    await refreshOrder();
  }
}


// ❌ WRONG: Read-modify-write gap

const order = await getOrder(id);
order.status = 'confirmed';
await saveOrder(order);  // Race condition!


// ❌ WRONG: Skip version check

await updateOrder({
  orderId: 'order_123',
  // Missing expectedVersion!
  updates: { status: 'confirmed' },
});


// ❌ WRONG: Ignore version mismatch

if (current.version !== expected) {
  console.warn('Version mismatch');
  // Proceeding anyway - BAD!
}
await save(updates);
*/

// Placeholder imports for type checking
declare const db: {
  query<T>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
};
declare const dynamoClient: { send: (cmd: unknown) => Promise<{ Attributes?: Record<string, unknown> }> };
declare class UpdateItemCommand { constructor(params: unknown) {} }
declare function unmarshallOrder(attrs: Record<string, unknown>): Order;
declare const orderRepo: { get: (id: OrderId) => Promise<Order> };
declare const orderApi: { get: (id: OrderId) => Promise<Order>; update: (cmd: UpdateOrderCommand) => Promise<Order> };
declare function useState<T>(init: T): [T, (v: T) => void];
declare function useReducer<S, A>(r: (s: S, a: A) => S, init: S): [S, (a: A) => void];
declare const reducer: (s: { status: string }, a: { type: string; message?: string; error?: unknown }) => { status: string };

export {
  updateOrderSQL,
  updateOrderDynamo,
  processOrderUpdate,
  useOrderEditor,
};

export type {
  VersionedEntity,
  Order,
  OrderItem,
  UpdateOrderCommand,
};
