# Pillar F: Zero-Trust Concurrency

> Assume race conditions will occur on every T3 write

## Rule

Every Tier 3 write operation must assume a race condition **WILL** occur. Use Optimistic Locking (CAS) to prevent lost updates.

## Purpose

- Prevent "Lost Update" anomalies
- Handle concurrent modifications safely
- Provide clear conflict resolution path
- Maintain data integrity without pessimistic locks

## Implementation

### Entity with Version Field

```typescript
interface Order {
  id: OrderId;
  version: number;  // Increment on every update
  status: OrderStatus;
  items: OrderItem[];
  updatedAt: Date;
}
```

### Compare-And-Swap Pattern

```typescript
async function updateOrder(
  orderId: OrderId,
  expectedVersion: number,
  updates: Partial<Order>
): Promise<Order> {
  // Atomic update with version check
  const result = await db.query(`
    UPDATE orders
    SET
      status = $1,
      version = version + 1,
      updated_at = NOW()
    WHERE id = $2 AND version = $3
    RETURNING *
  `, [updates.status, orderId, expectedVersion]);

  if (result.rowCount === 0) {
    throw new StaleDataError(
      'Order was modified by another process. Please refresh and retry.'
    );
  }

  return result.rows[0];
}
```

### Error Handling

```typescript
class StaleDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaleDataError';
  }
}

// In saga/workflow
async function processOrderUpdate(cmd: UpdateOrderCommand) {
  try {
    return await updateOrder(
      cmd.orderId,
      cmd.expectedVersion,
      cmd.updates
    );
  } catch (error) {
    if (error instanceof StaleDataError) {
      // Client should refresh and retry
      throw new RetryableError('Concurrency conflict', {
        code: 'STALE_DATA',
        retryable: true,
        action: 'REFRESH_AND_RETRY',
      });
    }
    throw error;
  }
}
```

### Frontend Integration

```typescript
// headless/useOrderEditor.ts
function useOrderEditor(orderId: OrderId) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateOrder = async (updates: Partial<Order>) => {
    if (!order) return;

    try {
      const updated = await orderApi.update({
        orderId: order.id,
        expectedVersion: order.version,  // Send current version
        updates,
      });
      setOrder(updated);  // Update with new version
    } catch (e) {
      if (e.code === 'STALE_DATA') {
        setError('This order was modified. Refreshing...');
        await refreshOrder();
      }
    }
  };

  return { order, updateOrder, error };
}
```

### DynamoDB Implementation

```typescript
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

async function updateOrderDynamo(
  orderId: OrderId,
  expectedVersion: number,
  updates: Partial<Order>
): Promise<Order> {
  try {
    const result = await client.send(new UpdateItemCommand({
      TableName: 'orders',
      Key: { id: { S: orderId } },
      UpdateExpression: 'SET #status = :status, #version = :newVersion',
      ConditionExpression: '#version = :expectedVersion',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#version': 'version',
      },
      ExpressionAttributeValues: {
        ':status': { S: updates.status },
        ':newVersion': { N: String(expectedVersion + 1) },
        ':expectedVersion': { N: String(expectedVersion) },
      },
      ReturnValues: 'ALL_NEW',
    }));

    return unmarshall(result.Attributes);
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new StaleDataError('Concurrent modification detected');
    }
    throw error;
  }
}
```

## Good Example

```typescript
// ✅ Complete CAS implementation
async function checkout(cmd: CheckoutCommand, ctx: Context) {
  // 1. Read current state
  const cart = await cartRepo.get(cmd.cartId);

  // 2. Validate version matches
  if (cart.version !== cmd.expectedVersion) {
    throw new StaleDataError('Cart was modified');
  }

  // 3. Process with version increment
  const order = await createOrder({
    ...cart,
    version: cart.version + 1,
  });

  // 4. Log with version info
  logger.json('ORDER_CREATED', {
    orderId: order.id,
    fromVersion: cmd.expectedVersion,
    toVersion: order.version,
    traceId: ctx.traceId,
  });

  return order;
}
```

## Bad Example

```typescript
// ❌ No version check - lost updates possible
async function updateOrder(orderId, updates) {
  const order = await db.get(orderId);
  // Another process could modify between read and write!
  order.status = updates.status;
  await db.save(order);  // Overwrites concurrent changes
}

// ❌ Client-side only check
async function updateOrder(orderId, updates) {
  if (localOrder.updatedAt === serverOrder.updatedAt) {
    // Race condition: server could change after this check
    await db.save(updates);
  }
}
```

## Anti-Patterns

1. **Read-modify-write without atomicity**
   ```typescript
   const data = await read();
   data.value = newValue;
   await write(data);  // ❌ Gap between read and write
   ```

2. **Timestamp-based comparison**
   ```typescript
   // ❌ Timestamp precision issues, clock skew
   if (local.updatedAt >= server.updatedAt) { }
   ```

3. **Last-write-wins**
   ```typescript
   // ❌ Silently loses updates
   await db.save(updates);
   ```

4. **Ignoring version mismatch**
   ```typescript
   // ❌ Proceeding despite conflict
   if (version !== expected) console.log('warning');
   await save(data);
   ```

## Exceptions

- **Append-only logs**: Audit trails, event logs don't need locking
- **Idempotent operations**: Operations that produce same result regardless of repetition
- **Read-only operations**: T1 tier doesn't modify data

## Checklist

- [ ] All mutable entities have `version` field
- [ ] Updates use atomic CAS operations
- [ ] StaleDataError thrown on version mismatch
- [ ] Client receives clear retry guidance
- [ ] Version included in logs for debugging
- [ ] DynamoDB uses ConditionExpression

## References

- Related: Pillar Q (Idempotency) - prevent duplicate processing
- Related: Pillar M (Saga) - compensation on failure
- Pattern: Optimistic Concurrency Control (OCC)
- Template: `.prot/pillar-f/optimistic-lock.ts`
- Checklist: `.prot/pillar-f/checklist.md`
