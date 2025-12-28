# Pillar G: AI Traceability Chain

> Structured comments for AI-assisted refactoring

## Rule

Code must contain dual-link structured comments connecting **triggers** to **listeners**. This creates "Context Anchors" for AI agents.

## Purpose

- Enable AI to understand event topology
- Support automated impact analysis
- Facilitate safe refactoring
- Document implicit dependencies explicitly

## Implementation

### Trigger Annotation

```typescript
// File: modules/order/workflows/createOrder.ts

/**
 * @trigger ORDER_PLACED
 * @emits OrderPlacedEvent
 * @payload { orderId: OrderId, userId: UserId, items: OrderItem[] }
 */
async function createOrder(cmd: CreateOrderCommand): Promise<Order> {
  const order = await orderRepo.save(cmd);

  // Emit event
  await eventBus.publish({
    type: 'ORDER_PLACED',
    payload: {
      orderId: order.id,
      userId: cmd.userId,
      items: cmd.items,
    },
  });

  return order;
}
```

### Listener Annotation

```typescript
// File: modules/inventory/handlers/orderPlaced.ts

/**
 * @listen ORDER_PLACED
 * @calls [InventoryService.reserve, NotificationAdapter.send]
 * @compensates INVENTORY_RESERVED (on failure)
 */
async function handleOrderPlaced(event: OrderPlacedEvent): Promise<void> {
  // Reserve inventory
  await inventoryService.reserve(event.payload.items);

  // Send notification
  await notificationAdapter.send({
    type: 'order_confirmation',
    userId: event.payload.userId,
  });
}
```

### Complex Flow Annotation

```typescript
// File: modules/payment/workflows/processPayment.ts

/**
 * @saga PaymentFlow
 * @trigger PAYMENT_INITIATED
 * @steps
 *   1. PAYMENT_AUTHORIZED -> @calls [StripeAdapter.authorize]
 *   2. PAYMENT_CAPTURED -> @calls [StripeAdapter.capture, LedgerService.record]
 *   3. PAYMENT_COMPLETED -> @emits PaymentCompletedEvent
 * @compensates
 *   - PAYMENT_AUTHORIZED: StripeAdapter.void
 *   - PAYMENT_CAPTURED: StripeAdapter.refund
 */
async function processPayment(cmd: ProcessPaymentCommand): Promise<PaymentResult> {
  // Saga implementation...
}
```

### Module Dependency Map

```typescript
// File: modules/order/index.ts

/**
 * @module OrderModule
 * @exposes [createOrder, getOrder, cancelOrder]
 * @depends [InventoryModule, PaymentModule, NotificationModule]
 * @triggers [ORDER_PLACED, ORDER_CANCELLED]
 * @listens [PAYMENT_COMPLETED, INVENTORY_RESERVED]
 */
```

## Annotation Reference

| Annotation | Usage | Example |
|------------|-------|---------|
| `@trigger` | Event emitted | `@trigger ORDER_PLACED` |
| `@listen` | Event handled | `@listen ORDER_PLACED` |
| `@calls` | Dependencies invoked | `@calls [ServiceA, ServiceB]` |
| `@emits` | Event type emitted | `@emits OrderPlacedEvent` |
| `@payload` | Event data shape | `@payload { orderId, items }` |
| `@saga` | Saga name | `@saga CheckoutFlow` |
| `@steps` | Saga steps | `@steps 1. AUTH 2. CAPTURE` |
| `@compensates` | Undo actions | `@compensates STEP: action` |
| `@module` | Module declaration | `@module OrderModule` |
| `@exposes` | Public API | `@exposes [fn1, fn2]` |
| `@depends` | Module dependencies | `@depends [ModuleA]` |

## Good Example

```typescript
// ✅ Complete traceability chain

// order/createOrder.ts
/** @trigger ORDER_PLACED @emits OrderPlacedEvent */
async function createOrder() { /* ... */ }

// inventory/handleOrderPlaced.ts
/** @listen ORDER_PLACED @calls [InventoryService] */
async function handleOrderPlaced() { /* ... */ }

// AI can now trace: createOrder -> ORDER_PLACED -> handleOrderPlaced -> InventoryService
```

## Bad Example

```typescript
// ❌ No traceability - AI cannot understand flow
async function createOrder() {
  await orderRepo.save(order);
  await eventBus.publish({ type: 'ORDER_PLACED' });  // Where does this go?
}

async function someHandler(event) {
  // What triggers this? What's the event shape?
  await doSomething(event.data);
}
```

## Anti-Patterns

1. **Missing annotations on event handlers**
   ```typescript
   // ❌ No @listen, unclear what triggers this
   eventBus.on('ORDER_PLACED', handler);
   ```

2. **Incomplete dependency documentation**
   ```typescript
   // ❌ @calls missing
   /** @listen ORDER_PLACED */
   async function handler() {
     await serviceA.call();  // Not documented
     await serviceB.call();  // Not documented
   }
   ```

3. **Orphan annotations**
   ```typescript
   // ❌ @trigger with no matching @listen anywhere
   /** @trigger UNUSED_EVENT */
   ```

## Exceptions

- Internal helper functions (not part of public flow)
- Third-party library callbacks

## Checklist

- [ ] All event emitters have `@trigger` annotation
- [ ] All event handlers have `@listen` annotation
- [ ] `@calls` lists all significant dependencies
- [ ] Saga steps documented with `@steps`
- [ ] Compensation actions documented
- [ ] Module index files have `@module` declaration

## References

- Related: Pillar R (Observability) - runtime tracing
- Purpose: AI-assisted refactoring, impact analysis
- Template: `.prot/pillar-g/traceability.ts`
- Checklist: `.prot/pillar-g/checklist.md`
