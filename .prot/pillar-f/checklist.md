# Pillar F: Zero-Trust Concurrency Checklist

> Use this checklist when implementing T3 writes that modify shared data

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Assume Conflicts** | Every T3 write will face race conditions |
| **Atomic > Sequential** | Use CAS, not read-modify-write |
| **Explicit Version** | Always include version in commands |

## When Creating Versioned Entity

### 1. Add Version Field

```typescript
interface MyEntity {
  id: MyEntityId;
  version: number;      // REQUIRED
  updatedAt: Date;      // REQUIRED
  // ... other fields
}
```

- [ ] Entity has `version: number` field
- [ ] Entity has `updatedAt: Date` field
- [ ] Initial version is 1 (or 0)
- [ ] Version increments on every update

### 2. Create Update Command

```typescript
interface UpdateMyEntityCommand {
  id: MyEntityId;
  expectedVersion: number;  // REQUIRED
  updates: Partial<MyEntity>;
}
```

- [ ] Command includes `expectedVersion`
- [ ] Updates are partial (only changed fields)

### 3. Implement CAS Update

```typescript
// SQL
WHERE id = $id AND version = $expected

// DynamoDB
ConditionExpression: '#version = :expected'
```

- [ ] Update is atomic (single query/operation)
- [ ] Version check in WHERE/Condition
- [ ] Version incremented in same operation
- [ ] Returns updated entity with new version

### 4. Handle Stale Data

```typescript
if (rowCount === 0 || ConditionalCheckFailed) {
  throw new StaleDataError(entity, expectedVersion);
}
```

- [ ] StaleDataError thrown on mismatch
- [ ] Error includes entity name and versions
- [ ] Client receives retryable error info

## Code Review Checklist

### Entity Design

- [ ] All mutable entities have version field
- [ ] Version is never manually set by client
- [ ] updatedAt is set server-side

### Update Operations

- [ ] No read-modify-write gaps
- [ ] Version check is atomic with update
- [ ] expectedVersion required in all update commands

### Error Handling

- [ ] StaleDataError is specific error type
- [ ] Error includes action guidance (REFRESH_AND_RETRY)
- [ ] Conflicts logged with trace ID

### Frontend Integration

- [ ] UI sends current version with updates
- [ ] Conflict triggers refresh
- [ ] User notified of concurrent changes

## Common Patterns

### SQL (PostgreSQL)

```typescript
const result = await db.query(`
  UPDATE orders
  SET status = $1, version = version + 1, updated_at = NOW()
  WHERE id = $2 AND version = $3
  RETURNING *
`, [status, orderId, expectedVersion]);

if (result.rowCount === 0) {
  throw new StaleDataError('Order', expectedVersion);
}
```

### DynamoDB

```typescript
try {
  await client.send(new UpdateItemCommand({
    TableName: 'orders',
    Key: { id: { S: orderId } },
    UpdateExpression: 'SET #v = :newV, #status = :status',
    ConditionExpression: '#v = :expectedV',
    ExpressionAttributeNames: { '#v': 'version', '#status': 'status' },
    ExpressionAttributeValues: {
      ':newV': { N: String(expected + 1) },
      ':expectedV': { N: String(expected) },
      ':status': { S: newStatus },
    },
  }));
} catch (e) {
  if (e.name === 'ConditionalCheckFailedException') {
    throw new StaleDataError('Order', expected);
  }
  throw e;
}
```

### React Hook

```typescript
const updateOrder = async (updates) => {
  try {
    const updated = await api.update({
      orderId: order.id,
      expectedVersion: order.version,
      updates,
    });
    setOrder(updated);
  } catch (e) {
    if (e.info?.action === 'REFRESH_AND_RETRY') {
      await refreshOrder();
      showConflictMessage();
    }
  }
};
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| `await read(); await write()` | Race condition gap | Atomic CAS |
| `if (v !== expected) log()` | Ignoring conflict | Throw error |
| `updatedAt` comparison | Clock skew issues | Use integer version |
| Missing expectedVersion | No conflict detection | Require in command |
| Last-write-wins | Silent data loss | Throw StaleDataError |

## Database-Specific Notes

### PostgreSQL
- Use `RETURNING *` to get updated row
- Consider `FOR UPDATE` for complex transactions

### DynamoDB
- Use `ConditionExpression` for CAS
- `ConditionalCheckFailedException` on conflict

### MongoDB
- Use `findOneAndUpdate` with version filter
- Check `matchedCount` for conflict

### Tauri/SQLite
- Same pattern as PostgreSQL
- Single-writer simplifies but still use version

## Exception Cases

When CAS is NOT needed:

- [ ] Append-only operations (logs, events)
- [ ] Idempotent operations (same result on repeat)
- [ ] T1 read-only operations
- [ ] Insert-only (no updates)

## Logging Requirements

```typescript
logger.json('ENTITY_UPDATED', {
  entity: 'Order',
  id: orderId,
  fromVersion: expectedVersion,
  toVersion: newVersion,
  traceId: ctx.traceId,
});
```

- [ ] Log includes entity type
- [ ] Log includes both versions
- [ ] Log includes trace ID

## Template Reference

Copy from: `.prot/pillar-f/optimistic-lock.ts`
